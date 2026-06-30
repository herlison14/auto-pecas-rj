import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PricingService } from '../services/pricing.service'
import type { Marketplace } from '@sellsync/database'
import { requireRole } from '../lib/rbac'

const ruleSchema = z.object({
  name: z.string().min(1),
  marketplace: z.enum(['MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU', 'AMERICANAS', 'SHEIN', 'TIKTOK_SHOP', 'SHOPIFY', 'NUVEMSHOP']).optional(),
  type: z.enum(['MARKUP_PERCENTAGE', 'MARGIN_PERCENTAGE', 'FIXED_ADDITION', 'FIXED_PRICE']),
  value: z.number().positive(),
  isActive: z.boolean().default(true),
})

const service = new PricingService()

export async function pricingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    await req.jwtVerify()
  })

  app.get('/rules', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    return service.listRules(tenantId)
  })

  app.post('/rules', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const body = ruleSchema.parse(req.body)
    const rule = await service.createRule(tenantId, body as Parameters<typeof service.createRule>[1])
    return reply.code(201).send(rule)
  })

  app.put('/rules/:id', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const { id } = req.params as { id: string }
    const body = ruleSchema.partial().parse(req.body)
    return service.updateRule(tenantId, id, body)
  })

  app.delete('/rules/:id', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { id } = req.params as { id: string }
    await service.deleteRule(tenantId, id)
    return reply.code(204).send()
  })

  // Simular preço final dado um custo base
  app.post('/simulate', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const body = z.object({
      basePrice: z.number().positive(),
      marketplace: z.string().optional(),
    }).parse(req.body)

    const finalPrice = await service.applyRules({
      tenantId,
      basePrice: body.basePrice,
      marketplace: body.marketplace as Marketplace | undefined,
    })

    return { basePrice: body.basePrice, finalPrice, margin: ((finalPrice - body.basePrice) / finalPrice * 100).toFixed(2) }
  })

  // Sincronizar preços de um produto em todos os canais
  app.post('/products/:productId/sync-prices', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const { productId } = req.params as { productId: string }
    const { baseCost } = z.object({ baseCost: z.number().positive() }).parse(req.body)
    return service.syncPricesForProduct(tenantId, productId, baseCost)
  })
}
