/**
 * Load .env before anything else so SENTRY_DSN (and other vars) are available.
 * Must be imported first in main.ts, before instrument.
 * Loads from process.cwd() – run the app from the backend root (where .env lives).
 */
import dotenv from 'dotenv';

dotenv.config();
