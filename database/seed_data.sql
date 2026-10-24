-- ============================================================
-- EcoBuild Exchange — Seed Data
-- Inserted in FK-safe order (parents before children)
-- ============================================================

-- 1. ROLES
INSERT INTO roles (role_name) VALUES
    ('Admin'),
    ('Vendor'),
    ('BuyerSeller');

-- 2. USERS
INSERT INTO users (role_id, name, email, password_hash) VALUES
    (1, 'Anushka Admin',   'admin@ecobuild.com',    '$2b$12$hash_admin_001'),
    (2, 'GreenBuild Co',   'sales@greenbuild.com',  '$2b$12$hash_vendor_001'),
    (2, 'EcoTimber Supply','contact@ecotimber.com', '$2b$12$hash_vendor_002'),
    (3, 'Rahul Mehta',     'rahul.mehta@mail.com',  '$2b$12$hash_user_001'),
    (3, 'Priya Nair',      'priya.nair@mail.com',   '$2b$12$hash_user_002'),
    (3, 'Arjun Shetty',    'arjun.shetty@mail.com', '$2b$12$hash_user_003'),
    (3, 'Divya Rao',       'divya.rao@mail.com',    '$2b$12$hash_user_004');

-- 3. TRADITIONAL_MATERIALS
INSERT INTO traditional_materials (name, category) VALUES
    ('Portland Cement',       'Structural'),
    ('Red Clay Brick',        'Masonry'),
    ('Virgin PVC Flooring',   'Flooring'),
    ('Steel Rebar (Virgin)',  'Structural'),
    ('Plywood (Standard)',    'Carpentry');

-- 4. GREEN_MATERIALS
INSERT INTO green_materials (name, category, co2_per_unit, cost_per_unit, sustainability_score) VALUES
    ('Fly Ash Cement',         'Structural', 0.45, 7.20, 8.5),
    ('Compressed Stabilized Earth Block', 'Masonry', 0.08, 5.50, 9.2),
    ('Bamboo Flooring',        'Flooring',   0.12, 6.80, 8.8),
    ('Recycled Steel Rebar',   'Structural', 0.60, 8.90, 7.9),
    ('Reclaimed Wood Panel',   'Carpentry',  0.05, 9.40, 9.5),
    ('Hempcrete Block',        'Structural', 0.10, 11.00, 9.0);

-- 5. MATERIAL_ALTERNATIVES
INSERT INTO material_alternatives (traditional_material_id, green_material_id, co2_reduction_pct, cost_delta_pct) VALUES
    (1, 1, 55.00, -12.50),  -- Portland Cement -> Fly Ash Cement
    (2, 2, 72.00,   5.00),  -- Red Clay Brick -> CSEB
    (3, 3, 68.00,  -8.00),  -- Virgin PVC -> Bamboo Flooring
    (4, 4, 40.00,  10.00),  -- Steel Rebar -> Recycled Steel
    (5, 5, 80.00,  15.00),  -- Plywood -> Reclaimed Wood
    (1, 6, 70.00,  22.00);  -- Portland Cement -> Hempcrete

-- 6. VENDORS
INSERT INTO vendors (name, website, location) VALUES
    ('GreenBuild Materials Co.', 'https://greenbuild.com',  'Bengaluru, KA'),
    ('EcoTimber Supply Chain',   'https://ecotimber.com',   'Mysuru, KA'),
    ('Sustainable Structures Ltd.', 'https://sustrux.in',   'Chennai, TN');

-- 7. VENDOR_LISTINGS
INSERT INTO vendor_listings (vendor_id, material_id, price, url) VALUES
    (1, 1, 7.20,  'https://greenbuild.com/flyash-cement'),
    (3, 1, 7.65,  'https://sustrux.in/flyash-cement'),
    (1, 2, 5.50,  'https://greenbuild.com/cseb-block'),
    (2, 3, 6.80,  'https://ecotimber.com/bamboo-flooring'),
    (3, 3, 7.10,  'https://sustrux.in/bamboo-flooring'),
    (3, 4, 8.90,  'https://sustrux.in/recycled-rebar'),
    (2, 5, 9.40,  'https://ecotimber.com/reclaimed-wood'),
    (1, 6, 11.00, 'https://greenbuild.com/hempcrete');

-- 8. PROJECTS
INSERT INTO projects (user_id, title, style, budget) VALUES
    (4, 'Weekend Cabin Build',        'Rustic',       450000.00),
    (5, 'Balcony Garden Deck',        'Minimalist',    85000.00),
    (6, 'Home Extension - Study Room','Contemporary', 620000.00),
    (4, 'Garage Workshop',            'Industrial',   210000.00);

-- 9. PROJECT_MATERIALS
INSERT INTO project_materials (project_id, material_id, quantity) VALUES
    (1, 2, 1200.00),  -- Cabin: CSEB blocks
    (1, 5, 300.00),   -- Cabin: Reclaimed wood
    (2, 3, 150.00),   -- Deck: Bamboo flooring
    (3, 1, 80.00),    -- Study room: Fly ash cement
    (3, 4, 500.00),   -- Study room: Recycled rebar
    (4, 6, 60.00);    -- Workshop: Hempcrete

-- 10. CARBON_REPORTS
INSERT INTO carbon_reports (project_id, total_co2_saved, total_cost) VALUES
    (1, 540.00, 393600.00),
    (2, 18.00,  10200.00),
    (3, 284.00, 452200.00),
    (4, 6.00,   66000.00);

-- 11. FURNITURE_LISTINGS
INSERT INTO furniture_listings (seller_id, title, category, condition, price, status, posted_at) VALUES
    (4, 'Solid Teak Dining Table',   'Dining',   'Good',      14500.00, 'Active',  CURRENT_TIMESTAMP - INTERVAL '10 days'),
    (5, 'Mid-Century Armchair',      'Seating',  'Like New',   6200.00, 'Active',  CURRENT_TIMESTAMP - INTERVAL '35 days'),
    (6, 'Oak Bookshelf',             'Storage',  'Fair',       3800.00, 'Sold',    CURRENT_TIMESTAMP - INTERVAL '50 days'),
    (7, 'Rattan Outdoor Set',        'Outdoor',  'Good',       9800.00, 'Active',  CURRENT_TIMESTAMP - INTERVAL '95 days'),
    (4, 'Vintage Writing Desk',      'Office',   'Poor',       2200.00, 'Active',  CURRENT_TIMESTAMP - INTERVAL '100 days'),
    (5, 'Queen Bed Frame',           'Bedroom',  'Good',      11000.00, 'Active',  CURRENT_TIMESTAMP - INTERVAL '2 days');

-- 12. FURNITURE_TRANSACTIONS
INSERT INTO furniture_transactions (listing_id, buyer_id, price, txn_date) VALUES
    (3, 7, 3600.00, CURRENT_TIMESTAMP - INTERVAL '20 days');

-- 13. JUNKYARDS
INSERT INTO junkyards (name, location, accepted_categories, contact) VALUES
    ('Bengaluru Scrap & Reclaim', 'Peenya, Bengaluru', 'Wood, Metal, Upholstery', '+91-80-4455-6677'),
    ('GreenCycle Junkyard',       'Yelahanka, Bengaluru', 'All furniture categories', '+91-80-9988-7766');

-- 14. JUNKYARD_REFERRALS (for listings already past 90 days)
INSERT INTO junkyard_referrals (listing_id, junkyard_id, referred_at) VALUES
    (4, 1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
    (5, 2, CURRENT_TIMESTAMP - INTERVAL '10 days');

UPDATE furniture_listings SET status = 'Referred' WHERE listing_id IN (4, 5);
