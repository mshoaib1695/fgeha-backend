/**
 * Sentry SDK (optional). Must run before any other application code.
 * Uses @sentry/nestjs everywhere for proper request context and scope isolation.
 * When SENTRY_DSN is unset, the SDK is not initialized.
 * @see https://docs.sentry.io/platforms/javascript/guides/nestjs/
 */
import * as Sentry from '@sentry/nestjs';

const env = process.env.NODE_ENV ?? 'development';
const isProduction = env === 'production';
const dsn = process.env.SENTRY_DSN?.trim() || undefined;

if (dsn) {
  try {
    const tracesSampleRate =
      process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
        ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
        : isProduction
          ? 0.05
          : 1.0;

    Sentry.init({
      dsn,
      environment: env,
      release: process.env.APP_VERSION || undefined,
      tracesSampleRate,
      debug: process.env.SENTRY_DEBUG === 'true',
    });

    Sentry.setTag('service', 'geha-backend');
  } catch (err) {
    console.warn('[Sentry] Init failed:', err instanceof Error ? err.message : err);
  }
}
