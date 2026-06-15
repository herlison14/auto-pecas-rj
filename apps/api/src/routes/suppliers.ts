import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  sendPurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder,
} from '../services/supplier.service'
import { requireRole } from '../lib/rbac'

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitCost: z.number().positive(),
})

export async function suppliersRoutes(app: FastifyInstance) {
  // ── Suppliers ──────────────────────────────────────────────────────────────

  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId } = (req as any).user
    const { search, activeOnly } = (req.query as any)
    return listSuppliers(tenantId, { search, activeOnly: activeOnly === 'true' })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const body = z.object({
      name: z.string().min(1),
      cnpj: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      contact: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body)
    const supplier = await createSupplier(tenantId, body)
    return reply.code(201).send(supplier)
  })

  app.get('/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    const s = await getSupplier(tenantId, id)
    if (!s) return reply.code(404).send({ error: 'Fornecedor não encontrado' })
    return s
  })

  app.patch('/:id', { onRequest: [app.authenticate], preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    const body = z.object({
      name: z.string().min(1).optional(),
      cnpj: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      contact: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body)
    await updateSupplier(tenantId, id, body)
    return reply.code(204).send()
  })

  app.delete('/:id', { onRequest: [app.authenticate], preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    await deleteSupplier(tenantId, id)
    return reply.code(204).send()
  })

  // ── Purchase Orders ────────────────────────────────────────────────────────

  app.get('/purchase-orders', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId } = (req as any).user
    const { status, supplierId, page, limit } = req.query as any
    return listPurchaseOrders(tenantId, {
      status,
      supplierId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  })

  app.post('/purchase-orders', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const body = z.object({
      supplierId: z.string(),
      expectedAt: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(itemSchema).min(1),
    }).parse(req.body)
    const po = await createPurchaseOrder(tenantId, body)
    return reply.code(201).send(po)
  })

  app.get('/purchase-orders/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    const po = await getPurchaseOrder(tenantId, id)
    if (!po) return reply.code(404).send({ error: 'Ordem não encontrada' })
    return po
  })

  app.post('/purchase-orders/:id/send', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    await sendPurchaseOrder(tenantId, id)
    return reply.code(204).send()
  })

  app.post('/purchase-orders/:id/receive', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    const { items, warehouseId } = z.object({
      warehouseId: z.string(),
      items: z.array(z.object({ itemId: z.string(), receivedQty: z.number().int().positive() })).min(1),
    }).parse(req.body)
    const po = await receivePurchaseOrder(tenantId, id, items, warehouseId)
    return po
  })

  app.post('/purchase-orders/:id/cancel', { onRequest: [app.authenticate], preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = (req as any).user
    const { id } = req.params as { id: string }
    await cancelPurchaseOrder(tenantId, id)
    return reply.code(204).send()
  })
}
