import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sellsync/database'
import { logAudit } from '../services/audit.service'

export async function listingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => { await req.jwtVerify() })

  // GET /listings — cross-product view with filters
  app.get('/', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const { marketplace, status, search, page = '1', limit = '40' } = req.query as Record<string, string>

    const listings = await prisma.listing.findMany({
      where: {
        store: { tenantId },
        ...(marketplace && { store: { marketplace: marketplace as any } }),
        ...(status && { status: status as any }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
            { product: { sku: { contains: search, mode: 'insensitive' } } },
          ],
        }),
      },
      include: {
        store: { select: { id: true, name: true, marketplace: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    })

    const total = await prisma.listing.count({
      where: {
        store: { tenantId },
        ...(marketplace && { store: { marketplace: marketplace as any } }),
        ...(status && { status: status as any }),
      },
    })

    return { listings, total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
  })

  // PATCH /listings/:id — update title, price, status
  app.patch('/:id', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { id } = req.params as { id: string }
    const body = z.object({
      title: z.string().min(1).optional(),
      price: z.number().positive().optional(),
      status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED']).optional(),
    }).parse(req.body)

    const listing = await prisma.listing.findFirst({
      where: { id, store: { tenantId } },
    })
    if (!listing) return reply.code(404).send({ error: 'Anúncio não encontrado' })

    const before = { price: listing.price, status: listing.status, title: listing.title }
    const updated = await prisma.listing.update({ where: { id }, data: body })
    const { userId, name: userName } = (req.user as any)
    logAudit({ tenantId, userId, userName, action: 'UPDATE', entity: 'Listing', entityId: id, before, after: body, ip: req.ip }).catch(() => {})
    return updated
  })

  // PATCH /listings/bulk — bulk price or status update
  app.patch('/bulk', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { ids, price, status } = z.object({
      ids: z.array(z.string()).min(1).max(200),
      price: z.number().positive().optional(),
      status: z.enum(['ACTIVE', 'PAUSED']).optional(),
    }).parse(req.body)

    // Verify ownership
    const owned = await prisma.listing.findMany({
      where: { id: { in: ids }, store: { tenantId } },
      select: { id: true },
    })
    const ownedIds = owned.map((l) => l.id)

    const data: Record<string, any> = {}
    if (price !== undefined) data.price = price
    if (status !== undefined) data.status = status

    await prisma.listing.updateMany({ where: { id: { in: ownedIds } }, data })
    return { updated: ownedIds.length }
  })

  // DELETE /listings/:id
  app.delete('/:id', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { id } = req.params as { id: string }

    const listing = await prisma.listing.findFirst({ where: { id, store: { tenantId } } })
    if (!listing) return reply.code(404).send({ error: 'Anúncio não encontrado' })

    await prisma.listing.delete({ where: { id } })
    const { userId, name: userName } = (req.user as any)
    logAudit({ tenantId, userId, userName, action: 'DELETE', entity: 'Listing', entityId: id, ip: req.ip }).catch(() => {})
    return reply.code(204).send()
  })
}
