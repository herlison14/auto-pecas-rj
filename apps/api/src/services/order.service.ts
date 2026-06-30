import { prisma } from '@sellsync/database'
import { MarketplaceAdapterFactory, MercadoLivreAdapter } from '@sellsync/integrations'
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

  async markShipped({ tenantId, orderId, trackingCode }: {
    tenantId: string
    orderId: string
    trackingCode?: string
    carrier?: string
  }) {
    // Garante que o pedido pertence ao tenant antes de atualizar
    await prisma.order.findFirstOrThrow({ where: { id: orderId, tenantId }, select: { id: true } })
    return prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
        shippedAt: new Date(),
        ...(trackingCode && { trackingCode }),
      },
    })
  }

  /** Etiqueta de envio de um pedido (PDF). Suportado: Mercado Livre (Mercado Envios). */
  async getShippingLabel({ tenantId, orderId }: { tenantId: string; orderId: string }): Promise<Buffer> {
    const order = await prisma.order.findFirstOrThrow({
      where: { id: orderId, tenantId },
      include: { store: true },
    })

    if (order.marketplace !== 'MERCADO_LIVRE') {
      throw new LabelNotSupportedError(
        'Etiqueta disponível apenas para pedidos do Mercado Livre por enquanto. Para os demais canais, baixe a etiqueta no painel do marketplace.',
      )
    }

    const adapter = await MarketplaceAdapterFactory.create(order.store)
    return (adapter as MercadoLivreAdapter).getShippingLabelPdf(order.externalId)
  }

  async printLabels({ tenantId, orderIds }: { tenantId: string; orderIds: string[] }): Promise<Buffer> {
    // Lote: por enquanto só Mercado Livre — a API aceita vários shipment_ids
    // em uma única chamada e devolve um PDF com todas as etiquetas.
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, tenantId, marketplace: 'MERCADO_LIVRE' },
      include: { store: true },
    })
    if (orders.length === 0) {
      throw new LabelNotSupportedError('Nenhum pedido do Mercado Livre selecionado — etiquetas em lote suportam apenas ML por enquanto.')
    }

    const shipmentIds = orders
      .map((o) => (o.externalData as { shipping?: { id?: number | string } })?.shipping?.id)
      .filter(Boolean)
    if (shipmentIds.length === 0) {
      throw new LabelNotSupportedError('Os pedidos selecionados não têm envio associado (Mercado Envios).')
    }

    const adapter = (await MarketplaceAdapterFactory.create(orders[0].store)) as MercadoLivreAdapter
    return adapter.getShippingLabelsPdf(shipmentIds.map(String))
  }
}

export class LabelNotSupportedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LabelNotSupportedError'
  }
}
