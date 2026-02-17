-- Migration: Add service-option based request tracking and numbering
-- Date: 2026-02-16
-- Target: MySQL 8+
--
-- What this does:
-- 1) Adds requests.request_type_option_id (nullable FK to request_type_options.id)
-- 2) Adds per-service-option request numbering fields to request_type_options:
--    - request_number_prefix
--    - request_number_padding
--    - request_number_next

START TRANSACTION;

-- 1) requests.request_type_option_id
ALTER TABLE `requests`
  ADD COLUMN `request_type_option_id` INT NULL AFTER `request_type_id`;

CREATE INDEX `idx_requests_request_type_option_id`
  ON `requests` (`request_type_option_id`);

ALTER TABLE `requests`
  ADD CONSTRAINT `fk_requests_request_type_option_id`
  FOREIGN KEY (`request_type_option_id`)
  REFERENCES `request_type_options` (`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 2) request_type_options numbering fields
ALTER TABLE `request_type_options`
  ADD COLUMN `request_number_prefix` VARCHAR(20) NULL AFTER `option_type`,
  ADD COLUMN `request_number_padding` INT NOT NULL DEFAULT 4 AFTER `request_number_prefix`,
  ADD COLUMN `request_number_next` INT NOT NULL DEFAULT 1 AFTER `request_number_padding`;

-- Safety normalization for existing rows (if any)
UPDATE `request_type_options`
SET
  `request_number_padding` = CASE
    WHEN `request_number_padding` IS NULL OR `request_number_padding` < 1 THEN 4
    WHEN `request_number_padding` > 12 THEN 12
    ELSE `request_number_padding`
  END,
  `request_number_next` = CASE
    WHEN `request_number_next` IS NULL OR `request_number_next` < 1 THEN 1
    ELSE `request_number_next`
  END;

COMMIT;

-- Rollback reference (manual):
-- ALTER TABLE `requests` DROP FOREIGN KEY `fk_requests_request_type_option_id`;
-- DROP INDEX `idx_requests_request_type_option_id` ON `requests`;
-- ALTER TABLE `requests` DROP COLUMN `request_type_option_id`;
-- ALTER TABLE `request_type_options`
--   DROP COLUMN `request_number_next`,
--   DROP COLUMN `request_number_padding`,
--   DROP COLUMN `request_number_prefix`;
