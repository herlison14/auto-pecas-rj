import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BillingService, PLANS, type PlanKey } from '../services/billing.service'

const service = new BillingService()

export async function billingRoutes(app: FastifyInstance) {
  // Webhook do Asaas — sem JWT, verificado pelo access_token header
  app.post('/webhook', async (req, reply) => {
    const token = req.headers['asaas-access-token'] as string | undefined
    try {
      const result = await service.handleWebhook(req.body as Record<string, unknown>, token)
      return result
    } catch (err: any) {
      app.log.error(err)
      return reply.code(400).send({ error: err.message ?? 'Webhook error' })
    }
  })

  // Rotas autenticadas
  app.addHook('preHandler', async (req, reply) => {
    if (req.routeOptions?.url === '/billing/webhook') return
    await req.jwtVerify()
  })

  app.get('/plan', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    return service.getCurrentPlan(tenantId)
  })

  app.get('/plans', async () => {
    return Object.entries(PLANS).map(([key, plan]) => ({ key, ...plan }))
  })

  app.post('/checkout', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { plan } = z.object({ plan: z.enum(['STARTER', 'GROWTH', 'PRO']) }).parse(req.body)
    try {
      return await service.createCheckoutSession(tenantId, plan as PlanKey)
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })

  app.post('/cancel', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    try {
      return await service.cancelSubscription(tenantId)
    } catch (err: any) {
      return reply.code(400).send({ error: err.message })
    }
  })
}
