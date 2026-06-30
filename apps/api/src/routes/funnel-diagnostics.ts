import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../lib/rbac'
import { assertSdeAccess, PlanLimitError } from '../services/billing.service'
import { parseFunnelSpreadsheet, importFunnelSnapshots } from '../services/funnel-import.service'
import { listSnapshots, listDiagnostics, generateDiagnosis } from '../services/funnel-diagnostic.service'
import { anthropicEnabled } from '../lib/anthropic'

const MARKETPLACE_VALUES = [
  'MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU', 'AMERICANAS', 'SHEIN', 'TIKTOK_SHOP', 'SHOPIFY', 'NUVEMSHOP',
] as const

const listSnapshotsQuerySchema = z.object({
  productId: z.string().optional(),
  marketplace: z.enum(MARKETPLACE_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const listDiagnosticsQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function funnelDiagnosticsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => { await req.jwtVerify() })

  // POST /funnel-diagnostics/import — multipart upload de planilha de funil
  app.post('/import', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }

    try {
      await assertSdeAccess(tenantId)
    } catch (err) {
      if (err instanceof PlanLimitError) return reply.status(402).send({ error: 'PLAN_LIMIT', message: err.message })
      throw err
    }

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk as Buffer)
    const buffer = Buffer.concat(chunks)

    const isXlsx = buffer.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    const isCsv = data.mimetype === 'text/csv' || data.filename.match(/\.csv$/i)
    if (!isXlsx && !isCsv) {
      return reply.status(400).send({ error: 'Formato inválido. Use CSV ou XLSX.' })
    }

    let rows
    try {
      rows = await parseFunnelSpreadsheet(buffer)
    } catch {
      return reply.status(400).send({ error: 'Não foi possível ler o arquivo. Verifique o formato.' })
    }

    if (rows.length === 0) return reply.status(400).send({ error: 'Arquivo vazio ou sem dados válidos.' })
    if (rows.length > 2000) return reply.status(400).send({ error: 'Máximo de 2.000 linhas por importação.' })

    const result = await importFunnelSnapshots(rows, tenantId)
    return reply.send(result)
  })

  // GET /funnel-diagnostics/snapshots — lista paginada de snapshots de funil
  app.get('/snapshots', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const query = listSnapshotsQuerySchema.safeParse(req.query)
    if (!query.success) return reply.status(400).send({ error: 'Parâmetros inválidos', details: query.error.flatten() })

    return listSnapshots(tenantId, query.data)
  })

  // POST /funnel-diagnostics/snapshots/:id/diagnose — dispara o diagnóstico de IA
  app.post('/snapshots/:id/diagnose', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const { id } = req.params as { id: string }

    try {
      await assertSdeAccess(tenantId)
    } catch (err) {
      if (err instanceof PlanLimitError) return reply.status(402).send({ error: 'PLAN_LIMIT', message: err.message })
      throw err
    }

    if (!anthropicEnabled) {
      return reply.status(503).send({ error: 'AI_DISABLED', message: 'Diagnóstico por IA não está configurado neste ambiente.' })
    }

    try {
      const diagnostic = await generateDiagnosis(tenantId, id)
      return reply.code(201).send(diagnostic)
    } catch (err) {
      if (err instanceof Error && err.message.includes('não encontrado')) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })

  // GET /funnel-diagnostics/diagnostics — lista paginada de diagnósticos já gerados
  app.get('/diagnostics', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const query = listDiagnosticsQuerySchema.safeParse(req.query)
    if (!query.success) return reply.status(400).send({ error: 'Parâmetros inválidos', details: query.error.flatten() })

    return listDiagnostics(tenantId, query.data)
  })
}
