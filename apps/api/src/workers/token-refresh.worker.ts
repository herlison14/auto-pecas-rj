import type { Job } from 'bullmq'
import { prisma } from '@sellsync/database'
import { getValidToken } from '../lib/token-refresher'

// Proactively refreshes marketplace tokens that expire within 6 hours.
// Runs every 5 hours via BullMQ repeatable job.
export async function processTokenRefresh(_job: Job) {
  const expiringSoon = await prisma.store.findMany({
    where: {
      isActive: true,
      refreshToken: { not: null },
      marketplace: { in: ['MERCADO_LIVRE', 'SHOPEE'] },
      OR: [
        { tokenExpiry: null },
        { tokenExpiry: { lt: new Date(Date.now() + 6 * 60 * 60 * 1000) } },
      ],
    },
    select: { id: true, marketplace: true },
  })

  const results = await Promise.allSettled(
    expiringSoon.map((s) => getValidToken(s.id)),
  )

  const failed = results.filter((r) => r.status === 'rejected').length
  return { refreshed: expiringSoon.length - failed, failed }
}
