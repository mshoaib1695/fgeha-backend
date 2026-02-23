-- Add password reset code columns for forgot-password flow
ALTER TABLE users ADD COLUMN password_reset_code VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN password_reset_code_expires_at DATETIME NULL;
