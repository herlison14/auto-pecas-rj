import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sellsync/database'
import { NFeService } from '@sellsync/nfe'
import { nfeQueue } from '../workers/queues'
import { requireRole } from '../lib/rbac'

const nfeService = new NFeService()

const settingsSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos'),
  ie: z.string().optional(),
  razaoSocial: z.string().min(2),
  uf: z.string().length(2),
  crt: z.coerce.number().int().min(1).max(3),
  environment: z.enum(['homologacao', 'producao']).default('homologacao'),
  autoEmit: z.boolean().optional(),
  autoPrint: z.boolean().optional(),
})

export async function nfeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    await req.jwtVerify()
  })

  // Configurações fiscais do tenant
  app.get('/settings', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const settings = await prisma.nfeSettings.findUnique({ where: { tenantId } })
    return settings ?? {}
  })

  app.put('/settings', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const body = settingsSchema.parse(req.body)
    return prisma.nfeSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...body },
      update: body,
    })
  })

  // Emitir NF-e para um pedido
  app.post('/orders/:orderId/emit', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const { tenantId } = req.user as { tenantId: string }

    await nfeQueue.add('emit-nfe', { orderId, tenantId, action: 'emit' }, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })

    return reply.code(202).send({ message: 'NF-e em processamento', orderId })
  })

  // Cancelar NF-e
  app.post('/orders/:orderId/cancel', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const { tenantId } = req.user as { tenantId: string }
    const { reason } = z.object({ reason: z.string().min(15) }).parse(req.body)

    await nfeQueue.add('emit-nfe', { orderId, tenantId, action: 'cancel', reason }, { priority: 1 })
    return reply.code(202).send({ message: 'Cancelamento solicitado' })
  })

  // Emitir NF-e em lote
  app.post('/batch-emit', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { orderIds } = z.object({ orderIds: z.array(z.string()).min(1).max(100) }).parse(req.body)

    const jobs = await Promise.all(
      orderIds.map((orderId) =>
        nfeQueue.add('emit-nfe', { orderId, tenantId, action: 'emit' }, {
          priority: 2,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        })
      )
    )

    return reply.code(202).send({
      message: 'Emissão em lote iniciada',
      queued: jobs.length,
      orderIds,
    })
  })

  // Fila de impressão: NF-es autorizadas que ainda não foram impressas.
  // O frontend (AutoPrintAgent) consulta periodicamente e dispara a impressão.
  app.get('/print-queue', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    return prisma.order.findMany({
      where: { tenantId, nfeStatus: 'AUTHORIZED', nfePrintedAt: null },
      select: { id: true, externalId: true, buyerName: true, total: true, marketplace: true },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    })
  })

  // Marca a NF-e do pedido como impressa (chamado após disparar a impressão)
  app.post('/orders/:orderId/printed', async (req) => {
    const { orderId } = req.params as { orderId: string }
    const { tenantId } = req.user as { tenantId: string }
    await prisma.order.updateMany({
      where: { id: orderId, tenantId },
      data: { nfePrintedAt: new Date() },
    })
    return { ok: true }
  })

  // Download do PDF da NF-e
  app.get('/orders/:orderId/pdf', async (req, reply) => {
    const { orderId } = req.params as { orderId: string }
    const { tenantId } = req.user as { tenantId: string }

    const order = await prisma.order.findFirstOrThrow({ where: { id: orderId, tenantId } })
    if (!order.nfeKey) return reply.code(404).send({ message: 'NF-e não encontrada' })

    const pdf = await nfeService.getPdf(order.nfeKey)
    return reply.type('application/pdf').send(pdf)
  })
}
