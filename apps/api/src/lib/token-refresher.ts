import axios from 'axios'
import { prisma } from '@sellsync/database'
import { encrypt, decrypt } from './crypto'

/**
 * Returns a valid, plaintext access token for the store.
 * Refreshes automatically when the token is within 5 min of expiry.
 * Handles decrypt/encrypt transparently — callers always get raw tokens.
 */
export async function getValidToken(storeId: string): Promise<string> {
  const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } })

  const isExpired = store.tokenExpiry && store.tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000

  if (!isExpired) return decrypt(store.accessToken)

  if (store.marketplace === 'MERCADO_LIVRE') {
    const { data } = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.ML_APP_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: decrypt(store.refreshToken ?? ''),
    })

    await prisma.store.update({
      where: { id: storeId },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: encrypt(data.refresh_token),
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    })

    return data.access_token as string
  }

  if (store.marketplace === 'SHOPEE') {
    const timestamp = Math.floor(Date.now() / 1000)
    const path = '/api/v2/auth/access_token/get'
    const { createHmac } = await import('node:crypto')
    const sign = createHmac('sha256', process.env.SHOPEE_PARTNER_KEY!)
      .update(`${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}`)
      .digest('hex')

    const { data } = await axios.post(
      'https://partner.shopeemobile.com/api/v2/auth/access_token/get',
      {
        refresh_token: decrypt(store.refreshToken ?? ''),
        shop_id: Number(store.externalId),
        partner_id: Number(process.env.SHOPEE_PARTNER_ID),
      },
      { params: { partner_id: process.env.SHOPEE_PARTNER_ID, timestamp, sign } },
    )

    await prisma.store.update({
      where: { id: storeId },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: encrypt(data.refresh_token),
        tokenExpiry: new Date(Date.now() + data.expire_in * 1000),
      },
    })

    return data.access_token as string
  }

  return decrypt(store.accessToken)
}
