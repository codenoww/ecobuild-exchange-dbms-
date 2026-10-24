-- ============================================================
-- EcoBuild Exchange — DML Operations & Query Demonstrations
-- Covers: INSERT, UPDATE, DELETE, SELECT, JOIN, GROUP BY,
-- HAVING, ORDER BY, aggregate functions, subqueries
-- ============================================================

-- ------------------------------------------------------------
-- 1. INSERT — new user signs up, immediately creates a project
-- ------------------------------------------------------------
INSERT INTO users (role_id, name, email, password_hash)
VALUES (3, 'Kavya Iyer', 'kavya.iyer@mail.com', '$2b$12$hash_user_005')
RETURNING user_id, name;

INSERT INTO projects (user_id, title, style, budget)
VALUES (
    (SELECT user_id FROM users WHERE email = 'kavya.iyer@mail.com'),
    'Rooftop Pergola', 'Modern', 150000.00
)
RETURNING project_id, title;

-- ------------------------------------------------------------
-- 2. UPDATE — vendor adjusts a listing price
-- ------------------------------------------------------------
UPDATE vendor_listings
SET price = 7.00, last_synced = CURRENT_TIMESTAMP
WHERE vendor_id = 1 AND material_id = 1
RETURNING listing_id, price;

-- UPDATE — mark a furniture listing as sold after a transaction
UPDATE furniture_listings
SET status = 'Sold'
WHERE listing_id = 1
RETURNING listing_id, status;

-- ------------------------------------------------------------
-- 3. DELETE — remove a stale vendor listing (duplicate/expired offer)
-- ------------------------------------------------------------
DELETE FROM vendor_listings
WHERE vendor_id = 3 AND material_id = 1
RETURNING listing_id;

-- ------------------------------------------------------------
-- 4. SELECT + JOIN — full recommendation view: traditional material,
--    its green alternative, and the CO2/cost impact
-- ------------------------------------------------------------
SELECT
    tm.name            AS traditional_material,
    gm.name            AS green_alternative,
    ma.co2_reduction_pct,
    ma.cost_delta_pct,
    gm.sustainability_score
FROM material_alternatives ma
JOIN traditional_materials tm ON tm.material_id = ma.traditional_material_id
JOIN green_materials gm       ON gm.material_id = ma.green_material_id
ORDER BY ma.co2_reduction_pct DESC;

-- ------------------------------------------------------------
-- 5. SELECT + multi-way JOIN — cheapest vendor per green material
-- ------------------------------------------------------------
SELECT
    gm.name       AS material_name,
    v.name        AS vendor_name,
    vl.price,
    vl.url
FROM vendor_listings vl
JOIN green_materials gm ON gm.material_id = vl.material_id
JOIN vendors v           ON v.vendor_id   = vl.vendor_id
ORDER BY gm.name, vl.price ASC;

-- ------------------------------------------------------------
-- 6. GROUP BY + aggregate functions — total CO2 saved and spend per project
-- ------------------------------------------------------------
SELECT
    p.title,
    u.name                       AS owner,
    SUM(pm.quantity)             AS total_material_units,
    COUNT(DISTINCT pm.material_id) AS distinct_materials_used
FROM projects p
JOIN users u              ON u.user_id = p.user_id
JOIN project_materials pm ON pm.project_id = p.project_id
GROUP BY p.project_id, p.title, u.name
ORDER BY total_material_units DESC;

-- ------------------------------------------------------------
-- 7. GROUP BY + HAVING — users with more than one active furniture listing
-- ------------------------------------------------------------
SELECT
    u.name,
    COUNT(*) AS active_listings
FROM furniture_listings fl
JOIN users u ON u.user_id = fl.seller_id
WHERE fl.status = 'Active'
GROUP BY u.user_id, u.name
HAVING COUNT(*) > 1
ORDER BY active_listings DESC;

-- ------------------------------------------------------------
-- 8. Aggregate — average vendor price and listing count per material
-- ------------------------------------------------------------
SELECT
    gm.name,
    ROUND(AVG(vl.price), 2) AS avg_price,
    COUNT(vl.listing_id)    AS vendor_count,
    MIN(vl.price)           AS lowest_price,
    MAX(vl.price)           AS highest_price
FROM green_materials gm
LEFT JOIN vendor_listings vl ON vl.material_id = gm.material_id
GROUP BY gm.material_id, gm.name
ORDER BY avg_price DESC NULLS LAST;

-- ------------------------------------------------------------
-- 9. Subquery (scalar) — materials cheaper than the overall average price
-- ------------------------------------------------------------
SELECT name, cost_per_unit
FROM green_materials
WHERE cost_per_unit < (
    SELECT AVG(cost_per_unit) FROM green_materials
)
ORDER BY cost_per_unit;

-- ------------------------------------------------------------
-- 10. Subquery (correlated) — projects whose carbon savings exceed
--     the average savings across all projects
-- ------------------------------------------------------------
SELECT p.title, cr.total_co2_saved
FROM projects p
JOIN carbon_reports cr ON cr.project_id = p.project_id
WHERE cr.total_co2_saved > (
    SELECT AVG(total_co2_saved) FROM carbon_reports
)
ORDER BY cr.total_co2_saved DESC;

-- ------------------------------------------------------------
-- 11. Subquery (IN) — furniture listings with zero transactions
--     (still unsold, candidates for the 90-day junkyard rule)
-- ------------------------------------------------------------
SELECT listing_id, title, posted_at, status
FROM furniture_listings
WHERE listing_id NOT IN (
    SELECT listing_id FROM furniture_transactions
)
ORDER BY posted_at ASC;

-- ------------------------------------------------------------
-- 12. ORDER BY + LIMIT — top 3 most sustainable green materials
-- ------------------------------------------------------------
SELECT name, sustainability_score, co2_per_unit
FROM green_materials
ORDER BY sustainability_score DESC
LIMIT 3;
