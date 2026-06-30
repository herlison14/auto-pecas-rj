import { PrismaClient, NotificationType } from '@prisma/client'

const prisma = new PrismaClient()

export async function createNotification(tenantId: string, data: {
  type: NotificationType; title: string; body?: string
  link?: string; userId?: string; metadata?: Record<string, unknown>
}) {
  return prisma.notification.create({
    data: {
      tenantId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body,
      link: data.link,
      metadata: (data.metadata ?? {}) as any,
    },
  })
}

export async function getNotifications(tenantId: string, params: {
  unreadOnly?: boolean; page?: number; limit?: number
}) {
  const { unreadOnly = false, page = 1, limit = 30 } = params
  const where = { tenantId, ...(unreadOnly && { isRead: false }) }

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { tenantId, isRead: false } }),
  ])

  return { notifications: items, total, unread, page, pages: Math.ceil(total / limit) }
}

export async function markRead(tenantId: string, ids: string[]) {
  return prisma.notification.updateMany({
    where: { tenantId, id: { in: ids } },
    data: { isRead: true },
  })
}

export async function markAllRead(tenantId: string) {
  return prisma.notification.updateMany({
    where: { tenantId, isRead: false },
    data: { isRead: true },
  })
}

export async function getUnreadCount(tenantId: string) {
  const count = await prisma.notification.count({ where: { tenantId, isRead: false } })
  return { count }
}

export async function notifyNewOrder(tenantId: string, orderId: string, orderNumber: string, marketplace: string) {
  return createNotification(tenantId, {
    type: NotificationType.NEW_ORDER,
    title: `Novo pedido — #${orderNumber}`,
    body: `Pedido recebido via ${marketplace.replace('_', ' ')}`,
    link: `/dashboard/orders/${orderId}`,
    metadata: { orderId, orderNumber, marketplace },
  })
}

export async function notifyLowStock(tenantId: string, products: Array<{ sku: string; name: string; qty: number }>) {
  for (const p of products) {
    await createNotification(tenantId, {
      type: p.qty === 0 ? NotificationType.STOCK_OUT : NotificationType.LOW_STOCK,
      title: p.qty === 0 ? `Sem estoque — ${p.name}` : `Estoque baixo — ${p.name}`,
      body: p.qty === 0
        ? 'Produto esgotado. Reabasteça para não perder vendas.'
        : `Apenas ${p.qty} unidade(s) restantes`,
      link: `/dashboard/inventory`,
      metadata: { sku: p.sku },
    })
  }
}

export async function notifyNfeError(tenantId: string, orderId: string, orderNumber: string, error: string) {
  return createNotification(tenantId, {
    type: NotificationType.NF_E_ERROR,
    title: `Erro na NF-e — pedido #${orderNumber}`,
    body: error,
    link: `/dashboard/orders/${orderId}`,
    metadata: { orderId },
  })
}

export async function notifyReturnRequested(tenantId: string, returnId: string, orderNumber: string) {
  return createNotification(tenantId, {
    type: NotificationType.RETURN_REQUESTED,
    title: `Devolução solicitada — pedido #${orderNumber}`,
    body: 'Um comprador solicitou devolução. Revise e responda em até 24h.',
    link: `/dashboard/returns`,
    metadata: { returnId },
  })
}

export async function notifyPriceChanged(
  tenantId: string, listingId: string, productName: string,
  oldPrice: number, newPrice: number,
) {
  return createNotification(tenantId, {
    type: NotificationType.PRICE_CHANGED,
    title: `Preço ajustado — ${productName}`,
    body: `${oldPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} → ${newPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    link: `/dashboard/repricing`,
    metadata: { listingId, oldPrice, newPrice },
  })
}
