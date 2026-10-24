-- ============================================================
-- EcoBuild Exchange — Advanced Database Features
-- Views + GIN index already exist in schema.sql.
-- This file adds: stored function, triggers, a stored procedure,
-- and a transaction-safe marketplace purchase routine.
--
-- Together with schema.sql's views + GIN index + the NoSQL
-- aggregation in database/nosql/vendor_sync.py, this covers the
-- required >=4 advanced SQL features + >=1 NoSQL feature:
--   1. Views                  (schema.sql)
--   2. Full-text index (GIN)  (schema.sql)
--   3. Stored function        (fn_calculate_carbon_savings, below)
--   4. Triggers               (trg_recalc_carbon, trg_enforce_referral, below)
--   5. Transactions           (sp_purchase_listing, below — bonus)
--   + NoSQL aggregation       (database/nosql/vendor_sync.py)
-- ============================================================


-- ------------------------------------------------------------
-- FEATURE: Stored function — carbon savings calculator
--
-- Baseline assumption: material_alternatives.co2_reduction_pct is the
-- % CO2 reduction of the green material vs. its traditional equivalent.
-- So the implied traditional baseline per unit is:
--     baseline_co2 = green_co2 / (1 - reduction_pct/100)
-- and the CO2 saved per unit is (baseline_co2 - green_co2).
-- This upserts one row per project into carbon_reports.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_carbon_savings(p_project_id INT)
RETURNS TABLE(co2_saved NUMERIC, cost NUMERIC) AS $$
DECLARE
    v_co2_saved  NUMERIC(12,2) := 0;
    v_total_cost NUMERIC(12,2) := 0;
BEGIN
    SELECT
        COALESCE(SUM(
            pm.quantity * (
                CASE
                    WHEN ma.co2_reduction_pct IS NOT NULL AND ma.co2_reduction_pct < 100
                        THEN (gm.co2_per_unit / (1 - ma.co2_reduction_pct / 100.0)) - gm.co2_per_unit
                    ELSE 0
                END
            )
        ), 0),
        COALESCE(SUM(pm.quantity * gm.cost_per_unit), 0)
    INTO v_co2_saved, v_total_cost
    FROM project_materials pm
    JOIN green_materials gm ON gm.material_id = pm.material_id
    LEFT JOIN material_alternatives ma ON ma.green_material_id = gm.material_id
    WHERE pm.project_id = p_project_id;

    INSERT INTO carbon_reports (project_id, total_co2_saved, total_cost, generated_at)
    VALUES (p_project_id, v_co2_saved, v_total_cost, CURRENT_TIMESTAMP);

    RETURN QUERY SELECT v_co2_saved, v_total_cost;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- FEATURE: Trigger — auto-recalculate carbon_reports whenever a
-- project's material list changes (insert/update/delete on
-- project_materials). Keeps carbon_reports always in sync instead
-- of relying on someone remembering to call the function manually.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_recalc_carbon()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM fn_calculate_carbon_savings(OLD.project_id);
        RETURN OLD;
    ELSE
        PERFORM fn_calculate_carbon_savings(NEW.project_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_carbon ON project_materials;
CREATE TRIGGER trg_recalc_carbon
AFTER INSERT OR UPDATE OR DELETE ON project_materials
FOR EACH ROW EXECUTE FUNCTION trg_fn_recalc_carbon();


-- ------------------------------------------------------------
-- FEATURE: Trigger — data-integrity guard. If a furniture listing's
-- status is ever set to 'Referred' without a matching row already
-- in junkyard_referrals, auto-create one (round-robin: lowest
-- junkyard_id). Prevents the "Referred but no referral record"
-- inconsistent state the earlier manual seed data could have caused.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_enforce_referral()
RETURNS TRIGGER AS $$
DECLARE
    v_junkyard_id INT;
BEGIN
    IF NEW.status = 'Referred' AND NOT EXISTS (
        SELECT 1 FROM junkyard_referrals WHERE listing_id = NEW.listing_id
    ) THEN
        SELECT junkyard_id INTO v_junkyard_id FROM junkyards ORDER BY junkyard_id LIMIT 1;
        IF v_junkyard_id IS NOT NULL THEN
            INSERT INTO junkyard_referrals (listing_id, junkyard_id)
            VALUES (NEW.listing_id, v_junkyard_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_referral ON furniture_listings;
CREATE TRIGGER trg_enforce_referral
AFTER UPDATE OF status ON furniture_listings
FOR EACH ROW EXECUTE FUNCTION trg_fn_enforce_referral();


-- ------------------------------------------------------------
-- FEATURE: Stored procedure — the actual 90-day junkyard automation.
-- Triggers only fire when a row is written to, so they can't catch
-- listings that simply sit untouched past 90 days. This procedure
-- is the batch sweep meant to run on a schedule (cron / pg_cron /
-- app-level scheduled job) to find and refer every listing that has
-- silently aged past the cutoff.
-- ------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_refer_expired_listings()
LANGUAGE plpgsql AS $$
DECLARE
    rec RECORD;
    v_junkyard_id INT;
    v_count INT := 0;
BEGIN
    FOR rec IN
        SELECT listing_id FROM furniture_listings
        WHERE status = 'Active'
          AND posted_at + INTERVAL '90 days' <= CURRENT_TIMESTAMP
    LOOP
        SELECT junkyard_id INTO v_junkyard_id FROM junkyards ORDER BY junkyard_id LIMIT 1;
        IF v_junkyard_id IS NOT NULL THEN
            INSERT INTO junkyard_referrals (listing_id, junkyard_id)
            VALUES (rec.listing_id, v_junkyard_id);
            UPDATE furniture_listings SET status = 'Referred' WHERE listing_id = rec.listing_id;
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'sp_refer_expired_listings: referred % listing(s)', v_count;
END;
$$;


-- ------------------------------------------------------------
-- FEATURE: Transaction — atomic marketplace purchase. Inserting the
-- transaction row and flipping the listing to Sold must both happen
-- or neither does (e.g. if the listing was already sold by someone
-- else between page load and checkout, roll back cleanly).
-- ------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_purchase_listing(
    p_listing_id INT,
    p_buyer_id INT,
    p_price NUMERIC
)
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status FROM furniture_listings
    WHERE listing_id = p_listing_id
    FOR UPDATE;  -- lock the row for the duration of this transaction

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Listing % does not exist', p_listing_id;
    ELSIF v_status <> 'Active' THEN
        RAISE EXCEPTION 'Listing % is not available (status: %)', p_listing_id, v_status;
    END IF;

    INSERT INTO furniture_transactions (listing_id, buyer_id, price)
    VALUES (p_listing_id, p_buyer_id, p_price);

    UPDATE furniture_listings SET status = 'Sold' WHERE listing_id = p_listing_id;

    -- Both statements commit together as part of the calling transaction;
    -- if either fails, the exception propagates and nothing is applied.
END;
$$;
