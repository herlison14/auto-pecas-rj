import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sellsync/database'
import { sendEmailNotification } from '../services/email.service'
import { requireRole } from '../lib/rbac'

const settingsSchema = z.object({
  provider: z.enum(['smtp', 'resend']).default('smtp'),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  resendApiKey: z.string().optional(),
  notifyLowStock: z.boolean().default(true),
  notifyNewOrder: z.boolean().default(false),
  notifyNfeError: z.boolean().default(true),
  notifyReturn: z.boolean().default(true),
})

export async function emailSettingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => { await req.jwtVerify() })

  app.get('/', async (req) => {
    const { tenantId } = req.user as { tenantId: string }
    const s = await prisma.emailSettings.findUnique({ where: { tenantId } })
    // Mask sensitive fields in response
    if (s?.smtpPass) (s as any).smtpPass = '••••••••'
    if (s?.resendApiKey) (s as any).resendApiKey = s.resendApiKey.slice(0, 8) + '...'
    return s ?? {}
  })

  app.put('/', { preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const body = settingsSchema.parse(req.body)
    const existing = await prisma.emailSettings.findUnique({ where: { tenantId } })

    // Don't overwrite masked values sent back by client
    const data: any = { ...body }
    if (existing && body.smtpPass === '••••••••') delete data.smtpPass
    if (existing && body.resendApiKey?.endsWith('...')) delete data.resendApiKey

    const settings = existing
      ? await prisma.emailSettings.update({ where: { tenantId }, data })
      : await prisma.emailSettings.create({ data: { tenantId, ...data } })

    return reply.code(existing ? 200 : 201).send(settings)
  })

  app.post('/test', async (req, reply) => {
    const { tenantId } = req.user as { tenantId: string }
    const s = await prisma.emailSettings.findUnique({ where: { tenantId } })
    if (!s?.fromEmail) return reply.code(400).send({ error: 'Configure o e-mail de envio primeiro' })

    await sendEmailNotification(tenantId, {
      to: s.fromEmail,
      subject: '✅ Teste de configuração SellSync',
      html: `<p style="font-family:sans-serif;color:#111827">Suas notificações por e-mail estão configuradas corretamente no <strong>SellSync</strong>!</p>`,
    })

    return { ok: true }
  })
}
