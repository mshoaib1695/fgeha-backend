-- Add slug for request type options to support robust report filtering.
ALTER TABLE request_type_options
  ADD COLUMN slug VARCHAR(120) NULL AFTER label;

-- Backfill existing rows from label.
UPDATE request_type_options
SET slug = LOWER(REPLACE(REPLACE(TRIM(label), ' ', '_'), '-', '_'))
WHERE slug IS NULL OR TRIM(slug) = '';

-- Safety fallback.
UPDATE request_type_options
SET slug = CONCAT('service_option_', id)
WHERE slug IS NULL OR TRIM(slug) = '';

-- Helpful index for report filters.
CREATE INDEX idx_request_type_options_slug ON request_type_options (slug);
