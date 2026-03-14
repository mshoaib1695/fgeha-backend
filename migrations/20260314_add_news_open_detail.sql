-- News carousel: when true, tapping the slide opens the detail page. Default 1 (true).
ALTER TABLE news
  ADD COLUMN open_detail TINYINT(1) NOT NULL DEFAULT 1;
