-- Add header icon for request type options (Ionicons name or emoji). Shown in app screen header.
ALTER TABLE request_type_options
  ADD COLUMN header_icon VARCHAR(80) NULL AFTER image_url;
