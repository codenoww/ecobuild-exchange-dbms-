# NoSQL layer — vendor data sync pipeline

This is the project's NoSQL component, chosen because real vendor listings scraped from
the web have no consistent schema — different sites expose different fields (some have
price, some don't; units vary Piece/Kg/Number; one real listing even has mismatched
metadata tags). Forcing that directly into a rigid SQL table loses data or requires
guessing; a document store holds it as-is.

## Files

- `raw_vendor_listings_seed.json` — 99 real product listings, pulled live from IndiaMART/TradeIndia (fly ash, bamboo flooring, CSEB, hempcrete, plus a few deliberately-unmatched ones like a block-making machine and plain TMT rebar)
- `raw_junkyard_listings_seed.json` — 4 real scrap/furniture buyers from Google Business and IndiaMART pages; only the Bengaluru ones are kept by the pipeline
  and TradeIndia on 2026-10-23 for fly ash bricks, CSEB (compressed stabilized earth
  blocks), and hemp building material. Kept exactly as scraped, including a
  quote-on-request listing with no price and a listing with inconsistent metadata tags.
- `vendor_sync.py` — the sync pipeline:
  1. Loads the raw listings into a MongoDB collection (`raw_vendor_listings`)
  2. Runs a real MongoDB aggregation (group by source site, count priced vs.
     quote-only listings, average price) — this is the project's NoSQL aggregation
     advanced feature
  3. Normalizes + matches each raw listing to a canonical `green_materials` row by
     keyword match, dropping listings with no usable price
  4. Emits clean SQL (`database/real_vendor_data.sql`) that replaces the
     `vendor_listings` / `vendors` tables with the real, matched data

## Running it

```bash
pip install pymongo mongomock
python3 vendor_sync.py
```

By default this runs against `mongomock`, an in-memory implementation of the pymongo
API, so the pipeline works without a live MongoDB server during development/demo. The
`pymongo` calls in `vendor_sync.py` are unchanged either way — to run against a real
MongoDB instance (Atlas or self-hosted), just set the connection string:

```bash
export MONGO_URI="mongodb+srv://<user>:<pass>@<cluster>/ecobuild_exchange"
python3 vendor_sync.py
```

## Production version (not yet built)

For an actually-live site, step 1 (scraping) would run on a schedule (cron / scheduled
job) against real vendor sites, writing straight into a real MongoDB instance instead of
the static seed JSON. Everything downstream (aggregation, normalization, SQL sync) stays
the same — only the raw ingestion source changes.

## Normalization rules (what the pipeline rejects, and why)

- **No price** — quote-only listings are kept in MongoDB but never reach SQL.
- **No keyword match** — e.g. a CSEB *machine*, "TMT Rebar" that never says recycled, hemp hurds (an ingredient, not a block).
- **Wrong unit** — each material has one pricing unit (fly ash / CSEB / hempcrete per piece, bamboo per sq ft), so a price per tonne is never compared with a price per piece.
- **Outside the service area** — junkyards not in Bengaluru are skipped.

Known gaps: no real listings were found for Recycled Steel Rebar or Reclaimed Wood Panel, so they show "No vendor pricing yet". Prices are as listed on the day scraped (2026-10-24) and some are implausibly low or high; they are kept as scraped.
