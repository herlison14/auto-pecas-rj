import { prisma, type Marketplace } from '@sellsync/database'
import { parseTabularBuffer, toNum } from '../lib/spreadsheet'

const MARKETPLACE_ALIASES: Record<string, Marketplace> = {
  'mercado livre': 'MERCADO_LIVRE',
  'mercadolivre': 'MERCADO_LIVRE',
  'ml': 'MERCADO_LIVRE',
  'shopee': 'SHOPEE',
  'amazon': 'AMAZON',
  'magalu': 'MAGALU',
  'magazine luiza': 'MAGALU',
  'americanas': 'AMERICANAS',
  'shein': 'SHEIN',
  'tiktok shop': 'TIKTOK_SHOP',
  'tiktok': 'TIKTOK_SHOP',
  'shopify': 'SHOPIFY',
  'nuvemshop': 'NUVEMSHOP',
}

function parseMarketplace(v: unknown): Marketplace | undefined {
  const key = String(v ?? '').trim().toLowerCase()
  return MARKETPLACE_ALIASES[key]
}

function parseDate(v: unknown): Date | undefined {
  if (v == null || v === '') return undefined
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v

  const s = String(v).trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]))
    return isNaN(d.getTime()) ? undefined : d
  }

  const iso = new Date(s)
  return isNaN(iso.getTime()) ? undefined : iso
}

export interface FunnelImportRow {
  sku: string
  marketplace?: Marketplace
  periodStart?: Date
  periodEnd?: Date
  impressions: number
  clicks: number
  visits: number
  addToCart: number
  orders: number
  revenue: number
  adSpend: number
  unitCost?: number
}

export interface FunnelImportResult {
  created: number
  updated: number
  errors: Array<{ row: number; sku: string; reason: string }>
}

export async function parseFunnelSpreadsheet(buffer: Buffer): Promise<FunnelImportRow[]> {
  const rows = await parseTabularBuffer(buffer)

  return rows.map((norm) => {
    const get = (...keys: string[]) => keys.map((k) => norm[k]).find((v) => v != null && v !== '')

    return {
      sku: String(get('sku', 'codigo') ?? '').trim(),
      marketplace: parseMarketplace(get('marketplace', 'marketplace', 'canal')),
      periodStart: parseDate(get('periodo_inicio', 'data_inicio', 'inicio')),
      periodEnd: parseDate(get('periodo_fim', 'data_fim', 'fim')),
      impressions: toNum(get('impressions', 'impressoes')) ?? 0,
      clicks: toNum(get('clicks', 'cliques')) ?? 0,
      visits: toNum(get('visits', 'visitas')) ?? 0,
      addToCart: toNum(get('addtocart', 'add_to_cart', 'adicoes ao carrinho', 'carrinho')) ?? 0,
      orders: toNum(get('orders', 'pedidos', 'vendas')) ?? 0,
      revenue: toNum(get('revenue', 'receita', 'faturamento')) ?? 0,
      adSpend: toNum(get('adspend', 'ad_spend', 'investimento em anuncios', 'gasto com anuncios', 'ads')) ?? 0,
      unitCost: toNum(get('unitcost', 'unit_cost', 'custo unitario', 'custo')),
    }
  })
}

export async function importFunnelSnapshots(
  rows: FunnelImportRow[],
  tenantId: string,
): Promise<FunnelImportResult> {
  const result: FunnelImportResult = { created: 0, updated: 0, errors: [] }

  const validRows: Array<{ row: FunnelImportRow; rowNum: number }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    if (!row.sku) {
      result.errors.push({ row: rowNum, sku: '', reason: 'SKU obrigatório' })
      continue
    }
    if (!row.marketplace) {
      result.errors.push({ row: rowNum, sku: row.sku, reason: 'Marketplace inválido ou não reconhecido' })
      continue
    }
    if (!row.periodStart || !row.periodEnd) {
      result.errors.push({ row: rowNum, sku: row.sku, reason: 'Período (início/fim) inválido' })
      continue
    }

    validRows.push({ row, rowNum })
  }

  if (validRows.length === 0) return result

  const skus = [...new Set(validRows.map(({ row }) => row.sku))]
  const products = await prisma.product.findMany({
    where: { tenantId, sku: { in: skus } },
    select: { id: true, sku: true },
  })
  const productBySku = new Map(products.map((p) => [p.sku, p.id]))

  const existingSnapshots = await prisma.funnelSnapshot.findMany({
    where: {
      tenantId,
      productId: { in: [...productBySku.values()] },
    },
    select: { id: true, productId: true, marketplace: true, periodStart: true },
  })
  const existingByKey = new Map(
    existingSnapshots.map((s) => [`${s.productId}:${s.marketplace}:${s.periodStart.toISOString()}`, s.id]),
  )

  await prisma.$transaction(async (tx) => {
    for (const { row, rowNum } of validRows) {
      const productId = productBySku.get(row.sku)
      if (!productId) {
        result.errors.push({ row: rowNum, sku: row.sku, reason: 'Produto não encontrado (cadastre antes de importar o funil)' })
        continue
      }

      const key = `${productId}:${row.marketplace}:${row.periodStart!.toISOString()}`
      const existingId = existingByKey.get(key)

      const data = {
        impressions: row.impressions,
        clicks: row.clicks,
        visits: row.visits,
        addToCart: row.addToCart,
        orders: row.orders,
        revenue: row.revenue,
        adSpend: row.adSpend,
        unitCost: row.unitCost ?? null,
        periodEnd: row.periodEnd!,
      }

      if (existingId) {
        await tx.funnelSnapshot.update({ where: { id: existingId }, data })
        result.updated++
      } else {
        await tx.funnelSnapshot.create({
          data: {
            tenantId,
            productId,
            marketplace: row.marketplace!,
            periodStart: row.periodStart!,
            ...data,
          },
        })
        result.created++
      }
    }
  })

  return result
}
