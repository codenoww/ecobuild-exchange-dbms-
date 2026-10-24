# Material Database Architecture

The app should treat material data as a layered system, not as one hand-written list.

## Data Layers

1. OpenEPD / EC3
   - Primary source for verified product-specific Environmental Product Declarations.
   - Use for manufacturer, product name, declared unit, GWP, EPD status, region, and source attribution.
   - Requires EC3/OpenEPD API access and terms-compliant attribution.

2. ICE Database
   - Fallback source for generic embodied-carbon factors when product EPDs are missing.
   - Useful for early design comparison by material family.
   - Do not present ICE values as product-specific.

3. mindful MATERIALS-style scoring
   - Adds non-carbon criteria: health, VOC, circularity, ecosystem, and social impact.
   - Used to explain why one material is greener beyond embodied carbon alone.

4. Supplier / shopping links
   - Stored separately because EPD databases often do not provide purchase links.
   - Links should be curated, region-aware, and clearly marked as procurement leads.

## Backend Shape

The backend exposes:

- `GET /material-database/sources`
- `GET /material-database/materials?q=&section=&limit=`
- `GET /material-database/materials/:id`

When `OPENEPD_API_TOKEN` and `OPENEPD_API_BASE_URL` are configured, the backend can query an OpenEPD-compatible source. Without credentials, it returns the local fallback cache.

## Environment Variables

```text
OPENEPD_API_TOKEN=
OPENEPD_API_BASE_URL=https://openepd.buildingtransparency.org/api
```

Create the API key from EC3 Key Management, then restart the backend. The OpenEPD quickstart documents the same base URL and `OPENEPD_API_TOKEN` environment variable. EC3 access, cache permissions, rate limits, and attribution depend on the account and API agreement.

## Product Comparison Rule

Only compare materials directly when the function, declared unit, performance requirements, region, and life-cycle scope are compatible.
