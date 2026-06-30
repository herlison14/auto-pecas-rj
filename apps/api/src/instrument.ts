import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  includeLocalVariables: true,
  beforeSend(event, hint) {
    const err = hint?.originalException as { statusCode?: number } | undefined
    if (err?.statusCode && err.statusCode >= 400 && err.statusCode < 500) return null
    return event
  },
})
