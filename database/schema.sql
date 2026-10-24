-- ============================================================
-- EcoBuild Exchange — Relational Schema DDL
-- Covers: green material advisor + circular furniture marketplace
-- ============================================================

DROP TABLE IF EXISTS junkyard_referrals CASCADE;
DROP TABLE IF EXISTS furniture_transactions CASCADE;
DROP TABLE IF EXISTS furniture_listings CASCADE;
DROP TABLE IF EXISTS junkyards CASCADE;
DROP TABLE IF EXISTS carbon_reports CASCADE;
DROP TABLE IF EXISTS project_materials CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS vendor_listings CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS material_alternatives CASCADE;
DROP TABLE IF EXISTS green_materials CASCADE;
DROP TABLE IF EXISTS traditional_materials CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ------------------------------------------------------------
-- 1. ROLES  (role-based access: Admin, Vendor, Buyer/Seller)
-- ------------------------------------------------------------
CREATE TABLE roles (
    role_id     SERIAL PRIMARY KEY,
    role_name   VARCHAR(30) NOT NULL UNIQUE
        CHECK (role_name IN ('Admin', 'Vendor', 'BuyerSeller'))
);

-- ------------------------------------------------------------
-- 2. USERS
-- ------------------------------------------------------------
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    role_id        INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 3. TRADITIONAL_MATERIALS  &  GREEN_MATERIALS
-- ------------------------------------------------------------
CREATE TABLE traditional_materials (
    material_id  SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    category     VARCHAR(50) NOT NULL
);

CREATE TABLE green_materials (
    material_id           SERIAL PRIMARY KEY,
    name                   VARCHAR(100) NOT NULL,
    category               VARCHAR(50) NOT NULL,
    co2_per_unit           NUMERIC(10,2) NOT NULL CHECK (co2_per_unit >= 0),
    cost_per_unit          NUMERIC(10,2) NOT NULL CHECK (cost_per_unit >= 0),
    sustainability_score   NUMERIC(4,2) CHECK (sustainability_score BETWEEN 0 AND 10)
);

-- ------------------------------------------------------------
-- 4. MATERIAL_ALTERNATIVES (maps traditional -> green option)
-- ------------------------------------------------------------
CREATE TABLE material_alternatives (
    alt_id                    SERIAL PRIMARY KEY,
    traditional_material_id   INT NOT NULL REFERENCES traditional_materials(material_id) ON DELETE CASCADE,
    green_material_id         INT NOT NULL REFERENCES green_materials(material_id) ON DELETE CASCADE,
    co2_reduction_pct         NUMERIC(5,2) NOT NULL CHECK (co2_reduction_pct BETWEEN 0 AND 100),
    cost_delta_pct            NUMERIC(6,2) NOT NULL,
    UNIQUE (traditional_material_id, green_material_id)
);

-- ------------------------------------------------------------
-- 5. VENDORS  &  VENDOR_LISTINGS
-- ------------------------------------------------------------
CREATE TABLE vendors (
    vendor_id   SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    website     VARCHAR(255),
    location    VARCHAR(150)
);

CREATE TABLE vendor_listings (
    listing_id     SERIAL PRIMARY KEY,
    vendor_id      INT NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    material_id    INT NOT NULL REFERENCES green_materials(material_id) ON DELETE CASCADE,
    price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    url            VARCHAR(500),
    last_synced    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 6. PROJECTS  &  PROJECT_MATERIALS (junction)
-- ------------------------------------------------------------
CREATE TABLE projects (
    project_id   SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title        VARCHAR(150) NOT NULL,
    style        VARCHAR(80),
    budget       NUMERIC(12,2) CHECK (budget >= 0),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_materials (
    project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    material_id  INT NOT NULL REFERENCES green_materials(material_id) ON DELETE CASCADE,
    quantity     NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (project_id, material_id)
);

-- ------------------------------------------------------------
-- 7. CARBON_REPORTS
-- ------------------------------------------------------------
CREATE TABLE carbon_reports (
    report_id          SERIAL PRIMARY KEY,
    project_id         INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    total_co2_saved    NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
    generated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 8. FURNITURE_LISTINGS  (marketplace)
-- ------------------------------------------------------------
CREATE TABLE furniture_listings (
    listing_id   SERIAL PRIMARY KEY,
    seller_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title        VARCHAR(150) NOT NULL,
    category     VARCHAR(60) NOT NULL,
    condition    VARCHAR(30) NOT NULL CHECK (condition IN ('New','Like New','Good','Fair','Poor')),
    price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    status       VARCHAR(20) NOT NULL DEFAULT 'Active'
        CHECK (status IN ('Active','Sold','Expired','Referred')),
    posted_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 9. FURNITURE_TRANSACTIONS
-- ------------------------------------------------------------
CREATE TABLE furniture_transactions (
    txn_id       SERIAL PRIMARY KEY,
    listing_id   INT NOT NULL REFERENCES furniture_listings(listing_id) ON DELETE CASCADE,
    buyer_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    txn_date     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 10. JUNKYARDS  &  JUNKYARD_REFERRALS
-- ------------------------------------------------------------
CREATE TABLE junkyards (
    junkyard_id          SERIAL PRIMARY KEY,
    name                 VARCHAR(120) NOT NULL,
    location             VARCHAR(150),
    accepted_categories  VARCHAR(255),
    contact              VARCHAR(100)
);

CREATE TABLE junkyard_referrals (
    referral_id   SERIAL PRIMARY KEY,
    listing_id    INT NOT NULL REFERENCES furniture_listings(listing_id) ON DELETE CASCADE,
    junkyard_id   INT NOT NULL REFERENCES junkyards(junkyard_id) ON DELETE CASCADE,
    referred_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_role            ON users(role_id);
CREATE INDEX idx_vendor_listings_mat   ON vendor_listings(material_id);
CREATE INDEX idx_project_materials_mat ON project_materials(material_id);
CREATE INDEX idx_furniture_status      ON furniture_listings(status);
CREATE INDEX idx_furniture_posted_at   ON furniture_listings(posted_at);
CREATE INDEX idx_furniture_search      ON furniture_listings USING GIN (to_tsvector('english', title || ' ' || category));

-- ============================================================
-- VIEW: vendor price comparison per green material
-- ============================================================
CREATE VIEW vendor_price_comparison AS
SELECT
    gm.material_id,
    gm.name          AS material_name,
    v.name           AS vendor_name,
    vl.price,
    vl.url,
    vl.last_synced
FROM vendor_listings vl
JOIN green_materials gm ON gm.material_id = vl.material_id
JOIN vendors v           ON v.vendor_id   = vl.vendor_id
ORDER BY gm.material_id, vl.price ASC;

-- ============================================================
-- VIEW: listings approaching the 90-day junkyard cutoff
-- ============================================================
CREATE VIEW listings_nearing_expiry AS
SELECT
    listing_id,
    title,
    seller_id,
    posted_at,
    (posted_at + INTERVAL '90 days') AS expires_on,
    status
FROM furniture_listings
WHERE status = 'Active'
  AND posted_at + INTERVAL '90 days' <= CURRENT_TIMESTAMP + INTERVAL '7 days';
