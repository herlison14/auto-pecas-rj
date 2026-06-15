import type { Job } from 'bullmq'
import { prisma } from '@sellsync/database'
import axios from 'axios'
import { getValidToken } from '../lib/token-refresher'

interface PublishJobData {
  listingId: string
  tenantId: string
}

export async function processListing(job: Job<PublishJobData>) {
  const { listingId, tenantId } = job.data

  const listing = await prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: {
      product: true,
      store: true,
    },
  })

  if (listing.store.tenantId !== tenantId) throw new Error('Unauthorized')

  const { store, product } = listing
  const accessToken = await getValidToken(store.id)

  if (store.marketplace === 'MERCADO_LIVRE') {
    const { data } = await axios.post(
      'https://api.mercadolibre.com/items',
      {
        title: listing.title,
        category_id: listing.categoryId ?? 'MLB3530', // fallback: Outros
        price: Number(listing.price),
        currency_id: 'BRL',
        available_quantity: await getAvailableStock(product.id),
        buying_mode: 'buy_it_now',
        listing_type_id: 'gold_special',
        condition: 'new',
        description: { plain_text: product.description ?? listing.title },
        pictures: product.images.map((url) => ({ source: url })),
        attributes: buildMlAttributes(product),
        seller_custom_field: product.sku,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    await prisma.listing.update({
      where: { id: listingId },
      data: { externalId: data.id, status: 'ACTIVE', syncedAt: new Date() },
    })
    return
  }

  if (store.marketplace === 'SHOPEE') {
    const timestamp = Math.floor(Date.now() / 1000)
    const path = '/api/v2/product/add_item'
    const { createHmac } = await import('node:crypto')
    const sign = createHmac('sha256', process.env.SHOPEE_PARTNER_KEY!)
      .update(`${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}${accessToken}${store.externalId}`)
      .digest('hex')

    const stock = await getAvailableStock(product.id)

    const { data } = await axios.post(
      `https://partner.shopeemobile.com/api/v2/product/add_item`,
      {
        original_price: Number(listing.price),
        description: product.description ?? listing.title,
        item_name: listing.title,
        normal_stock: stock,
        weight: product.weight ?? 0.3,
        dimension: {
          package_length: Math.round((product.length ?? 10) * 10),
          package_width: Math.round((product.width ?? 10) * 10),
          package_height: Math.round((product.height ?? 10) * 10),
        },
        logistic_info: [{ logistic_id: 80010, enabled: true }],
        seller_stock: [{ stock }],
        image: { image_url_list: product.images.slice(0, 9) },
      },
      {
        params: {
          partner_id: Number(process.env.SHOPEE_PARTNER_ID),
          shop_id: Number(store.externalId),
          access_token: accessToken,
          timestamp,
          sign,
        },
      },
    )

    await prisma.listing.update({
      where: { id: listingId },
      data: { externalId: String(data.response?.item_id ?? listingId), status: 'ACTIVE', syncedAt: new Date() },
    })
    return
  }

  throw new Error(`Publishing not yet implemented for: ${store.marketplace}`)
}

async function getAvailableStock(productId: string): Promise<number> {
  const items = await prisma.stockItem.findMany({ where: { productId } })
  return items.reduce((sum, i) => sum + i.quantity - i.reserved, 0)
}

function buildMlAttributes(product: { brand?: string | null; gtin?: string | null }) {
  const attrs = []
  if (product.brand) attrs.push({ id: 'BRAND', value_name: product.brand })
  if (product.gtin) attrs.push({ id: 'GTIN', value_name: product.gtin })
  return attrs
}
