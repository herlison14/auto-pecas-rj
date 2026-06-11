import { PrismaClient } from '@prisma/client'

// Modelos com coluna tenantId — alvo da guarda de multi-tenancy abaixo
const TENANT_MODELS = new Set([
  'AuditLog', 'EmailSettings', 'FinancialTransaction', 'Invitation', 'NfeSettings',
  'Notification', 'Order', 'PriceHistory', 'PricingRule', 'Product', 'PurchaseOrder',
  'PushToken', 'RepricingRule', 'Return', 'Store', 'Supplier', 'User', 'Warehouse',
])

// Operações em massa onde esquecer o tenantId vaza/afeta dados de outros clientes
const BULK_OPS = new Set(['findMany', 'updateMany', 'deleteMany', 'count', 'aggregate', 'groupBy'])

function hasTenantFilter(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false
  const w = where as Record<string, unknown>
  if ('tenantId' in w) return true
  // Filtros relacionais (ex: { order: { tenantId } } ou { store: { tenantId } }) contam
  return Object.values(w).some((v) => v && typeof v === 'object' && hasTenantFilter(v))
}

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  // Guarda de multi-tenancy: avisa (não bloqueia) quando uma operação em massa
  // num modelo multi-tenant roda sem filtro de tenantId — a classe de bug mais
  // perigosa num SaaS. O stack no log aponta o chamador.
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && TENANT_MODELS.has(model) && BULK_OPS.has(operation)) {
            const where = (args as { where?: unknown })?.where
            if (!hasTenantFilter(where)) {
              console.warn(
                `[tenant-guard] ${model}.${operation} sem filtro de tenantId — possível vazamento entre tenants`,
                new Error().stack?.split('\n').slice(2, 5).join('\n'),
              )
            }
          }
          return query(args)
        },
      },
    },
  }) as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
