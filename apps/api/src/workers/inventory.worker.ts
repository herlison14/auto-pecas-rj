import type { Job } from 'bullmq'
import { prisma } from '@sellsync/database'
import { MarketplaceAdapterFactory } from '@sellsync/integrations'
import { notifyTenantLowStock } from '../services/push.service'
import { getValidToken } from '../lib/token-refresher'

const LOW_STOCK_THRESHOLD = 5

export async function processInventorySync(job: Job<{ productId: string; tenantId: string }>) {
  const { productId, tenantId } = job.data

  const stockItems = await prisma.stockItem.findMany({
    where: { productId },
    select: { quantity: true, reserved: true },
  })

  const available = stockItems.reduce((sum, s) => sum + s.quantity - s.reserved, 0)

  const listings = await prisma.listing.findMany({
    where: {
      productId,
      status: 'ACTIVE',
      store: { tenantId },
    },
    include: { store: true },
  })

  await Promise.allSettled(
    listings.map(async (listing) => {
      const accessToken = await getValidToken(listing.store.id)
      const adapter = await MarketplaceAdapterFactory.create({ ...listing.store, accessToken })
      await adapter.updateStock(listing.externalId, available)
    })
  )

  // Push low stock alert when crossing zero or low threshold
  if (available <= LOW_STOCK_THRESHOLD) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, sku: true },
    })
    if (product) {
      await notifyTenantLowStock(tenantId, [{ name: product.name, sku: product.sku, stock: available }])
    }
  }
}
