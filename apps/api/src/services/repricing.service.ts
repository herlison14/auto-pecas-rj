import { PrismaClient, RepricingStrategy, Marketplace } from '@prisma/client'
import Decimal from 'decimal.js'

const prisma = new PrismaClient()

export async function getRepricingRules(tenantId: string) {
  return prisma.repricingRule.findMany({
    where: { tenantId },
    include: { listing: { select: { title: true, price: true, store: { select: { name: true, marketplace: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createRepricingRule(tenantId: string, data: {
  name: string
  listingId?: string
  marketplace?: Marketplace
  strategy: RepricingStrategy
  targetMargin?: number
  minPrice?: number
  maxPrice?: number
  adjustmentPct?: number
}) {
  return prisma.repricingRule.create({
    data: {
      tenantId,
      name: data.name,
      listingId: data.listingId,
      marketplace: data.marketplace,
      strategy: data.strategy,
      targetMargin: data.targetMargin,
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      adjustmentPct: data.adjustmentPct ?? 5,
    },
  })
}

export async function updateRepricingRule(tenantId: string, id: string, data: Partial<{
  name: string; isActive: boolean; targetMargin: number; minPrice: number; maxPrice: number; adjustmentPct: number
}>) {
  const rule = await prisma.repricingRule.findFirst({ where: { id, tenantId } })
  if (!rule) throw new Error('Rule not found')
  return prisma.repricingRule.update({ where: { id }, data })
}

export async function deleteRepricingRule(tenantId: string, id: string) {
  return prisma.repricingRule.deleteMany({ where: { id, tenantId } })
}

export async function runRepricingForTenant(tenantId: string) {
  const rules = await prisma.repricingRule.findMany({
    where: { tenantId, isActive: true },
    include: { listing: { include: { store: true, product: true } } },
  })

  const results: Array<{ ruleId: string; listingId: string; oldPrice: number; newPrice: number; reason: string }> = []

  for (const rule of rules) {
    if (!rule.listing) continue

    const listing = rule.listing
    const currentPrice = new Decimal(listing.price.toString())
    let newPrice = currentPrice
    let reason = ''

    switch (rule.strategy) {
      case RepricingStrategy.MAINTAIN_MARGIN: {
        if (rule.targetMargin == null) continue
        // Simulate: use product cost estimate (80% of price as cost)
        const estimatedCost = currentPrice.mul(0.8)
        const targetMarginRate = new Decimal(rule.targetMargin.toString()).div(100)
        newPrice = estimatedCost.div(new Decimal(1).sub(targetMarginRate))
        reason = `Margem alvo: ${rule.targetMargin}%`
        break
      }
      case RepricingStrategy.BEAT_BY_PCT: {
        const pct = new Decimal(rule.adjustmentPct.toString()).div(100)
        newPrice = currentPrice.mul(new Decimal(1).sub(pct))
        reason = `Redução de ${rule.adjustmentPct}%`
        break
      }
      case RepricingStrategy.FIXED_MARKUP: {
        const markup = new Decimal(rule.adjustmentPct.toString()).div(100)
        newPrice = currentPrice.mul(new Decimal(1).add(markup))
        reason = `Markup de ${rule.adjustmentPct}%`
        break
      }
      default:
        continue
    }

    // Enforce guardrails
    if (rule.minPrice && newPrice.lt(rule.minPrice.toString())) {
      newPrice = new Decimal(rule.minPrice.toString())
      reason += ' (limite mínimo)'
    }
    if (rule.maxPrice && newPrice.gt(rule.maxPrice.toString())) {
      newPrice = new Decimal(rule.maxPrice.toString())
      reason += ' (limite máximo)'
    }

    newPrice = newPrice.toDecimalPlaces(2)

    if (!newPrice.equals(currentPrice)) {
      await prisma.$transaction([
        prisma.listing.update({ where: { id: listing.id }, data: { price: newPrice } }),
        prisma.priceHistory.create({
          data: { tenantId, listingId: listing.id, price: newPrice, source: `rule:${rule.name}` },
        }),
        prisma.repricingRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } }),
      ])

      results.push({
        ruleId: rule.id,
        listingId: listing.id,
        oldPrice: currentPrice.toNumber(),
        newPrice: newPrice.toNumber(),
        reason,
      })
    } else {
      await prisma.repricingRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } })
    }
  }

  return results
}

export async function getPriceHistory(tenantId: string, listingId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000)

  return prisma.priceHistory.findMany({
    where: { tenantId, listingId, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { price: true, source: true, createdAt: true },
  })
}

export async function getRepricingStats(tenantId: string) {
  const [rules, changes24h] = await Promise.all([
    prisma.repricingRule.count({ where: { tenantId } }),
    prisma.priceHistory.count({
      where: { tenantId, source: { not: 'manual' }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ])

  const active = await prisma.repricingRule.count({ where: { tenantId, isActive: true } })

  return { total: rules, active, changes24h }
}
