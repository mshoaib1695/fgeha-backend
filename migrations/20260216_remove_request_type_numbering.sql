-- Migration: remove request-type based request numbering columns
-- Date: 2026-02-16
-- Note: We now use service-option based numbering only.

START TRANSACTION;

-- Drop old request-type numbering columns if present
SET @has_prefix := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_types'
    AND COLUMN_NAME = 'request_number_prefix'
);
SET @sql := IF(@has_prefix > 0, 'ALTER TABLE `request_types` DROP COLUMN `request_number_prefix`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_padding := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_types'
    AND COLUMN_NAME = 'request_number_padding'
);
SET @sql := IF(@has_padding > 0, 'ALTER TABLE `request_types` DROP COLUMN `request_number_padding`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_next := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'request_types'
    AND COLUMN_NAME = 'request_number_next'
);
SET @sql := IF(@has_next > 0, 'ALTER TABLE `request_types` DROP COLUMN `request_number_next`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;
