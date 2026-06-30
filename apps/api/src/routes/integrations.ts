import type { FastifyInstance } from 'fastify'
import axios from 'axios'
import { prisma } from '@sellsync/database'
import { z } from 'zod'
import { checkAllStoresHealth, checkStoreHealth } from '../services/health.service'
import { assertPlanLimit, PlanLimitError } from '../services/billing.service'
import { encrypt } from '../lib/crypto'

const MARKETPLACES = [
  'MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU',
  'AMERICANAS', 'SHEIN', 'TIKTOK_SHOP', 'SHOPIFY', 'NUVEMSHOP',
] as const

export async function integrationsRoutes(app: FastifyInstance) {
  // ─── URL de conexão OAuth (chamado via axios, com JWT no header) ──────────
  // O frontend pede a URL aqui e redireciona o navegador para ela. Navegar
  // direto para /connect não funciona porque o browser não envia o JWT.

  app.get('/:slug/connect-url', async (req, reply) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }
    const { slug } = req.params as { slug: string }

    try {
      await assertPlanLimit(tenantId, 'stores')
    } catch (err) {
      if (err instanceof PlanLimitError) return reply.code(402).send({ error: 'PLAN_LIMIT', message: err.message })
      throw err
    }

    if (slug === 'mercadolivre') {
      if (!process.env.ML_APP_ID || !process.env.ML_REDIRECT_URI) {
        return reply.code(503).send({
          error: 'NOT_CONFIGURED',
          message:
            'As credenciais do Mercado Livre ainda não foram configuradas no servidor (ML_APP_ID e ML_REDIRECT_URI). ' +
            'Crie um app em developers.mercadolivre.com.br e configure as variáveis, ou use a conexão manual com token de acesso.',
        })
      }
      const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64url')
      const url = new URL('https://auth.mercadolivre.com.br/authorization')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('client_id', process.env.ML_APP_ID)
      url.searchParams.set('redirect_uri', process.env.ML_REDIRECT_URI)
      url.searchParams.set('state', state)
      return { url: url.toString() }
    }

    if (slug === 'shopee') {
      if (!process.env.SHOPEE_PARTNER_ID || !process.env.SHOPEE_PARTNER_KEY || !process.env.API_URL) {
        return reply.code(503).send({
          error: 'NOT_CONFIGURED',
          message:
            'As credenciais da Shopee ainda não foram configuradas no servidor (SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY e API_URL). ' +
            'Registre-se em open.shopee.com e configure as variáveis, ou use a conexão manual com token de acesso.',
        })
      }
      const timestamp = Math.floor(Date.now() / 1000)
      const path = '/api/v2/shop/auth_partner'
      const baseStr = `${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}`
      const { createHmac } = await import('node:crypto')
      const sign = createHmac('sha256', process.env.SHOPEE_PARTNER_KEY).update(baseStr).digest('hex')
      const url = new URL('https://partner.shopeemobile.com/api/v2/shop/auth_partner')
      url.searchParams.set('partner_id', process.env.SHOPEE_PARTNER_ID)
      url.searchParams.set('timestamp', String(timestamp))
      url.searchParams.set('sign', sign)
      url.searchParams.set('redirect', `${process.env.API_URL}/integrations/shopee/callback?tenantId=${tenantId}`)
      return { url: url.toString() }
    }

    return reply.code(501).send({
      error: 'NOT_IMPLEMENTED',
      message:
        'A conexão automática (OAuth) para este marketplace está em desenvolvimento. ' +
        'Enquanto isso, use a conexão manual informando o nome da loja, o ID e o token de acesso gerado no painel do marketplace.',
    })
  })

  // ─── Conexão manual (login de acesso com credenciais) ─────────────────────

  app.post('/manual', async (req, reply) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }

    try {
      await assertPlanLimit(tenantId, 'stores')
    } catch (err) {
      if (err instanceof PlanLimitError) return reply.code(402).send({ error: 'PLAN_LIMIT', message: err.message })
      throw err
    }

    const body = z.object({
      marketplace: z.enum(MARKETPLACES),
      name: z.string().min(1, 'Informe o nome da loja'),
      externalId: z.string().min(1, 'Informe o ID da loja no marketplace'),
      accessToken: z.string().min(1, 'Informe o token de acesso'),
      refreshToken: z.string().optional(),
    }).parse(req.body)

    const store = await prisma.store.upsert({
      where: {
        tenantId_marketplace_externalId: {
          tenantId,
          marketplace: body.marketplace,
          externalId: body.externalId,
        },
      },
      create: {
        tenantId,
        marketplace: body.marketplace,
        name: body.name,
        externalId: body.externalId,
        accessToken: encrypt(body.accessToken),
        refreshToken: body.refreshToken ? encrypt(body.refreshToken) : undefined,
      },
      update: {
        name: body.name,
        accessToken: encrypt(body.accessToken),
        refreshToken: body.refreshToken ? encrypt(body.refreshToken) : undefined,
        isActive: true,
      },
      select: { id: true, marketplace: true, name: true, isActive: true },
    })

    return reply.code(201).send(store)
  })

  // ─── Mercado Livre OAuth ───────────────────────────────────────────────────

  app.get('/mercadolivre/connect', async (req, reply) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64url')

    const url = new URL('https://auth.mercadolivre.com.br/authorization')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', process.env.ML_APP_ID!)
    url.searchParams.set('redirect_uri', process.env.ML_REDIRECT_URI!)
    url.searchParams.set('state', state)

    return reply.redirect(url.toString())
  })

  app.get('/mercadolivre/callback', async (req, reply) => {
    const { code, state } = req.query as { code: string; state: string }
    const { tenantId } = JSON.parse(Buffer.from(state, 'base64url').toString())

    const { data: tokens } = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.ML_APP_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: process.env.ML_REDIRECT_URI,
    })

    const { data: me } = await axios.get('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    await prisma.store.upsert({
      where: { tenantId_marketplace_externalId: { tenantId, marketplace: 'MERCADO_LIVRE', externalId: String(me.id) } },
      create: {
        tenantId,
        marketplace: 'MERCADO_LIVRE',
        name: me.nickname,
        externalId: String(me.id),
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        isActive: true,
      },
    })

    return reply.redirect(`${process.env.WEB_URL}/dashboard/integrations?connected=mercadolivre`)
  })

  // ─── Shopee OAuth ─────────────────────────────────────────────────────────

  app.get('/shopee/connect', async (req, reply) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }
    const timestamp = Math.floor(Date.now() / 1000)
    const path = '/api/v2/shop/auth_partner'
    const baseStr = `${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}`

    const { createHmac } = await import('node:crypto')
    const sign = createHmac('sha256', process.env.SHOPEE_PARTNER_KEY!).update(baseStr).digest('hex')

    const url = new URL('https://partner.shopeemobile.com/api/v2/shop/auth_partner')
    url.searchParams.set('partner_id', process.env.SHOPEE_PARTNER_ID!)
    url.searchParams.set('timestamp', String(timestamp))
    url.searchParams.set('sign', sign)
    url.searchParams.set('redirect', `${process.env.API_URL}/integrations/shopee/callback?tenantId=${tenantId}`)

    return reply.redirect(url.toString())
  })

  app.get('/shopee/callback', async (req, reply) => {
    const { code, shop_id, tenantId } = req.query as { code: string; shop_id: string; tenantId: string }
    const timestamp = Math.floor(Date.now() / 1000)
    const path = '/api/v2/auth/token/get'
    const baseStr = `${process.env.SHOPEE_PARTNER_ID}${path}${timestamp}`

    const { createHmac } = await import('node:crypto')
    const sign = createHmac('sha256', process.env.SHOPEE_PARTNER_KEY!).update(baseStr).digest('hex')

    const { data: tokens } = await axios.post('https://partner.shopeemobile.com/api/v2/auth/token/get', {
      code,
      shop_id: Number(shop_id),
      partner_id: Number(process.env.SHOPEE_PARTNER_ID),
    }, { params: { partner_id: process.env.SHOPEE_PARTNER_ID, timestamp, sign } })

    const { data: shopInfo } = await axios.get('https://partner.shopeemobile.com/api/v2/shop/get_shop_info', {
      params: {
        partner_id: Number(process.env.SHOPEE_PARTNER_ID),
        shop_id: Number(shop_id),
        access_token: tokens.access_token,
        timestamp,
        sign,
      },
    })

    await prisma.store.upsert({
      where: { tenantId_marketplace_externalId: { tenantId, marketplace: 'SHOPEE', externalId: shop_id } },
      create: {
        tenantId,
        marketplace: 'SHOPEE',
        name: shopInfo.response?.shop_name ?? `Shopee ${shop_id}`,
        externalId: shop_id,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expire_in * 1000),
      },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry: new Date(Date.now() + tokens.expire_in * 1000),
        isActive: true,
      },
    })

    return reply.redirect(`${process.env.WEB_URL}/dashboard/integrations?connected=shopee`)
  })

  // ─── Listar lojas conectadas ──────────────────────────────────────────────

  app.get('/stores', async (req) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }
    return prisma.store.findMany({
      where: { tenantId },
      select: { id: true, marketplace: true, name: true, isActive: true, createdAt: true },
    })
  })

  app.delete('/stores/:id', async (req) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }
    const { id } = req.params as { id: string }
    return prisma.store.update({
      where: { id, tenantId },
      data: { isActive: false },
    })
  })

  // ─── Health check ─────────────────────────────────────────────────────────

  app.get('/health', async (req) => {
    await req.jwtVerify()
    const { tenantId } = req.user as { tenantId: string }
    return checkAllStoresHealth(tenantId)
  })

  app.get('/health/:storeId', async (req) => {
    await req.jwtVerify()
    const { storeId } = req.params as { storeId: string }
    return checkStoreHealth(storeId)
  })
}
