-- Create news table if it doesn't exist (e.g. when TypeORM synchronize was never run).
CREATE TABLE IF NOT EXISTS news (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  content LONGTEXT NULL,
  image_url VARCHAR(512) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  open_detail TINYINT(1) NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add open_detail column if table exists but column doesn't (e.g. table created before this migration).
ALTER TABLE news
  ADD COLUMN open_detail TINYINT(1) NOT NULL DEFAULT 1;
