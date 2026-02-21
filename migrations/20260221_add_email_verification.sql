-- Migration: add email verification columns to users
-- Date: 2026-02-21

START TRANSACTION;

SET @has_email_verified := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verified'
);

SET @sql := IF(
  @has_email_verified > 0,
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `email_verified` TINYINT(1) NOT NULL DEFAULT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_token := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'email_verification_token'
);

SET @sql2 := IF(
  @has_token > 0,
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `email_verification_token` VARCHAR(64) NULL AFTER `email_verified`, ADD COLUMN `email_verification_token_expires_at` DATETIME NULL AFTER `email_verification_token`'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

COMMIT;
