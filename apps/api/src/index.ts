import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import helmet from '@fastify/helmet'

// Fail fast on misconfigured secrets — prevents predictable defaults reaching production
const REQUIRED_SECRETS = ['JWT_SECRET', 'DATABASE_URL'] as const
for (const key of REQUIRED_SECRETS) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}
if (process.env.JWT_SECRET === 'change-me-in-production') {
  throw new Error('JWT_SECRET must be changed from the default example value')
}
import { ordersRoutes } from './routes/orders'
import { inventoryRoutes } from './routes/inventory'
import { productsRoutes } from './routes/products'
import { integrationsRoutes } from './routes/integrations'
import { webhooksRoutes } from './routes/webhooks'
import { authRoutes } from './routes/auth'
import { nfeRoutes } from './routes/nfe'
import { pricingRoutes } from './routes/pricing'
import { reportsRoutes } from './routes/reports'
import { billingRoutes } from './routes/billing'
import { importRoutes } from './routes/import'
import { notificationsRoutes } from './routes/notifications'
import { teamRoutes } from './routes/team'
import { financialRoutes } from './routes/financial'
import { returnsRoutes } from './routes/returns'
import { performanceRoutes } from './routes/performance'
import { repricingRoutes } from './routes/repricing'
import { inAppNotificationsRoutes } from './routes/notifications.inapp'
import { catalogRoutes } from './routes/catalog'
import { suppliersRoutes } from './routes/suppliers'
import { listingsRoutes } from './routes/listings'
import { auditRoutes } from './routes/audit'
import { exportRoutes } from './routes/export'
import { emailSettingsRoutes } from './routes/email-settings'
import { customersRoutes } from './routes/customers'
import { twoFactorRoutes } from './routes/two-factor'
import { startWorkers } from './workers'

const app = Fastify({ logger: true })

async function bootstrap() {
  // Security headers — must be registered before routes
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })

  const webUrl = (process.env.WEB_URL ?? '').replace(/\/+$/, '') // normaliza barra final
  if (!webUrl) app.log.warn('WEB_URL not set — CORS restrito a *.vercel.app e localhost')
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // curl, healthchecks, server-to-server
      const normalized = origin.replace(/\/+$/, '')
      const ok =
        (webUrl && normalized === webUrl) ||
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(normalized) ||
        /^http:\/\/localhost(:\d+)?$/.test(normalized)
      cb(null, ok)
    },
  })
  await app.register(jwt, { secret: process.env.JWT_SECRET! })
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })

  // Observabilidade: Sentry opcional — só inicializa se SENTRY_DSN estiver definido
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/node')
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development' })
    app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
      if (!err.statusCode || err.statusCode >= 500) {
        Sentry.captureException(err, { extra: { url: req.url, method: req.method } })
      }
      app.log.error(err)
      const status = err.statusCode ?? 500
      reply.code(status).send({
        error: err.name ?? 'InternalServerError',
        message: status >= 500 ? 'Erro interno do servidor' : err.message,
      })
    })
    app.log.info('Sentry inicializado')
  }
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }) // 10 MB

  // Shared auth decorator — all routes using app.authenticate go through this
  app.decorate('authenticate', async function (req: any, reply: any) {
    try {
      await req.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })

  await app.register(authRoutes,         { prefix: '/auth' })
  await app.register(ordersRoutes,       { prefix: '/orders' })
  await app.register(inventoryRoutes,    { prefix: '/inventory' })
  await app.register(productsRoutes,     { prefix: '/products' })
  await app.register(integrationsRoutes, { prefix: '/integrations' })
  await app.register(webhooksRoutes,     { prefix: '/webhooks' })
  await app.register(nfeRoutes,          { prefix: '/nfe' })
  await app.register(pricingRoutes,      { prefix: '/pricing' })
  await app.register(reportsRoutes,      { prefix: '/reports' })
  await app.register(billingRoutes,      { prefix: '/billing' })
  await app.register(importRoutes,       { prefix: '/import' })
  await app.register(notificationsRoutes, { prefix: '/notifications' })
  await app.register(teamRoutes,          { prefix: '/team' })
  await app.register(financialRoutes,     { prefix: '/financial' })
  await app.register(returnsRoutes,       { prefix: '/returns' })
  await app.register(performanceRoutes,   { prefix: '/performance' })
  await app.register(repricingRoutes,           { prefix: '/repricing' })
  await app.register(inAppNotificationsRoutes,  { prefix: '/inbox' })
  await app.register(catalogRoutes,             { prefix: '/catalog' })
  await app.register(suppliersRoutes,           { prefix: '/suppliers' })
  await app.register(listingsRoutes,            { prefix: '/listings' })
  await app.register(auditRoutes,               { prefix: '/audit' })
  await app.register(exportRoutes,              { prefix: '/export' })
  await app.register(emailSettingsRoutes,       { prefix: '/email-settings' })
  await app.register(customersRoutes,           { prefix: '/customers' })
  await app.register(twoFactorRoutes,           { prefix: '/2fa' })

  // Health probe for load balancers / Kubernetes
  app.get('/healthz', async () => ({ status: 'ok', uptime: process.uptime() }))

  await startWorkers()

  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  app.log.error(err)
  process.exit(1)
})
