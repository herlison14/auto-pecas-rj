const BASE_URL = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3'

function headers() {
  const token = process.env.ASAAS_API_KEY
  if (!token) throw new Error('Asaas não configurado (ASAAS_API_KEY ausente)')
  return {
    'Content-Type': 'application/json',
    'access_token': token,
    'User-Agent': 'SellSync/1.0',
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ errors: [{ description: res.statusText }] })) as { errors?: { description: string }[] }
    throw new Error(err.errors?.[0]?.description ?? `Asaas error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export interface AsaasCustomer {
  id: string
  name: string
  email: string
}

export interface AsaasSubscription {
  id: string
  status: 'ACTIVE' | 'INACTIVE' | 'OVERDUE'
  value: number
  nextDueDate: string
}

export interface AsaasPayment {
  id: string
  status: string
  value: number
  dueDate: string
  invoiceUrl: string
}

export const asaas = {
  createCustomer: (data: { name: string; email: string }) =>
    req<AsaasCustomer>('POST', '/customers', data),

  findCustomerByEmail: async (email: string): Promise<AsaasCustomer | null> => {
    const r = await req<{ data: AsaasCustomer[] }>('GET', `/customers?email=${encodeURIComponent(email)}&limit=1`)
    return r.data[0] ?? null
  },

  createSubscription: (data: {
    customer: string
    billingType: string
    value: number
    nextDueDate: string
    cycle: string
    description: string
    externalReference: string
  }) => req<AsaasSubscription>('POST', '/subscriptions', data),

  getSubscription: (id: string) =>
    req<AsaasSubscription>('GET', `/subscriptions/${id}`),

  cancelSubscription: (id: string) =>
    req<unknown>('DELETE', `/subscriptions/${id}`),

  getSubscriptionPayments: (subscriptionId: string) =>
    req<{ data: AsaasPayment[] }>('GET', `/subscriptions/${subscriptionId}/payments?limit=5`),
}
