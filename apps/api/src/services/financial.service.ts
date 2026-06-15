import { PrismaClient, FinancialTxType, Marketplace } from '@prisma/client'
import Decimal from 'decimal.js'

const prisma = new PrismaClient()

// Marketplace commission rates (typical Brazilian market rates)
const MP_COMMISSION: Record<string, number> = {
  MERCADO_LIVRE: 0.12,
  SHOPEE: 0.18,
  AMAZON: 0.15,
  MAGALU: 0.16,
  AMERICANAS: 0.17,
  SHEIN: 0.20,
  TIKTOK_SHOP: 0.10,
  SHOPIFY: 0.02,
  NUVEMSHOP: 0.01,
}

const MP_SHIPPING_CREDIT: Record<string, number> = {
  MERCADO_LIVRE: 0.05,
  SHOPEE: 0.08,
  AMAZON: 0.06,
  MAGALU: 0.04,
  AMERICANAS: 0.03,
  SHEIN: 0.07,
  TIKTOK_SHOP: 0.05,
}

export async function syncFinancialFromOrders(tenantId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000)

  const orders = await prisma.order.findMany({
    where: { tenantId, createdAt: { gte: since }, status: { in: ['DELIVERED', 'SHIPPED', 'CONFIRMED'] } },
    select: { id: true, storeId: true, marketplace: true, total: true, shippingCost: true, createdAt: true },
  })

  // Batch-check which orders already have transactions (avoids N+1)
  const existingIds = new Set(
    (await prisma.financialTransaction.findMany({
      where: { tenantId, externalId: { in: orders.map((o) => `order_${o.id}_sale`) } },
      select: { externalId: true },
    })).map((t) => t.externalId),
  )

  let created = 0

  for (const order of orders) {
    if (existingIds.has(`order_${order.id}_sale`)) continue

    const total = new Decimal(order.total.toString())
    const shipping = new Decimal(order.shippingCost.toString())
    const commissionRate = MP_COMMISSION[order.marketplace] ?? 0.15
    const commission = total.mul(commissionRate).negated()
    const shippingCreditRate = MP_SHIPPING_CREDIT[order.marketplace] ?? 0.05
    const shippingCredit = total.mul(shippingCreditRate)
    const mpFee = total.mul(0.02).negated() // fixed platform fee

    await prisma.financialTransaction.createMany({
      data: [
        {
          tenantId,
          orderId: null,
          storeId: order.storeId,
          marketplace: order.marketplace,
          type: FinancialTxType.SALE,
          amount: total,
          description: `Venda — pedido`,
          externalId: `order_${order.id}_sale`,
          referenceDate: order.createdAt,
        },
        {
          tenantId,
          storeId: order.storeId,
          marketplace: order.marketplace,
          type: FinancialTxType.COMMISSION,
          amount: commission,
          description: `Comissão ${order.marketplace.replace('_', ' ')} (${(commissionRate * 100).toFixed(0)}%)`,
          externalId: `order_${order.id}_commission`,
          referenceDate: order.createdAt,
        },
        {
          tenantId,
          storeId: order.storeId,
          marketplace: order.marketplace,
          type: FinancialTxType.MARKETPLACE_FEE,
          amount: mpFee,
          description: 'Taxa de plataforma (2%)',
          externalId: `order_${order.id}_mpfee`,
          referenceDate: order.createdAt,
        },
        {
          tenantId,
          storeId: order.storeId,
          marketplace: order.marketplace,
          type: FinancialTxType.SHIPPING_COST,
          amount: shipping.negated(),
          description: 'Custo de frete',
          externalId: `order_${order.id}_shipping`,
          referenceDate: order.createdAt,
        },
        {
          tenantId,
          storeId: order.storeId,
          marketplace: order.marketplace,
          type: FinancialTxType.SHIPPING_CREDIT,
          amount: shippingCredit,
          description: `Crédito de frete ${order.marketplace.replace('_', ' ')}`,
          externalId: `order_${order.id}_shipcredit`,
          referenceDate: order.createdAt,
        },
      ],
      skipDuplicates: true,
    })
    created++
  }

  return { synced: created }
}

export async function getFinancialSummary(tenantId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000)

  const txs = await prisma.financialTransaction.findMany({
    where: { tenantId, referenceDate: { gte: since } },
    select: { type: true, amount: true, marketplace: true },
  })

  let grossRevenue = new Decimal(0)
  let totalCommissions = new Decimal(0)
  let totalFees = new Decimal(0)
  let totalShippingCost = new Decimal(0)
  let totalShippingCredit = new Decimal(0)
  let totalRefunds = new Decimal(0)

  const byMarketplace: Record<string, { gross: Decimal; fees: Decimal; net: Decimal }> = {}

  for (const tx of txs) {
    const amount = new Decimal(tx.amount.toString())
    const mp = tx.marketplace ?? 'OTHER'

    if (!byMarketplace[mp]) byMarketplace[mp] = { gross: new Decimal(0), fees: new Decimal(0), net: new Decimal(0) }

    switch (tx.type) {
      case 'SALE':
        grossRevenue = grossRevenue.add(amount)
        byMarketplace[mp].gross = byMarketplace[mp].gross.add(amount)
        break
      case 'COMMISSION':
        totalCommissions = totalCommissions.add(amount.abs())
        byMarketplace[mp].fees = byMarketplace[mp].fees.add(amount.abs())
        break
      case 'MARKETPLACE_FEE':
      case 'ADVERTISEMENT':
        totalFees = totalFees.add(amount.abs())
        byMarketplace[mp].fees = byMarketplace[mp].fees.add(amount.abs())
        break
      case 'SHIPPING_COST':
        totalShippingCost = totalShippingCost.add(amount.abs())
        break
      case 'SHIPPING_CREDIT':
        totalShippingCredit = totalShippingCredit.add(amount.abs())
        break
      case 'REFUND':
      case 'CHARGEBACK':
        totalRefunds = totalRefunds.add(amount.abs())
        break
    }
  }

  const totalDeductions = totalCommissions.add(totalFees).add(totalShippingCost).sub(totalShippingCredit).add(totalRefunds)
  const netRevenue = grossRevenue.sub(totalDeductions)
  const margin = grossRevenue.gt(0) ? netRevenue.div(grossRevenue).mul(100) : new Decimal(0)

  for (const mp of Object.keys(byMarketplace)) {
    byMarketplace[mp].net = byMarketplace[mp].gross.sub(byMarketplace[mp].fees)
  }

  return {
    grossRevenue: grossRevenue.toNumber(),
    netRevenue: netRevenue.toNumber(),
    totalCommissions: totalCommissions.toNumber(),
    totalFees: totalFees.toNumber(),
    totalShippingCost: totalShippingCost.toNumber(),
    totalShippingCredit: totalShippingCredit.toNumber(),
    totalRefunds: totalRefunds.toNumber(),
    totalDeductions: totalDeductions.toNumber(),
    margin: margin.toFixed(1),
    byMarketplace: Object.entries(byMarketplace).map(([mp, d]) => ({
      marketplace: mp,
      gross: d.gross.toNumber(),
      fees: d.fees.toNumber(),
      net: d.net.toNumber(),
      margin: d.gross.gt(0) ? d.net.div(d.gross).mul(100).toFixed(1) : '0.0',
    })),
  }
}

export async function getTransactions(tenantId: string, params: {
  days?: number; type?: FinancialTxType; marketplace?: Marketplace; page?: number; limit?: number
}) {
  const { days = 30, type, marketplace, page = 1, limit = 50 } = params
  const since = new Date(Date.now() - days * 86_400_000)

  const where = {
    tenantId,
    referenceDate: { gte: since },
    ...(type && { type }),
    ...(marketplace && { marketplace }),
  }

  const [txs, total] = await Promise.all([
    prisma.financialTransaction.findMany({
      where,
      orderBy: { referenceDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.financialTransaction.count({ where }),
  ])

  return { transactions: txs, total, page, pages: Math.ceil(total / limit) }
}

export async function getDailyCashflow(tenantId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000)

  const txs = await prisma.financialTransaction.findMany({
    where: { tenantId, referenceDate: { gte: since } },
    select: { type: true, amount: true, referenceDate: true },
    orderBy: { referenceDate: 'asc' },
  })

  const byDay: Record<string, { date: string; gross: number; net: number; fees: number }> = {}

  for (const tx of txs) {
    const date = tx.referenceDate.toISOString().slice(0, 10)
    if (!byDay[date]) byDay[date] = { date, gross: 0, net: 0, fees: 0 }
    const amount = Number(tx.amount.toString())

    if (tx.type === 'SALE') {
      byDay[date].gross += amount
      byDay[date].net += amount
    } else if (['COMMISSION', 'MARKETPLACE_FEE', 'SHIPPING_COST', 'ADVERTISEMENT'].includes(tx.type)) {
      byDay[date].fees += Math.abs(amount)
      byDay[date].net -= Math.abs(amount)
    } else if (tx.type === 'SHIPPING_CREDIT') {
      byDay[date].net += Math.abs(amount)
    }
  }

  return Object.values(byDay)
}
