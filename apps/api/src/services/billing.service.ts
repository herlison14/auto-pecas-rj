import Stripe from 'stripe'
import { prisma } from '@sellsync/database'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-02-24.acacia' })

export const PLANS = {
  FREE: {
    name: 'Free',
    priceId: null,
    limits: { orders: 100, stores: 2, users: 1 },
  },
  STARTER: {
    name: 'Starter',
    priceId: process.env.STRIPE_PRICE_STARTER,
    limits: { orders: 1000, stores: 5, users: 3 },
  },
  GROWTH: {
    name: 'Growth',
    priceId: process.env.STRIPE_PRICE_GROWTH,
    limits: { orders: 10000, stores: 15, users: 10 },
  },
  PRO: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRICE_PRO,
    limits: { orders: -1, stores: -1, users: -1 }, // -1 = ilimitado
  },
} as const

export type PlanKey = keyof typeof PLANS

export class BillingService {
  async createCheckoutSession(tenantId: string, plan: PlanKey, successUrl: string, cancelUrl: string) {
    const priceId = PLANS[plan].priceId
    if (!priceId) throw new Error('Plano inválido ou gratuito')

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: tenantId,
      customer_email: (await prisma.user.findFirst({ where: { tenantId, role: 'OWNER' } }))?.email,
      metadata: { tenantId, plan },
      subscription_data: {
        metadata: { tenantId, plan },
      },
    })

    return { url: session.url }
  }

  async createPortalSession(tenantId: string, returnUrl: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })

    // Busca customerId salvo (em produção, salvar no banco)
    const customers = await stripe.customers.search({ query: `metadata['tenantId']:'${tenantId}'` })
    if (!customers.data.length) throw new Error('Nenhuma assinatura encontrada')

    const session = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: returnUrl,
    })

    return { url: session.url }
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const tenantId = session.metadata?.tenantId
      const plan = session.metadata?.plan as PlanKey | undefined

      if (tenantId && plan) {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { plan },
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const tenantId = sub.metadata?.tenantId
      if (tenantId) {
        await prisma.tenant.update({ where: { id: tenantId }, data: { plan: 'FREE' } })
      }
    }

    return { received: true }
  }

  async getCurrentPlan(tenantId: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } })
    const plan = tenant.plan as PlanKey
    return { plan, ...PLANS[plan] }
  }
}
