-- Outstanding payments + push notifications schema rollout
-- Safe to run multiple times with scripts/run-safe-migrations.js

-- 1) Users push token for Expo notifications
ALTER TABLE users
  ADD COLUMN push_token VARCHAR(255) NULL;

-- 2) House dues account table (one row per house account)
CREATE TABLE IF NOT EXISTS house_dues (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sub_sector_id INT NOT NULL,
  street_no VARCHAR(50) NOT NULL,
  house_no VARCHAR(50) NOT NULL,
  water_conservancy_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  occupancy_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notice_message TEXT NULL,
  notice_issued_at DATETIME NULL,
  grace_days INT NOT NULL DEFAULT 30,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_by_admin_id INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_house_dues_house_unique
  ON house_dues (sub_sector_id, street_no, house_no);

-- Backfill missing columns for partially-created environments
ALTER TABLE house_dues
  ADD COLUMN notice_issued_at DATETIME NULL;
ALTER TABLE house_dues
  ADD COLUMN grace_days INT NOT NULL DEFAULT 30;
ALTER TABLE house_dues
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE house_dues
  ADD COLUMN updated_by_admin_id INT NULL;

-- 3) Ledger entries for immutable accounting records
CREATE TABLE IF NOT EXISTS house_due_entries (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  house_due_id INT NOT NULL,
  entry_type VARCHAR(20) NOT NULL,
  category VARCHAR(100) NULL,
  amount DECIMAL(12,2) NOT NULL,
  signed_amount DECIMAL(12,2) NOT NULL,
  reference VARCHAR(100) NULL,
  note TEXT NULL,
  created_by_admin_id INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_house_due_entries_house_due_id
  ON house_due_entries (house_due_id);

-- Backfill missing columns for partially-created environments
ALTER TABLE house_due_entries
  ADD COLUMN signed_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE house_due_entries
  ADD COLUMN reference VARCHAR(100) NULL;
ALTER TABLE house_due_entries
  ADD COLUMN note TEXT NULL;
ALTER TABLE house_due_entries
  ADD COLUMN created_by_admin_id INT NULL;

-- 4) Dynamic categories for charge/payment selection
CREATE TABLE IF NOT EXISTS house_due_categories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  usage VARCHAR(20) NOT NULL DEFAULT 'both',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_admin_id INT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_house_due_categories_name_unique
  ON house_due_categories (name);

-- Backfill missing columns for partially-created environments
ALTER TABLE house_due_categories
  ADD COLUMN usage VARCHAR(20) NOT NULL DEFAULT 'both';
ALTER TABLE house_due_categories
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE house_due_categories
  ADD COLUMN created_by_admin_id INT NULL;

-- 5) Seed app settings keys used by dues flow (if absent)
INSERT IGNORE INTO app_settings (`key`, value)
VALUES ('payment_blocking_mode', 'blockAfterGracePeriod');

INSERT IGNORE INTO app_settings (`key`, value)
VALUES ('payment_grace_days_default', '30');

INSERT IGNORE INTO app_settings (`key`, value)
VALUES ('dues_support_email', '');

INSERT IGNORE INTO app_settings (`key`, value)
VALUES ('dues_support_phone', '');
