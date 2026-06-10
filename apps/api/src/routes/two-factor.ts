import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@sellsync/database'
import { generateSecret, verifyTotp, getTotpUri, getQrCodeUrl } from '../services/totp.service'

export async function twoFactorRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => { await req.jwtVerify() })

  // GET /2fa/status
  app.get('/status', async (req) => {
    const { userId } = req.user as { userId: string }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactorEnabled: true } })
    return { enabled: user.twoFactorEnabled }
  })

  // POST /2fa/setup — generate secret, return QR
  app.post('/setup', async (req) => {
    const { userId } = req.user as { userId: string }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, twoFactorEnabled: true } })

    if (user.twoFactorEnabled) return { alreadyEnabled: true }

    const secret = generateSecret()
    // Store secret temporarily — not yet enabled
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } })

    const uri = getTotpUri(secret, user.email)
    return { secret, qrCodeUrl: getQrCodeUrl(uri), uri }
  })

  // POST /2fa/enable — verify code and activate
  app.post('/enable', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!user.twoFactorSecret) return reply.code(400).send({ error: 'Execute /2fa/setup primeiro' })
    if (!verifyTotp(user.twoFactorSecret, token)) return reply.code(400).send({ error: 'Código inválido' })

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } })
    return { enabled: true }
  })

  // POST /2fa/disable
  app.post('/disable', async (req, reply) => {
    const { userId } = req.user as { userId: string }
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!user.twoFactorEnabled) return reply.code(400).send({ error: '2FA não está ativo' })
    if (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, token)) {
      return reply.code(400).send({ error: 'Código inválido' })
    }

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } })
    return { enabled: false }
  })

  // POST /2fa/verify — used during login
  app.post('/verify', async (req, reply) => {
    const { token, tempToken } = z.object({ token: z.string().length(6), tempToken: z.string() }).parse(req.body)

    let payload: { userId: string; tenantId: string; role: string; pending2fa: boolean }
    try {
      payload = app.jwt.verify(tempToken) as any
    } catch {
      return reply.code(401).send({ error: 'Token inválido' })
    }

    if (!payload.pending2fa) return reply.code(400).send({ error: 'Token não requer 2FA' })

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: payload.userId },
      include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
    })

    if (!user.twoFactorEnabled || !user.twoFactorSecret) return reply.code(400).send({ error: '2FA não configurado' })
    if (!verifyTotp(user.twoFactorSecret, token)) return reply.code(401).send({ error: 'Código incorreto' })

    const finalToken = app.jwt.sign({ userId: payload.userId, tenantId: payload.tenantId, role: payload.role as 'OWNER' | 'ADMIN' | 'OPERATOR' }, { expiresIn: '7d' })
    return { token: finalToken }
  })
}
