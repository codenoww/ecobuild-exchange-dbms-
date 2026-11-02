# EcoBuild Exchange — MongoDB Data Model

## 1. Overview

EcoBuild Exchange uses MongoDB as its NoSQL ingestion layer for raw vendor product listings and junkyard information collected from external sources.

The source websites do not follow a consistent document structure. Some listings contain prices, others require customers to request quotations, and product units and metadata can differ between websites.

MongoDB stores these records in their raw form before the synchronization pipeline validates and converts suitable records into the relational PostgreSQL database.

**MongoDB database:** `ecobuild_exchange`

## 2. Collections

The database contains two collections:

| Collection | Purpose |
|---|---|
| `raw_vendor_listings` | Stores raw product listings collected from vendor websites. |
| `raw_junkyard_listings` | Stores raw information about scrap and furniture buyers. |

### 2.1 raw_vendor_listings

This collection stores product information from sources such as IndiaMART and TradeIndia.

Documents preserve source-specific fields instead of forcing all scraped records into a rigid relational structure.

**Example document:**

```json
{
  "source_site": "tradeindia.com",
  "source_url": "https://www.tradeindia.com/products/9x4x3-inch-rectangular-solid-fly-ash-brick-8407590.html",
  "product_name": "9x4x3 Inch Rectangular Solid Fly Ash Brick",
  "price": 10,
  "currency": "INR",
  "unit": "Piece",
  "moq": 2500,
  "seller_name": "Verma Construction Company",
  "seller_location": "Panipat, Haryana",
  "scraped_at": "2026-10-23T18:35:00Z",
  "raw_tags": [
    "fly ash brick",
    "construction material"
  ]
}
```

**Field descriptions:**

| Field | Description |
|---|---|
| `source_site` | Website from which the listing was collected. |
| `source_url` | Original listing URL. |
| `product_name` | Product name as published by the seller. |
| `price` | Listed price; can be null when a quotation is required. |
| `price_note` | Additional pricing information, when available. |
| `currency` | Currency used for the listing. |
| `unit` | Pricing unit, such as Piece, Kg, or sq ft. |
| `moq` | Minimum order quantity, when available. |
| `pack_size` | Package size, when available. |
| `seller_name` | Vendor or seller name. |
| `seller_location` | Seller's stated location. |
| `scraped_at` | Timestamp when the record was collected. |
| `raw_tags` | Original metadata tags from the source website. |

Not every document contains every field. This is intentional because the raw collection preserves differences between source websites.

### 2.2 raw_junkyard_listings

This collection stores information about scrap dealers and used furniture buyers.

**Example document:**

```json
{
  "source_site": "business.google.com",
  "source_url": "https://business.google.com/",
  "name": "Bangalore Scraper LLP",
  "city": "Bengaluru",
  "address": null,
  "phone": "+91 96634 75568",
  "services": [
    "Office dismantling",
    "Office furniture buying",
    "Scrap buying (AC, UPS, DG sets, electrical panels and cables, IT assets)"
  ],
  "scraped_at": "2026-10-24T13:00:00Z"
}
```

**Field descriptions:**

| Field | Description |
|---|---|
| `source_site` | Website or platform where the information was found. |
| `source_url` | Original business listing URL. |
| `name` | Junkyard or scrap dealer name. |
| `city` | Business location. |
| `address` | Street address, when available. |
| `phone` | Business contact number. |
| `services` | Services and categories accepted by the business. |
| `scraped_at` | Timestamp when the record was collected. |

## 3. Indexing Strategy

The synchronization script creates two indexes on `raw_vendor_listings`:

| Index | Purpose |
|---|---|
| `source_site` | Helps filter and group vendor listings by source website. |
| `seller_name` | Helps search and filter listings by seller. |

The indexes are created using:

```python
raw_collection.create_index("source_site")
raw_collection.create_index("seller_name")
```

These indexes improve lookup and filtering operations on commonly used vendor fields.

No additional indexes are explicitly created on `raw_junkyard_listings` by the current synchronization script.

## 4. MongoDB Aggregation Pipeline

The project uses MongoDB's aggregation framework to summarize vendor listings by their source website.

The pipeline performs these operations:

1. `$group`: Groups documents by `source_site`.
2. `$sum`: Counts total listings and listings with a non-null price.
3. `$avg`: Calculates the average available price.
4. `$sort`: Sorts source groups by total listing count in descending order.

**Implementation:**

```python
pipeline = [
    {
        "$group": {
            "_id": "$source_site",
            "total_listings": {"$sum": 1},
            "priced_listings": {
                "$sum": {
                    "$cond": [
                        {"$ne": ["$price", None]},
                        1,
                        0
                    ]
                }
            },
            "avg_price": {"$avg": "$price"}
        }
    },
    {"$sort": {"total_listings": -1}}
]

results = list(raw_collection.aggregate(pipeline))
```

The aggregation provides a source-wise summary of the collected vendor data before the normalization process.

### 4.1 Aggregation Results

The previously verified synchronization output showed:

| Source website | Total listings | Priced listings | Average price (INR) |
|---|---:|---:|---:|
| IndiaMART | 96 | 92 | 178.23 |
| TradeIndia | 3 | 3 | 18,697.33 |
| **Total** | **99** | **95** | — |

The average price is calculated over listings with available numeric prices.

## 5. Data Retrieval and Normalization Strategy

The synchronization pipeline follows these steps:

1. Load raw vendor and junkyard seed documents into their respective MongoDB collections.
2. Run the aggregation pipeline to summarize vendor data by source.
3. Retrieve vendor documents with a non-null price.
4. Match each product name against keywords associated with canonical materials in PostgreSQL's `green_materials` table.
5. Reject products that do not match a supported material.
6. Normalize the product's unit and compare it with the expected unit for that material.
7. Generate SQL statements for valid vendors and vendor listings.
8. Retrieve junkyard documents and retain only businesses in Bengaluru.
9. Generate normalized junkyard records for PostgreSQL.

### 5.1 Material Matching

The current keyword mapping is:

| Material ID | Material | Matching keywords |
|---|---|---|
| 1 | Fly Ash Cement | `fly ash`, `flyash` |
| 2 | Compressed Stabilized Earth Block | `cseb`, `earth block`, `mud block`, `earth brick`, `mud brick` |
| 3 | Bamboo Flooring | `bamboo` |
| 4 | Recycled Steel Rebar | `recycled steel` |
| 5 | Reclaimed Wood Panel | `reclaimed wood`, `reclaimed` |
| 6 | Hempcrete Block | `hempcrete` |

Listings containing excluded terms such as `machine` or `service` are rejected. This prevents unrelated products and services from being incorrectly classified as building materials.

### 5.2 Unit Normalization

The pipeline normalizes common unit variations:

- `pieces`, `unit`, `number`, and `nos` become `piece`.
- `sq ft`, `sq.ft`, `sqft`, and `square feet` become `sq_ft`.
- `ton` and `metric ton` become `tonne`.
- `kg` is recognized as `kg`.

Each canonical material has an expected pricing unit. Listings with incompatible units are rejected to avoid comparing prices measured in different quantities.

| Material ID | Expected unit |
|---|---|
| 1 | `piece` |
| 2 | `piece` |
| 3 | `sq_ft` |
| 4 | `tonne` |
| 5 | `sq_ft` |
| 6 | `piece` |

### 5.3 Junkyard Filtering

The service city is configured as:

```python
SERVICE_CITY = "Bengaluru"
```

Only junkyard documents whose `city` matches this value are converted into SQL records. Other locations are skipped.

## 6. Synchronization Results

The verified synchronization results are:

| Metric | Count |
|---|---:|
| Raw vendor documents loaded into MongoDB | 99 |
| Raw junkyard documents loaded into MongoDB | 4 |
| Vendor listings matched to canonical materials | 85 |
| Junkyards retained in Bengaluru | 2 |

Some vendor documents are excluded because they have no usable price, do not match a supported material, or use an incompatible pricing unit.

The raw MongoDB records are retained separately from the normalized PostgreSQL records.

## 7. MongoDB to PostgreSQL Data Flow

```text
External vendor and business sources
                |
                v
       Raw JSON seed documents
                |
                v
       MongoDB: ecobuild_exchange
          /                 \
         v                   v
 raw_vendor_listings   raw_junkyard_listings
         |
         v
 MongoDB aggregation
 (group by source site)
         |
         v
 Price filtering and
 material keyword matching
         |
         v
 Unit normalization
         |
         v
 SQL generation
         |
         v
 PostgreSQL tables
 vendors, vendor_listings,
 and junkyards
```

MongoDB is responsible for storing heterogeneous source documents and performing aggregation. PostgreSQL stores the normalized records used by the EcoBuild Exchange application.

## 8. Running the Synchronization Script

Install the dependencies:

```bash
pip install -r database/nosql/requirements.txt
```

Run the script from the project root:

```bash
python3 database/nosql/vendor_sync.py
```

When `MONGO_URI` is not configured, the script uses `mongomock`, an in-memory implementation of the PyMongo API.

To connect to a real MongoDB instance, configure `MONGO_URI` as an environment variable before running the script.

Example:

```bash
export MONGO_URI="mongodb+srv://<user>:<password>@<cluster>/ecobuild_exchange"
python3 database/nosql/vendor_sync.py
```

Do not commit database credentials to the repository.

## 9. Current Limitations

- The current ingestion uses JSON seed files; scheduled live scraping has not yet been implemented.
- Some source listings do not provide a usable price.
- Material matching is keyword-based and may reject relevant listings whose product names do not contain configured keywords.
- Listings with incompatible pricing units are excluded.
- Junkyard records outside Bengaluru are excluded by the current service-area rule.
- No real listings were found for Recycled Steel Rebar or Reclaimed Wood Panel in the current dataset.
- Prices are retained as scraped and may be unusually low or high. They should not automatically be treated as verified market prices.