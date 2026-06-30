import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sellsync/database'
import { listingQueue } from '../workers/queues'
import { requireRole } from '../lib/rbac'

const productSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  brand: z.string().optional(),
  ncm: z.string().regex(/^\d{8}$/).optional(),
  gtin: z.string().optional(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  width: z.number().positive().optional(),
  length: z.number().positive().optional(),
  images: z.array(z.string().url()).default([]),
  attributes: z.record(z.unknown()).default({}),
})

export async function productsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    await req.jwtVerify()
  })

  app.get('/', async (req) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    const { search, page = '1', limit = '20' } = req.query as Record<string, string>

    const where = {
      tenantId,
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          stockItems: { include: { warehouse: { select: { name: true } } } },
          listings: { select: { id: true, storeId: true, status: true, price: true, store: { select: { marketplace: true } } } },
          _count: { select: { listings: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.product.count({ where }),
    ])

    return { data: products, meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } }
  })

  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    return prisma.product.findFirstOrThrow({
      where: { id, tenantId },
      include: {
        stockItems: { include: { warehouse: true } },
        listings: { include: { store: { select: { marketplace: true, name: true } } } },
        kitItems: { include: { product: { select: { id: true, sku: true, name: true } } } },
      },
    })
  })

  app.post('/', async (req, reply) => {
    const tenantId = (req.user as { tenantId: string }).tenantId
    const body = productSchema.parse(req.body)
    const product = await prisma.product.create({ data: { tenantId, ...body, attributes: body.attributes as any } })
    return reply.code(201).send(product)
  })

  app.put('/:id', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    const existing = await prisma.product.findFirst({ where: { id, tenantId } })
    if (!existing) return reply.code(404).send({ error: 'Produto não encontrado' })
    const body = productSchema.partial().parse(req.body)
    return prisma.product.update({ where: { id }, data: { ...body, attributes: body.attributes as any } })
  })

  app.delete('/:id', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    await prisma.product.delete({ where: { id, tenantId } })
    return reply.code(204).send()
  })

  // Publicar produto como anúncio em um marketplace
  app.post('/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string }
    const tenantId = (req.user as { tenantId: string }).tenantId
    const body = z.object({
      storeId: z.string(),
      price: z.number().positive(),
      title: z.string().optional(),
    }).parse(req.body)

    const [product, store] = await Promise.all([
      prisma.product.findFirstOrThrow({ where: { id, tenantId } }),
      prisma.store.findFirstOrThrow({ where: { id: body.storeId, tenantId } }),
    ])

    // Cria o listing pendente — o worker de publicação irá enviá-lo ao marketplace
    const listing = await prisma.listing.create({
      data: {
        storeId: store.id,
        productId: product.id,
        externalId: `pending-${Date.now()}`,
        title: body.title ?? product.name,
        price: body.price,
        status: 'PAUSED',
      },
    })

    await listingQueue.add('publish-listing', { listingId: listing.id, tenantId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    })

    return reply.code(202).send(listing)
  })
}
