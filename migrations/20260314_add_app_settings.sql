-- Create app_settings table if it doesn't exist (required for app-settings API).
-- In production, TypeORM synchronize is disabled, so this table must be created via migration.
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  value VARCHAR(500) NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
