import { Worker } from 'bullmq'
import * as Sentry from '@sentry/node'
import { redisConnection } from './queues'
import { processWebhook } from './webhook.worker'
import { processInventorySync } from './inventory.worker'
import { processOrder } from './order.worker'
import { processNfe } from './nfe.worker'
import { processListing } from './listing.worker'

export async function startWorkers() {
  const workers = [
    new Worker('webhooks',       processWebhook,       { connection: redisConnection, concurrency: 10 }),
    new Worker('inventory-sync', processInventorySync, { connection: redisConnection, concurrency: 20 }),
    new Worker('orders',         processOrder,         { connection: redisConnection, concurrency: 5 }),
    new Worker('nfe',            processNfe,           { connection: redisConnection, concurrency: 3 }),
    new Worker('listings',       processListing,       { connection: redisConnection, concurrency: 5 }),
  ]

  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      Sentry.captureException(err, {
        extra: { queue: worker.name, jobId: job?.id, jobData: job?.data },
      })
    })
  }
}
