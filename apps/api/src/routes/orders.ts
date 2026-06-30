import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { OrderService } from '../services/order.service'

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  marketplace: z.string().optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export async function ordersRoutes(app: FastifyInstance) {
  const service = new OrderService()

  app.addHook('onRequest', async (req) => {
    await req.jwtVerify()
  })

  app.get('/', async (req) => {
    const query = listQuerySchema.parse(req.query)
    const tenantId = (req.user as { tenantId: string }).tenantId
    return service.list({ tenantId, ...query })
  })

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    return service.findById({ tenantId, id })
  })

  app.post('/:id/invoice', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    const result = await service.emitInvoice({ tenantId, orderId: id })
    return reply.code(202).send(result)
  })

  app.post('/:id/ship', async (req) => {
    const { id } = req.params as { id: string }
    const body = z.object({
      trackingCode: z.string().optional(),
      carrier: z.string().optional(),
    }).parse(req.body ?? {})
    const tenantId = (req.user as { tenantId: string }).tenantId
    return service.markShipped({ tenantId, orderId: id, ...body })
  })

  app.get('/:id/label', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    try {
      const pdf = await service.getShippingLabel({ tenantId, orderId: id })
      return reply.type('application/pdf').send(pdf)
    } catch (err) {
      const { LabelNotSupportedError } = await import('../services/order.service')
      if (err instanceof LabelNotSupportedError) {
        return reply.code(501).send({ error: 'NOT_SUPPORTED', message: err.message })
      }
      throw err
    }
  })

  app.post('/bulk/print-labels', async (req, reply) => {
    const body = z.object({ orderIds: z.array(z.string()).min(1).max(100) }).parse(req.body)
    const tenantId = (req.user as { tenantId: string }).tenantId
    const pdf = await service.printLabels({ tenantId, orderIds: body.orderIds })
    return reply.type('application/pdf').send(pdf)
  })
}
