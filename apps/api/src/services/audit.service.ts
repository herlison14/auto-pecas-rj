import { prisma } from '@sellsync/database'

export interface AuditParams {
  tenantId: string
  userId?: string
  userName?: string
  action: string
  entity: string
  entityId?: string
  before?: unknown
  after?: unknown
  ip?: string
}

export async function logAudit(params: AuditParams) {
  return prisma.auditLog.create({
    data: { ...params, before: params.before as any, after: params.after as any },
  })
}

export async function listAuditLogs(tenantId: string, {
  entity, userId, page = 1, limit = 50,
}: { entity?: string; userId?: string; page?: number; limit?: number } = {}) {
  const where = {
    tenantId,
    entity: entity ?? undefined,
    userId: userId ?? undefined,
  }
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])
  return { logs, total, page, pages: Math.ceil(total / limit) }
}
