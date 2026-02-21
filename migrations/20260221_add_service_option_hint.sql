-- Add hint text for option list (e.g. "Submit a request"). Shown under option label in app.
ALTER TABLE request_type_options
  ADD COLUMN hint VARCHAR(120) NULL AFTER header_icon;
