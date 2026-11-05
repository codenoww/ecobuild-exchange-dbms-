-- T4: Associate each vendor with their user account.
-- Run after advanced_features.sql.

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_owner_user_id_unique
ON vendors(owner_user_id);
