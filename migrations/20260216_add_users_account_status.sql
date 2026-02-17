-- Migration: add users.account_status for deactivation flow
-- Date: 2026-02-16

START TRANSACTION;

SET @has_account_status := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'account_status'
);

SET @sql := IF(
  @has_account_status > 0,
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `account_status` ENUM(''active'',''deactivated'') NOT NULL DEFAULT ''active'' AFTER `approvalStatus`'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT;
