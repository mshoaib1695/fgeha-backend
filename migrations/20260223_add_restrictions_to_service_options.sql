-- Move duplicate restriction, request open window, and allowed days from request_type to service option (request_type_options).
-- These apply per service option (e.g. only "Order water tanker") not per request type (e.g. "Water").

ALTER TABLE request_type_options
  ADD COLUMN duplicate_restriction_period VARCHAR(10) NULL DEFAULT 'none',
  ADD COLUMN restriction_start_time VARCHAR(5) NULL,
  ADD COLUMN restriction_end_time VARCHAR(5) NULL,
  ADD COLUMN restriction_days VARCHAR(20) NULL;
