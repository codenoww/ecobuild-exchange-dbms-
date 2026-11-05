-- ============================================================
-- Materials catalog update: sourced CO2 figures, data-quality flags,
-- more materials/alternatives, and a synonyms table for search.
-- Run AFTER seed_data.sql and recommendation_ranking.sql.
--
-- CO2 basis: kg CO2e per kg of material, cradle-to-gate (A1-A3).
-- data_quality: 'cited'       = value taken from a published source
--               'derived'     = calculated from a published relation
--               'placeholder' = NOT yet sourced; replace before relying on it
-- cost figures and sustainability_score (an editorial 0-10 rating) are
-- NOT sourced anywhere in this file.
-- ============================================================

-- ---------- Schema changes (schema evolution via ALTER) ----------
ALTER TABLE green_materials ALTER COLUMN co2_per_unit TYPE NUMERIC(10,4);
ALTER TABLE green_materials ALTER COLUMN cost_per_unit DROP NOT NULL;
ALTER TABLE material_alternatives ALTER COLUMN cost_delta_pct DROP NOT NULL;

ALTER TABLE traditional_materials
    ADD COLUMN IF NOT EXISTS co2_per_unit  NUMERIC(10,4) CHECK (co2_per_unit >= 0),
    ADD COLUMN IF NOT EXISTS co2_source    TEXT;
ALTER TABLE green_materials
    ADD COLUMN IF NOT EXISTS data_quality  VARCHAR(12) NOT NULL DEFAULT 'placeholder'
        CHECK (data_quality IN ('cited','derived','placeholder')),
    ADD COLUMN IF NOT EXISTS co2_source    TEXT;
ALTER TABLE material_alternatives
    ADD COLUMN IF NOT EXISTS data_quality  VARCHAR(12) NOT NULL DEFAULT 'placeholder'
        CHECK (data_quality IN ('cited','derived','placeholder'));

-- ---------- Traditional materials: baseline CO2 ----------
UPDATE traditional_materials SET co2_per_unit = 0.8400,
  co2_source = 'MPA Fact Sheet 18 (rev. 4, Apr 2025): CEM I Portland cement, 840 kg CO2e per tonne'
  WHERE name = 'Portland Cement';
UPDATE traditional_materials SET co2_per_unit = 0.2400,
  co2_source = 'ICE (Hammond & Jones, Univ. of Bath): common bricks, 0.24 kg CO2/kg'
  WHERE name = 'Red Clay Brick';
UPDATE traditional_materials SET co2_per_unit = 2.4100,
  co2_source = 'ICE (Hammond & Jones, Univ. of Bath): PVC general, 2.41 kg CO2/kg'
  WHERE name = 'Virgin PVC Flooring';
UPDATE traditional_materials SET co2_per_unit = 1.9900,
  co2_source = 'ICE Database v3.0 (Circular Ecology, 2019): rebar, 1.99 kg CO2e/kg (world average)'
  WHERE name = 'Steel Rebar (Virgin)';
UPDATE traditional_materials SET co2_per_unit = 1.1000,
  co2_source = 'ICE as listed in HKUST ECO-CM database v1.1: timber, plywood, 1.100 kg CO2e/kg'
  WHERE name = 'Plywood (Standard)';

INSERT INTO traditional_materials (name, category, co2_per_unit, co2_source)
SELECT 'Primary Glass', 'Glazing', 0.9100,
       'ICE as listed in HKUST ECO-CM database v1.1: glass, primary, 0.910 kg CO2e/kg'
WHERE NOT EXISTS (SELECT 1 FROM traditional_materials WHERE name = 'Primary Glass');

-- ---------- Green materials: CO2 per kg and quality ----------
UPDATE green_materials SET co2_per_unit = 0.6100, data_quality = 'cited',
  co2_source = 'MPA Fact Sheet 18 (2025): CEM II/B-V (fly ash 21-35%), 542-678 kg CO2e/t; midpoint used'
  WHERE name = 'Fly Ash Cement';
UPDATE green_materials SET co2_per_unit = 0.0850, data_quality = 'cited',
  co2_source = 'Max Fordham / Build Up Nepal (2021): CSEB with 10% cement, 0.085 kg CO2e/kg (A1-A3)'
  WHERE name = 'Compressed Stabilized Earth Block';
UPDATE green_materials SET co2_per_unit = 0.9950, data_quality = 'derived',
  co2_source = 'Derived: about half of conventional rebar (1.99) as EAF steel is described as roughly half as carbon intensive as BOF steel (Construction Canada). Replace with a product EPD.'
  WHERE name = 'Recycled Steel Rebar';
-- Bamboo Flooring, Reclaimed Wood Panel and Hempcrete Block keep their earlier
-- placeholder CO2 values: no comparable per-kg figure has been sourced yet.
UPDATE green_materials SET data_quality = 'placeholder', co2_source = 'Not yet sourced'
  WHERE name IN ('Bamboo Flooring', 'Reclaimed Wood Panel', 'Hempcrete Block');

INSERT INTO green_materials (name, category, co2_per_unit, cost_per_unit, sustainability_score, data_quality, co2_source)
SELECT 'Slag Cement (GGBS blend)', 'Structural', 0.4800, NULL, 7.50, 'cited',
       'MPA Fact Sheet 18 (2025): CEM III/A (GGBS 36-65%), 369-596 kg CO2e/t; midpoint used'
WHERE NOT EXISTS (SELECT 1 FROM green_materials WHERE name = 'Slag Cement (GGBS blend)');
INSERT INTO green_materials (name, category, co2_per_unit, cost_per_unit, sustainability_score, data_quality, co2_source)
SELECT 'Recycled Glass (secondary)', 'Glazing', 0.5900, NULL, 8.00, 'cited',
       'ICE as listed in HKUST ECO-CM database v1.1: glass, secondary, 0.590 kg CO2e/kg'
WHERE NOT EXISTS (SELECT 1 FROM green_materials WHERE name = 'Recycled Glass (secondary)');

-- ---------- Alternative pairs ----------
-- reduction % = (traditional CO2 - green CO2) / traditional CO2 * 100
-- (so the carbon function's baseline, green / (1 - reduction), equals the traditional value)
UPDATE material_alternatives ma SET co2_reduction_pct = 27.38, data_quality = 'cited'
  FROM traditional_materials t, green_materials g
  WHERE ma.traditional_material_id = t.material_id AND ma.green_material_id = g.material_id
    AND t.name = 'Portland Cement' AND g.name = 'Fly Ash Cement';
UPDATE material_alternatives ma SET co2_reduction_pct = 64.58, data_quality = 'cited'
  FROM traditional_materials t, green_materials g
  WHERE ma.traditional_material_id = t.material_id AND ma.green_material_id = g.material_id
    AND t.name = 'Red Clay Brick' AND g.name = 'Compressed Stabilized Earth Block';
UPDATE material_alternatives ma SET co2_reduction_pct = 50.00, data_quality = 'derived'
  FROM traditional_materials t, green_materials g
  WHERE ma.traditional_material_id = t.material_id AND ma.green_material_id = g.material_id
    AND t.name = 'Steel Rebar (Virgin)' AND g.name = 'Recycled Steel Rebar';
-- the other three existing pairs stay 'placeholder' (default)

INSERT INTO material_alternatives (traditional_material_id, green_material_id, co2_reduction_pct, cost_delta_pct, data_quality)
SELECT t.material_id, g.material_id, 42.86, NULL, 'cited'
FROM traditional_materials t, green_materials g
WHERE t.name = 'Portland Cement' AND g.name = 'Slag Cement (GGBS blend)'
ON CONFLICT (traditional_material_id, green_material_id) DO NOTHING;
INSERT INTO material_alternatives (traditional_material_id, green_material_id, co2_reduction_pct, cost_delta_pct, data_quality)
SELECT t.material_id, g.material_id, 35.16, NULL, 'cited'
FROM traditional_materials t, green_materials g
WHERE t.name = 'Primary Glass' AND g.name = 'Recycled Glass (secondary)'
ON CONFLICT (traditional_material_id, green_material_id) DO NOTHING;

-- ---------- Synonyms for search ----------
CREATE TABLE IF NOT EXISTS material_synonyms (
    synonym_id                SERIAL PRIMARY KEY,
    term                      VARCHAR(60) NOT NULL,
    traditional_material_id   INT NOT NULL REFERENCES traditional_materials(material_id) ON DELETE CASCADE,
    UNIQUE (term, traditional_material_id)
);
CREATE INDEX IF NOT EXISTS idx_material_synonyms_term ON material_synonyms (lower(term));

INSERT INTO material_synonyms (term, traditional_material_id)
SELECT s.term, t.material_id
FROM (VALUES
    ('Portland Cement','cement'), ('Portland Cement','concrete'), ('Portland Cement','mortar'),
    ('Portland Cement','opc'), ('Portland Cement','binder'),
    ('Red Clay Brick','brick'), ('Red Clay Brick','bricks'), ('Red Clay Brick','masonry'),
    ('Red Clay Brick','wall'), ('Red Clay Brick','block'),
    ('Virgin PVC Flooring','floor'), ('Virgin PVC Flooring','flooring'), ('Virgin PVC Flooring','vinyl'),
    ('Virgin PVC Flooring','pvc'), ('Virgin PVC Flooring','tiles'),
    ('Steel Rebar (Virgin)','steel'), ('Steel Rebar (Virgin)','rebar'), ('Steel Rebar (Virgin)','tmt'),
    ('Steel Rebar (Virgin)','reinforcement'), ('Steel Rebar (Virgin)','iron'),
    ('Plywood (Standard)','wood'), ('Plywood (Standard)','timber'), ('Plywood (Standard)','plywood'),
    ('Plywood (Standard)','board'), ('Plywood (Standard)','furniture'),
    ('Primary Glass','glass'), ('Primary Glass','window'), ('Primary Glass','glazing')
) AS s(trad, term)
JOIN traditional_materials t ON t.name = s.trad
ON CONFLICT (term, traditional_material_id) DO NOTHING;
