import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,

  beforeSend(event) {
    // Não envia erros em dev a menos que explicitamente habilitado
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
      return null
    }
    return event
  },
})
