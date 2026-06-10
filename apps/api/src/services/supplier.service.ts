import { prisma } from '@sellsync/database'
import { Prisma } from '@prisma/client'

export async function listSuppliers(tenantId: string, { search, activeOnly }: { search?: string; activeOnly?: boolean } = {}) {
  return prisma.supplier.findMany({
    where: {
      tenantId,
      isActive: activeOnly ? true : undefined,
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
    },
    orderBy: { name: 'asc' },
  })
}

export async function getSupplier(tenantId: string, id: string) {
  return prisma.supplier.findFirst({ where: { id, tenantId } })
}

export async function createSupplier(tenantId: string, data: {
  name: string; cnpj?: string; email?: string; phone?: string; contact?: string; notes?: string
}) {
  return prisma.supplier.create({ data: { tenantId, ...data } })
}

export async function updateSupplier(tenantId: string, id: string, data: Partial<{
  name: string; cnpj: string; email: string; phone: string; contact: string; notes: string; isActive: boolean
}>) {
  return prisma.supplier.updateMany({ where: { id, tenantId }, data })
}

export async function deleteSupplier(tenantId: string, id: string) {
  return prisma.supplier.updateMany({ where: { id, tenantId }, data: { isActive: false } })
}

// ─── Purchase Orders ───────────────────────────────────────────────────────────

async function nextPoNumber(tenantId: string) {
  const count = await prisma.purchaseOrder.count({ where: { tenantId } })
  return `PO-${String(count + 1).padStart(5, '0')}`
}

export async function listPurchaseOrders(tenantId: string, { status, supplierId, page = 1, limit = 20 }: {
  status?: string; supplierId?: string; page?: number; limit?: number
} = {}) {
  const where: Prisma.PurchaseOrderWhereInput = {
    tenantId,
    status: status as any ?? undefined,
    supplierId: supplierId ?? undefined,
  }
  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } }, items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ])
  return { orders, total, page, pages: Math.ceil(total / limit) }
}

export async function getPurchaseOrder(tenantId: string, id: string) {
  return prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: {
      supplier: true,
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  })
}

export async function createPurchaseOrder(tenantId: string, data: {
  supplierId: string
  expectedAt?: string
  notes?: string
  items: Array<{ productId: string; quantity: number; unitCost: number }>
}) {
  const number = await nextPoNumber(tenantId)
  const totalCost = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  return prisma.purchaseOrder.create({
    data: {
      tenantId,
      supplierId: data.supplierId,
      number,
      expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
      notes: data.notes,
      totalCost,
      items: {
        create: data.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      },
    },
    include: { supplier: { select: { id: true, name: true } }, items: true },
  })
}

export async function sendPurchaseOrder(tenantId: string, id: string) {
  return prisma.purchaseOrder.updateMany({
    where: { id, tenantId, status: 'DRAFT' },
    data: { status: 'SENT' },
  })
}

export async function receivePurchaseOrder(tenantId: string, id: string, items: Array<{ itemId: string; receivedQty: number }>, warehouseId: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, tenantId }, include: { items: true } })
  if (!po) throw new Error('Ordem de compra não encontrada')
  if (['RECEIVED', 'CANCELLED'].includes(po.status)) throw new Error('Esta ordem já foi finalizada')

  await prisma.$transaction(async (tx) => {
    for (const recv of items) {
      const poItem = po.items.find((i) => i.id === recv.itemId)
      if (!poItem || recv.receivedQty <= 0) continue

      const newReceived = poItem.receivedQty + recv.receivedQty
      await tx.purchaseOrderItem.update({ where: { id: recv.itemId }, data: { receivedQty: newReceived } })

      // Update or create stock
      await tx.stockItem.upsert({
        where: { productId_warehouseId: { productId: poItem.productId, warehouseId } },
        update: { quantity: { increment: recv.receivedQty } },
        create: { productId: poItem.productId, warehouseId, quantity: recv.receivedQty },
      })

      await tx.stockMovement.create({
        data: {
          productId: poItem.productId,
          warehouseId,
          type: 'IN',
          quantity: recv.receivedQty,
          reason: `Recebimento OC ${po.number}`,
          orderId: po.id,
        },
      })
    }

    // Recalculate status
    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } })
    const allReceived = updatedItems.every((i) => i.receivedQty >= i.quantity)
    const anyReceived = updatedItems.some((i) => i.receivedQty > 0)

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: allReceived ? 'RECEIVED' : anyReceived ? 'PARTIAL' : po.status,
        receivedAt: allReceived ? new Date() : undefined,
      },
    })
  })

  return getPurchaseOrder(tenantId, id)
}

export async function cancelPurchaseOrder(tenantId: string, id: string) {
  return prisma.purchaseOrder.updateMany({
    where: { id, tenantId, status: { notIn: ['RECEIVED', 'CANCELLED'] } },
    data: { status: 'CANCELLED' },
  })
}
