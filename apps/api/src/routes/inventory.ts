import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sellsync/database'
import { InventoryService } from '../services/inventory.service'
import { requireRole } from '../lib/rbac'

const adjustSchema = z.object({
  warehouseId: z.string(),
  quantity: z.number().int(),
  reason: z.string().optional(),
})

export async function inventoryRoutes(app: FastifyInstance) {
  const service = new InventoryService()

  app.addHook('onRequest', async (req) => {
    await req.jwtVerify()
  })

  app.get('/', async (req) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    const query = z.object({
      warehouseId: z.string().optional(),
      lowStock: z.coerce.boolean().optional(),
      search: z.string().optional(),
    }).parse(req.query)
    return service.list({ tenantId, ...query })
  })

  app.get('/:productId', async (req) => {
    const { productId } = req.params as { productId: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    return service.getByProduct({ tenantId, productId })
  })

  app.post('/:productId/adjust', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req) => {
    const { productId } = req.params as { productId: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    const body = adjustSchema.parse(req.body)
    return service.adjust({ tenantId, productId, ...body })
  })

  app.post('/sync', async (req, reply) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    await service.syncAllMarketplaces(tenantId)
    return reply.code(202).send({ message: 'Sync enqueued' })
  })

  app.get('/alerts/low-stock', async (req) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    return service.getLowStockAlerts(tenantId)
  })

  // Armazéns
  app.get('/warehouses', async (req) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    return prisma.warehouse.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' }, take: 50 })
  })

  app.post('/warehouses', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    const body = z.object({ name: z.string().min(2), address: z.record(z.unknown()).optional() }).parse(req.body)
    const count = await prisma.warehouse.count({ where: { tenantId } })
    const warehouse = await prisma.warehouse.create({ data: { tenantId, name: body.name, isDefault: count === 0, address: body.address as any } })
    return reply.code(201).send(warehouse)
  })
}
