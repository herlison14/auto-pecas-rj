import { prisma } from '@sellsync/database'
import { nfeQueue } from '../workers/queues'

interface ListParams {
  tenantId: string
  page: number
  limit: number
  status?: string
  marketplace?: string
  search?: string
  from?: string
  to?: string
}

export class OrderService {
  async list({ tenantId, page, limit, status, marketplace, search, from, to }: ListParams) {
    const where = {
      tenantId,
      ...(status && { status: status as any }),
      ...(marketplace && { marketplace: marketplace as any }),
      ...(search && {
        OR: [
          { externalId: { contains: search } },
          { buyerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(from || to ? {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      } : {}),
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: true,
          store: { select: { marketplace: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ])

    return {
      data: orders,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
  }

  async findById({ tenantId, id }: { tenantId: string; id: string }) {
    return prisma.order.findFirstOrThrow({
      where: { id, tenantId },
      include: { items: { include: { product: true } }, store: true },
    })
  }

  async emitInvoice({ tenantId, orderId }: { tenantId: string; orderId: string }) {
    const order = await prisma.order.findFirstOrThrow({ where: { id: orderId, tenantId } })

    if (order.nfeStatus === 'AUTHORIZED') {
      throw new Error('NF-e already authorized for this order')
    }

    await nfeQueue.add('emit-nfe', { orderId, tenantId }, { priority: 1 })
    return { message: 'NF-e emission queued', orderId }
  }

  async markShipped({ tenantId, orderId, trackingCode, carrier }: {
    tenantId: string
    orderId: string
    trackingCode: string
    carrier: string
  }) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
        shippedAt: new Date(),
        trackingCode,
      },
    })
  }

  async printLabels({ tenantId, orderIds }: { tenantId: string; orderIds: string[] }): Promise<Buffer> {
    // TODO: Integrate with label generation library (pdfkit or puppeteer)
    // Each marketplace has its own label format
    throw new Error('Label printing not implemented yet')
  }
}
