"""
EcoBuild Exchange — Vendor listing sync pipeline (NoSQL -> SQL)

Real pipeline shape:
  1. Previously collected vendor product listings from sources such as
     IndiaMART and TradeIndia are stored AS-IS in a MongoDB collection
     `raw_vendor_listings` — no cleanup, no schema enforcement, because
     every source site structures its data differently (see
     raw_vendor_listings_seed.json for collected examples: missing prices,
     inconsistent units, mismatched metadata tags).

  2. This script reads that raw collection, runs a MongoDB aggregation to
     summarize it, then normalizes + matches each raw listing to a
     canonical green_materials row, and emits the clean SQL rows that the
     Next.js app actually queries.

Connection:
  Set MONGO_URI to point at a real MongoDB instance (Atlas or self-hosted).
  If MONGO_URI is unset, this script falls back to `mongomock`, an
  in-memory implementation of the pymongo API, purely so this pipeline is
  runnable and demoable without a live Mongo server during development.
  The pymongo calls below are unchanged either way — swapping in a real
  MONGO_URI is the only change needed to go from demo to production.
"""

import json
import os
import re
import certifi
from pathlib import Path

MONGO_URI = os.environ.get("MONGO_URI")

if MONGO_URI:
    from pymongo import MongoClient

    client = MongoClient(
    MONGO_URI,
    tlsCAFile=certifi.where(),
    serverSelectionTimeoutMS=10000
)

    # Verify connection to the actual MongoDB server
    client.admin.command("ping")
    print("[vendor_sync] Connected to real MongoDB Atlas!")

else:
    import mongomock
    client = mongomock.MongoClient()
    print("[vendor_sync] MONGO_URI not set — using mongomock.")

db = client["ecobuild_exchange"]
raw_collection = db["raw_vendor_listings"]
raw_junkyards = db["raw_junkyard_listings"]
# Create indexes for faster searching and filtering
raw_collection.create_index("source_site")
raw_collection.create_index("seller_name")

print("[vendor_sync] MongoDB indexes created:")
print("  - source_site")
print("  - seller_name")
SEED_PATH = Path(__file__).parent / "raw_vendor_listings_seed.json"
JUNKYARD_SEED_PATH = Path(__file__).parent / "raw_junkyard_listings_seed.json"

# The marketplace only refers listings to junkyards in its service area.
SERVICE_CITY = "Bengaluru"


def load_raw_seed():
    """Load the real scraped listings into the raw collection (idempotent)."""
    raw_collection.delete_many({})
    with open(SEED_PATH) as f:
        docs = json.load(f)
    raw_collection.insert_many(docs)
    print(f"[vendor_sync] Loaded {len(docs)} raw vendor documents into MongoDB.")

    raw_junkyards.delete_many({})
    with open(JUNKYARD_SEED_PATH) as f:
        junk = json.load(f)
    raw_junkyards.insert_many(junk)
    print(f"[vendor_sync] Loaded {len(junk)} raw junkyard documents into MongoDB.")


def run_aggregation():
    """
    Real MongoDB aggregation pipeline: group raw listings by source site,
    count how many have a usable price vs. quote-only, and compute average
    price where available. This is the NoSQL aggregation advanced feature.
    """
    pipeline = [
        {
            "$group": {
                "_id": "$source_site",
                "total_listings": {"$sum": 1},
                "priced_listings": {
                    "$sum": {"$cond": [{"$ne": ["$price", None]}, 1, 0]}
                },
                "avg_price": {"$avg": "$price"},
            }
        },
        {"$sort": {"total_listings": -1}},
    ]
    results = list(raw_collection.aggregate(pipeline))
    print("\n[vendor_sync] Aggregation — listings grouped by source site:")
    for r in results:
        avg = f"{r['avg_price']:.2f}" if r["avg_price"] is not None else "n/a"
        print(f"  {r['_id']:<16} total={r['total_listings']}  priced={r['priced_listings']}  avg_price={avg}")
    return results


# Canonical material matching: maps keywords found in raw product names to
# the matching row in the SQL green_materials table (by material_id, as
# seeded in seed_data.sql).
MATERIAL_KEYWORDS = {
    1: ["fly ash", "flyash"],  # Fly Ash Cement
    2: ["cseb", "earth block", "mud block", "earth brick", "mud brick"],  # Compressed Stabilized Earth Block
    3: ["bamboo"],              # Bamboo Flooring
    4: ["recycled steel"],      # Recycled Steel Rebar — plain "TMT rebar" is NOT enough, it must say recycled
    5: ["reclaimed wood", "reclaimed"],  # Reclaimed Wood Panel
    6: ["hempcrete"],           # Hempcrete Block (hemp hurds are a raw ingredient, not a block)
}

# Words that mean the listing is not the material itself (e.g. a machine that
# makes earth blocks, or an installation service).
EXCLUDE_WORDS = ["machine", "service"]

# Prices are only comparable within one unit, so each material has one
# expected pricing unit. Listings priced in another unit (₹/tonne, ₹/kg...)
# are rejected rather than mixed into the same "best price".
EXPECTED_UNIT = {1: "piece", 2: "piece", 3: "sq_ft", 4: "tonne", 5: "sq_ft", 6: "piece"}

UNIT_ALIASES = {
    "piece": "piece", "pieces": "piece", "unit": "piece", "number": "piece", "nos": "piece",
    "sq ft": "sq_ft", "sq.ft": "sq_ft", "sqft": "sq_ft", "square feet": "sq_ft", "square foot": "sq_ft",
    "tonne": "tonne", "ton": "tonne", "metric ton": "tonne",
    "kg": "kg",
}


def normalize_unit(unit):
    return UNIT_ALIASES.get((unit or "").strip().lower())


def match_material_id(product_name: str):
    name = product_name.lower()
    if any(w in name for w in EXCLUDE_WORDS):
        return None
    for material_id, keywords in MATERIAL_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return material_id
    return None


def normalize_and_emit_sql():
    """
    Read raw listings, keep only ones with a usable price, match each to a
    canonical green_materials row, and emit clean INSERT statements for the
    SQL vendor_listings / vendors tables.
    """
    docs = list(raw_collection.find({"price": {"$ne": None}}))
    vendors_seen = {}
    vendor_inserts = []
    listing_inserts = []

    for doc in docs:
        material_id = match_material_id(doc["product_name"])
        if material_id is None:
            print(f"[vendor_sync] SKIPPED (no material match): {doc['product_name']} [{doc['seller_name']}]")
            continue

        if normalize_unit(doc.get("unit")) != EXPECTED_UNIT[material_id]:
            print(f"[vendor_sync] SKIPPED (unit {doc.get('unit')!r} != {EXPECTED_UNIT[material_id]}): {doc['product_name']} [{doc['seller_name']}]")
            continue

        seller = doc["seller_name"]
        if seller not in vendors_seen:
            vendor_inserts.append(
                f"INSERT INTO vendors (name, website, location) VALUES "
                f"({sql_str(seller)}, {sql_str(doc['source_url'])}, {sql_str(doc['seller_location'])}) "
                f"ON CONFLICT DO NOTHING RETURNING vendor_id;"
            )
            vendors_seen[seller] = True

        listing_inserts.append({
            "vendor_name": seller,
            "material_id": material_id,
            "price": doc["price"],
            "url": doc["source_url"],
            "location": doc.get("seller_location"),
            "site_domain": re.sub(r"^https?://(?:m\.)?([^/]+).*$", r"https://\1", doc["source_url"]),
        })

    return vendor_inserts, listing_inserts


def normalize_junkyards():
    """Keep only junkyards inside the marketplace's service area, as clean rows."""
    docs = list(raw_junkyards.find({}))
    keep = []
    for d in docs:
        if d.get("city") != SERVICE_CITY:
            print(f"[vendor_sync] SKIPPED junkyard outside {SERVICE_CITY}: {d['name']} ({d.get('city')})")
            continue
        keep.append({
            "name": d["name"],
            "location": d["city"],
            "categories": "; ".join(d.get("services", [])),
            "contact": d.get("phone"),
        })
    return keep


def sql_str(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


if __name__ == "__main__":
    load_raw_seed()
    run_aggregation()
    vendor_sql, listings = normalize_and_emit_sql()

    print(f"\n[vendor_sync] Matched {len(listings)} real listings to canonical materials:")
    for l in listings:
        print(f"  material_id={l['material_id']}  {l['vendor_name']:<32} ₹{l['price']}  {l['url']}")

    # Write the normalized SQL for the live DB load step
    out_path = Path(__file__).parent.parent / "real_vendor_data.sql"
    with open(out_path, "w") as f:
        f.write("-- Auto-generated by database/nosql/vendor_sync.py from real scraped listings\n")
        f.write("-- Replaces the synthetic vendor_listings seed rows with real, web-sourced data\n\n")
        f.write("DELETE FROM vendor_listings;\n")
        f.write("DELETE FROM vendors;\n\n")

        seen_vendors = {}
        for l in listings:
            if l["vendor_name"] not in seen_vendors:
                seen_vendors[l["vendor_name"]] = True
                f.write(
                    f"INSERT INTO vendors (name, website, location) "
                    f"VALUES ({sql_str(l['vendor_name'])}, {sql_str(l['site_domain'])}, {sql_str(l['location'])});\n"
                )
        f.write("\n")
        for l in listings:
            f.write(
                f"INSERT INTO vendor_listings (vendor_id, material_id, price, url) "
                f"VALUES ((SELECT vendor_id FROM vendors WHERE name = {sql_str(l['vendor_name'])}), "
                f"{l['material_id']}, {l['price']}, {sql_str(l['url'])});\n"
            )

        # Junkyards: seed_data.sql already created junkyard rows 1 and 2 (the
        # seeded referrals point at them), so the first real junkyards replace
        # those rows in place; any further ones are inserted as new rows.
        junkyards = normalize_junkyards()
        f.write("\n-- Junkyards (real Bengaluru scrap / furniture buyers)\n")
        for i, j in enumerate(junkyards, start=1):
            if i <= 2:
                f.write(
                    f"UPDATE junkyards SET name = {sql_str(j['name'])}, location = {sql_str(j['location'])}, "
                    f"accepted_categories = {sql_str(j['categories'])}, contact = {sql_str(j['contact'])} "
                    f"WHERE junkyard_id = {i};\n"
                )
            else:
                f.write(
                    f"INSERT INTO junkyards (name, location, accepted_categories, contact) VALUES "
                    f"({sql_str(j['name'])}, {sql_str(j['location'])}, {sql_str(j['categories'])}, {sql_str(j['contact'])});\n"
                )

    print(f"\n[vendor_sync] Matched {len(junkyards)} junkyards in {SERVICE_CITY}")
    print(f"\n[vendor_sync] Wrote normalized SQL to {out_path}")
