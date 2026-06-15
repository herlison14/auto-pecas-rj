import { Worker } from 'bullmq'
import * as Sentry from '@sentry/node'
import { redisConnection, tokenRefreshQueue } from './queues'
import { processWebhook } from './webhook.worker'
import { processInventorySync } from './inventory.worker'
import { processOrder } from './order.worker'
import { processNfe } from './nfe.worker'
import { processListing } from './listing.worker'
import { processTokenRefresh } from './token-refresh.worker'

export async function startWorkers() {
  const workers = [
    new Worker('webhooks',       processWebhook,       { connection: redisConnection, concurrency: 10 }),
    new Worker('inventory-sync', processInventorySync, { connection: redisConnection, concurrency: 20 }),
    new Worker('orders',         processOrder,         { connection: redisConnection, concurrency: 5 }),
    new Worker('nfe',            processNfe,           { connection: redisConnection, concurrency: 3 }),
    new Worker('listings',       processListing,       { connection: redisConnection, concurrency: 5 }),
    new Worker('token-refresh',  processTokenRefresh,  { connection: redisConnection, concurrency: 1 }),
  ]

  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      Sentry.captureException(err, {
        extra: { queue: worker.name, jobId: job?.id, jobData: job?.data },
      })
    })
  }

  // Proactive token refresh every 5 hours
  await tokenRefreshQueue.add(
    'refresh-all-tokens',
    {},
    {
      repeat: { every: 5 * 60 * 60 * 1000 },
      jobId: 'token-refresh-recurring',
    },
  )
}
