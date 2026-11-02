-- T4: Associate each vendor with their user account.
ALTER TABLE vendors
ADD COLUMN owner_user_id INT REFERENCES users(user_id);