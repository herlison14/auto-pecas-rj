import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { BillingService, PLANS, type PlanKey } from '../services/billing.service'

const service = new BillingService()

export async function billingRoutes(app: FastifyInstance) {
  // Webhook do Stripe — sem autenticação JWT (usa assinatura Stripe)
  app.post('/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string
    try {
      const result = await service.handleWebhook(Buffer.from(JSON.stringify(req.body)), sig)
      return result
    } catch (err) {
      app.log.error(err)
      return reply.code(400).send({ error: 'Webhook signature invalid' })
    }
  })

  // Rotas autenticadas
  app.addHook('preHandler', async (req, reply) => {
    if (req.url === '/billing/webhook') return
    await req.jwtVerify()
  })

  app.get('/plan', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    return service.getCurrentPlan(tenantId)
  })

  app.get('/plans', async () => {
    return Object.entries(PLANS).map(([key, plan]) => ({ key, ...plan }))
  })

  app.post('/checkout', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const { plan } = z.object({ plan: z.enum(['STARTER', 'GROWTH', 'PRO']) }).parse(req.body)
    const baseUrl = process.env.WEB_URL ?? 'http://localhost:3000'
    return service.createCheckoutSession(
      tenantId,
      plan as PlanKey,
      `${baseUrl}/dashboard/settings?upgrade=success`,
      `${baseUrl}/dashboard/settings?upgrade=cancelled`,
    )
  })

  app.post('/portal', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const baseUrl = process.env.WEB_URL ?? 'http://localhost:3000'
    return service.createPortalSession(tenantId, `${baseUrl}/dashboard/settings`)
  })
}
