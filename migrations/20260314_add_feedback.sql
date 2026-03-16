-- Create feedback table if it doesn't exist (required for feedback API).
-- In production, TypeORM synchronize is disabled, so this table must be created via migration.
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  rating TINYINT NOT NULL,
  feedback TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_feedback_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
