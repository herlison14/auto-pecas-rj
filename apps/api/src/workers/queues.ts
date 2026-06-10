import { Queue } from 'bullmq'

function parseRedisUrl(url: string) {
  try {
    const u = new URL(url)
    const tls = u.protocol === 'rediss:' ? { tls: true } : {}
    return {
      host: u.hostname,
      port: Number(u.port) || 6379,
      password: u.password || undefined,
      maxRetriesPerRequest: null as null,
      enableReadyCheck: false,
      ...tls,
    }
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null as null, enableReadyCheck: false }
  }
}

export const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://localhost:6379')

export const webhookQueue      = new Queue('webhooks',       { connection: redisConnection })
export const inventorySyncQueue = new Queue('inventory-sync', { connection: redisConnection })
export const orderQueue         = new Queue('orders',         { connection: redisConnection })
export const nfeQueue           = new Queue('nfe',            { connection: redisConnection })
export const listingQueue       = new Queue('listings',       { connection: redisConnection })
