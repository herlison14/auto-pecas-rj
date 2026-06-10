import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import ExcelJS from 'exceljs'
import { prisma } from '@sellsync/database'
import { subDays, startOfDay } from 'date-fns'

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}

async function toXlsx(rows: Record<string, unknown>[], sheetName = 'Dados'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)
  if (rows.length > 0) {
    ws.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 20 }))
    ws.addRows(rows)
    ws.getRow(1).font = { bold: true }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function sendFile(reply: any, data: Buffer | string, filename: string, format: string) {
  const isXlsx = format === 'xlsx'
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  reply.header('Content-Type', isXlsx
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv; charset=utf-8')
  return reply.send(isXlsx ? data : '﻿' + data)
}

const periodSchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
  format: z.enum(['csv', 'xlsx']).default('csv'),
})

export async function exportRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => { await req.jwtVerify() })

  // GET /export/orders
  app.get('/orders', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { days, format } = periodSchema.parse(req.query)
    const from = startOfDay(subDays(new Date(), days - 1))

    const orders = await prisma.order.findMany({
      where: { tenantId, createdAt: { gte: from } },
      include: { store: { select: { name: true, marketplace: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const rows = orders.map((o) => ({
      'ID Externo': o.externalId,
      'Canal': o.store.marketplace,
      'Loja': o.store.name,
      'Comprador': o.buyerName,
      'Status': o.status,
      'Total (R$)': Number(o.total).toFixed(2),
      'Frete (R$)': Number(o.shippingCost).toFixed(2),
      'NF-e Status': o.nfeStatus,
      'Criado em': new Date(o.createdAt).toLocaleString('pt-BR'),
    }))

    const fname = `pedidos_${new Date().toISOString().slice(0, 10)}`
    const data = format === 'xlsx' ? await toXlsx(rows, 'Pedidos') : Buffer.from(toCsv(rows))
    return sendFile(reply, data, `${fname}.${format}`, format)
  })

  // GET /export/inventory
  app.get('/inventory', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { format } = periodSchema.parse(req.query)

    const items = await prisma.stockItem.findMany({
      where: { warehouse: { tenantId } },
      include: {
        product: { select: { name: true, sku: true, brand: true, ncm: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: [{ product: { name: 'asc' } }],
    })

    const rows = items.map((i) => ({
      'SKU': i.product.sku,
      'Produto': i.product.name,
      'Marca': i.product.brand ?? '',
      'NCM': i.product.ncm ?? '',
      'Armazém': i.warehouse.name,
      'Quantidade': i.quantity,
      'Reservado': i.reserved,
      'Disponível': i.quantity - i.reserved,
      'Mínimo': i.minAlert,
    }))

    const fname = `estoque_${new Date().toISOString().slice(0, 10)}`
    const data = format === 'xlsx' ? await toXlsx(rows, 'Estoque') : Buffer.from(toCsv(rows))
    return sendFile(reply, data, `${fname}.${format}`, format)
  })

  // GET /export/products
  app.get('/products', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { format } = periodSchema.parse(req.query)

    const products = await prisma.product.findMany({
      where: { tenantId },
      include: {
        stockItems: true,
        _count: { select: { listings: true } },
      },
      orderBy: { name: 'asc' },
    })

    const rows = products.map((p) => ({
      'SKU': p.sku,
      'Nome': p.name,
      'Marca': p.brand ?? '',
      'NCM': p.ncm ?? '',
      'GTIN/EAN': p.gtin ?? '',
      'Peso (kg)': p.weight ?? '',
      'Anúncios ativos': p._count.listings,
      'Estoque total': p.stockItems.reduce((s, i) => s + i.quantity, 0),
    }))

    const fname = `produtos_${new Date().toISOString().slice(0, 10)}`
    const data = format === 'xlsx' ? await toXlsx(rows, 'Produtos') : Buffer.from(toCsv(rows))
    return sendFile(reply, data, `${fname}.${format}`, format)
  })

  // GET /export/financial
  app.get('/financial', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { days, format } = periodSchema.parse(req.query)
    const from = startOfDay(subDays(new Date(), days - 1))

    const txs = await prisma.financialTransaction.findMany({
      where: { tenantId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
    })

    const rows = txs.map((t) => ({
      'Tipo': t.type,
      'Descrição': t.description,
      'Valor (R$)': Number(t.amount).toFixed(2),
      'Canal': t.marketplace ?? '',
      'Referência': t.externalId ?? '',
      'Data': new Date(t.createdAt).toLocaleString('pt-BR'),
    }))

    const fname = `financeiro_${new Date().toISOString().slice(0, 10)}`
    const data = format === 'xlsx' ? await toXlsx(rows, 'Financeiro') : Buffer.from(toCsv(rows))
    return sendFile(reply, data, `${fname}.${format}`, format)
  })
}
