import { prisma } from '@sellsync/database'
import type { Marketplace } from '@sellsync/database'
import Decimal from 'decimal.js'

interface SimulateParams {
  tenantId: string
  basePrice: number
  marketplace?: Marketplace
}

export class PricingService {
  async listRules(tenantId: string) {
    return prisma.pricingRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createRule(tenantId: string, data: {
    name: string
    marketplace?: Marketplace
    type: 'MARKUP_PERCENTAGE' | 'MARGIN_PERCENTAGE' | 'FIXED_ADDITION' | 'FIXED_PRICE'
    value: number
    isActive?: boolean
  }) {
    return prisma.pricingRule.create({
      data: { tenantId, ...data },
    })
  }

  async updateRule(tenantId: string, ruleId: string, data: Partial<{
    name: string
    type: string
    value: number
    isActive: boolean
  }>) {
    return prisma.pricingRule.update({
      where: { id: ruleId, tenantId },
      data: data as any,
    })
  }

  async deleteRule(tenantId: string, ruleId: string) {
    return prisma.pricingRule.delete({ where: { id: ruleId, tenantId } })
  }

  // Aplica regras de precificação e retorna o preço final para um marketplace
  simulate({ tenantId: _tenantId, basePrice, marketplace }: SimulateParams & { rules: Array<{ type: string; value: Decimal; marketplace: Marketplace | null; isActive: boolean }> } & { rules: Array<{ type: string; value: Decimal; marketplace: Marketplace | null; isActive: boolean }> }) {
    return basePrice
  }

  async applyRules({ tenantId, basePrice, marketplace }: SimulateParams): Promise<number> {
    const rules = await prisma.pricingRule.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { marketplace: null },
          ...(marketplace ? [{ marketplace }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    let price = new Decimal(basePrice)

    for (const rule of rules) {
      const val = new Decimal(rule.value.toString())

      switch (rule.type) {
        case 'MARKUP_PERCENTAGE':
          // Preço * (1 + markup/100)
          price = price.mul(Decimal(1).add(val.div(100)))
          break
        case 'MARGIN_PERCENTAGE':
          // Preço / (1 - margem/100)
          price = price.div(Decimal(1).sub(val.div(100)))
          break
        case 'FIXED_ADDITION':
          price = price.add(val)
          break
        case 'FIXED_PRICE':
          price = val
          break
      }
    }

    // Arredonda para 2 casas decimais
    return price.toDecimalPlaces(2).toNumber()
  }

  async syncPricesForProduct(tenantId: string, productId: string, baseCost: number) {
    const listings = await prisma.listing.findMany({
      where: { productId, store: { tenantId }, status: 'ACTIVE' },
      include: { store: { select: { marketplace: true } } },
    })

    const updates = await Promise.all(
      listings.map(async (listing) => {
        const finalPrice = await this.applyRules({
          tenantId,
          basePrice: baseCost,
          marketplace: listing.store.marketplace,
        })
        return prisma.listing.update({
          where: { id: listing.id },
          data: { price: finalPrice },
        })
      })
    )

    return updates
  }
}
