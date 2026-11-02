-- ============================================================
-- Recommendation ranking: scores each curated traditional -> green pair
-- and ranks the alternatives for each traditional material.
-- Score (0-100 scale, higher = better):
--   50% CO2 reduction, 30% sustainability score, 20% cost advantage
--   cost advantage = -cost_delta_pct (cheaper than the traditional
--   material gives a positive contribution, dearer a negative one)
-- RANK() is a window function: it numbers rows inside each
-- traditional_material_id group without collapsing them.
-- ============================================================
CREATE OR REPLACE VIEW material_recommendations AS
SELECT
    tm.material_id  AS traditional_id,
    tm.name         AS traditional_material,
    gm.material_id  AS green_id,
    gm.name         AS green_material,
    ma.co2_reduction_pct,
    ma.cost_delta_pct,
    gm.sustainability_score,
    ROUND(0.5 * ma.co2_reduction_pct
        + 0.3 * gm.sustainability_score * 10
        - 0.2 * ma.cost_delta_pct, 2)                      AS score,
    RANK() OVER (
        PARTITION BY tm.material_id
        ORDER BY (0.5 * ma.co2_reduction_pct
                + 0.3 * gm.sustainability_score * 10
                - 0.2 * ma.cost_delta_pct) DESC
    )                                                       AS rank_within_material
FROM material_alternatives ma
JOIN traditional_materials tm ON tm.material_id = ma.traditional_material_id
JOIN green_materials gm       ON gm.material_id = ma.green_material_id;

-- ------------------------------------------------------------
-- Demo queries
-- All alternatives, best first within each traditional material:
--   SELECT traditional_material, green_material, score, rank_within_material
--   FROM material_recommendations ORDER BY traditional_id, rank_within_material;
-- Best pick only:
--   SELECT traditional_material, green_material, score
--   FROM material_recommendations WHERE rank_within_material = 1;
-- ------------------------------------------------------------
