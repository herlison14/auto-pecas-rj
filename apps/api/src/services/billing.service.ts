import { prisma } from '@sellsync/database'
import { asaas } from '../lib/asaas'

export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    limits: { orders: 100, stores: 2, users: 1 },
  },
  STARTER: {
    name: 'Starter',
    price: 79.00,
    limits: { orders: 1000, stores: 5, users: 3 },
  },
  GROWTH: {
    name: 'Growth',
    price: 199.00,
    limits: { orders: 10000, stores: 15, users: 10 },
  },
  PRO: {
    name: 'Pro',
    price: 399.00,
    limits: { orders: -1, stores: -1, users: -1 },
  },
} as const

export type PlanKey = keyof typeof PLANS

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanLimitError'
  }
}

export async function assertPlanLimit(tenantId: string, resource: 'stores' | 'users') {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { plan: true } })
  const plan = PLANS[tenant.plan as PlanKey] ?? PLANS.FREE
  const limit = plan.limits[resource]
  if (limit === -1) return

  const count = resource === 'stores'
    ? await prisma.store.count({ where: { tenantId, isActive: true } })
    : await prisma.user.count({ where: { tenantId } })

  if (count >= limit) {
    const label = resource === 'stores' ? 'lojas conectadas' : 'usuários'
    throw new PlanLimitError(
      `Limite de ${limit} ${label} do plano ${plan.name} atingido. Faça upgrade em Configurações → Plano para adicionar mais.`,
    )
  }
}

export class BillingService {
  private async getOrCreateCustomer(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { asaasCustomerId: true, name: true },
    })
    if (tenant.asaasCustomerId) return tenant.asaasCustomerId

    const owner = await prisma.user.findFirstOrThrow({
      where: { tenantId, role: 'OWNER' },
      select: { email: true },
    })

    let customer = await asaas.findCustomerByEmail(owner.email)
    if (!customer) {
      customer = await asaas.createCustomer({ name: tenant.name, email: owner.email })
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { asaasCustomerId: customer.id },
    })

    return customer.id
  }

  async createCheckoutSession(tenantId: string, plan: PlanKey) {
    const planConfig = PLANS[plan]
    if (planConfig.price === 0) throw new Error('Plano inválido ou gratuito')

    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { asaasSubscriptionId: true },
    })

    // Cancel existing subscription silently before creating new one
    if (tenant.asaasSubscriptionId) {
      await asaas.cancelSubscription(tenant.asaasSubscriptionId).catch(() => {})
      await prisma.tenant.update({ where: { id: tenantId }, data: { asaasSubscriptionId: null } })
    }

    const customerId = await this.getOrCreateCustomer(tenantId)

    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 1)
    const dueDateStr = nextDueDate.toISOString().split('T')[0]

    const subscription = await asaas.createSubscription({
      customer: customerId,
      billingType: 'UNDEFINED',
      value: planConfig.price,
      nextDueDate: dueDateStr,
      cycle: 'MONTHLY',
      description: `SellSync — Plano ${planConfig.name}`,
      externalReference: `${tenantId}:${plan}`,
    })

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { asaasSubscriptionId: subscription.id },
    })

    // Get first pending payment to get checkout URL
    const payments = await asaas.getSubscriptionPayments(subscription.id)
    const invoiceUrl = payments.data.find((p) => p.status === 'PENDING')?.invoiceUrl
      ?? payments.data[0]?.invoiceUrl

    if (!invoiceUrl) throw new Error('Não foi possível gerar o link de pagamento')

    return { url: invoiceUrl }
  }

  async cancelSubscription(tenantId: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { asaasSubscriptionId: true },
    })

    if (!tenant.asaasSubscriptionId) throw new Error('Nenhuma assinatura ativa')

    await asaas.cancelSubscription(tenant.asaasSubscriptionId)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan: 'FREE', asaasSubscriptionId: null },
    })

    return { cancelled: true }
  }

  async handleWebhook(body: Record<string, unknown>, webhookToken: string | undefined) {
    // Verify with API key (Asaas sends access_token header on webhooks)
    const expectedToken = process.env.ASAAS_API_KEY
    if (expectedToken && webhookToken !== expectedToken) {
      throw new Error('Invalid webhook token')
    }

    const event = body.event as string
    const payment = body.payment as { externalReference?: string } | undefined

    const parseRef = (ref?: string) => {
      if (!ref?.includes(':')) return null
      const idx = ref.indexOf(':')
      return { tenantId: ref.slice(0, idx), plan: ref.slice(idx + 1) as PlanKey }
    }

    const ref = parseRef(payment?.externalReference)

    if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && ref?.tenantId) {
      await prisma.tenant.update({
        where: { id: ref.tenantId },
        data: { plan: ref.plan },
      })
    }

    if (event === 'SUBSCRIPTION_DELETED' && payment?.externalReference) {
      const r = parseRef(payment.externalReference)
      if (r?.tenantId) {
        await prisma.tenant.update({
          where: { id: r.tenantId },
          data: { plan: 'FREE', asaasSubscriptionId: null },
        })
      }
    }

    return { received: true }
  }

  async getCurrentPlan(tenantId: string) {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plan: true, asaasSubscriptionId: true },
    })
    const plan = tenant.plan as PlanKey

    let subscriptionStatus: string | null = null
    let nextPaymentUrl: string | null = null

    if (tenant.asaasSubscriptionId) {
      const sub = await asaas.getSubscription(tenant.asaasSubscriptionId).catch(() => null)
      subscriptionStatus = sub?.status ?? null

      if (sub?.status === 'OVERDUE') {
        const payments = await asaas.getSubscriptionPayments(tenant.asaasSubscriptionId).catch(() => null)
        nextPaymentUrl = payments?.data.find((p) => p.status === 'OVERDUE')?.invoiceUrl ?? null
      }
    }

    return { key: plan, subscriptionStatus, nextPaymentUrl, ...PLANS[plan] }
  }
}
