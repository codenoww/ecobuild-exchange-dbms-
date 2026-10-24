-- ============================================================
-- EcoBuild Exchange — ALTER / DROP demonstration
-- A real schema-evolution example, separate from the teardown
-- DROP TABLE IF EXISTS statements in schema.sql
-- ============================================================

-- Add a column to track whether a vendor listing was sourced live
-- from the internet (vs. manually curated)
ALTER TABLE vendor_listings
    ADD COLUMN is_live_synced BOOLEAN NOT NULL DEFAULT FALSE;

-- Add a column to track a furniture listing's view count (for ranking)
ALTER TABLE furniture_listings
    ADD COLUMN view_count INT NOT NULL DEFAULT 0;

-- Widen a column that was found too narrow during testing
ALTER TABLE vendors
    ALTER COLUMN location TYPE VARCHAR(200);

-- Add a constraint after the fact (every listing must have a non-negative view count)
ALTER TABLE furniture_listings
    ADD CONSTRAINT chk_view_count_nonneg CHECK (view_count >= 0);

-- Drop a column that turned out to be redundant (category duplicated on green_materials
-- was originally also tracked per listing; superseded by the FK join)
ALTER TABLE vendor_listings
    DROP COLUMN IF EXISTS is_live_synced;

-- Example of a real DROP TABLE (not the schema-reset kind): an early
-- prototype table that was replaced by material_alternatives + green_materials
DROP TABLE IF EXISTS legacy_material_mapping;
