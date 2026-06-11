import type { FastifyInstance } from 'fastify'
import { prisma } from '@sellsync/database'
import { z } from 'zod'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { sendPushNotification } from '../services/push.service'
import { requireRole } from '../lib/rbac'

const scryptAsync = promisify(scrypt)
const ROLES = ['OWNER', 'ADMIN', 'OPERATOR'] as const

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${hash.toString('hex')}:${salt}`
}

export async function teamRoutes(app: FastifyInstance) {
  // ─── List team members ────────────────────────────────────────────────────

  app.get('/members', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId } = (req as any).user
    return prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  })

  // ─── Update member role ───────────────────────────────────────────────────

  app.patch('/members/:id', { onRequest: [app.authenticate], preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId } = (req as any).user

    const { id } = req.params as { id: string }
    const { role } = z.object({ role: z.enum(ROLES) }).parse(req.body)

    const target = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!target) return reply.status(404).send({ error: 'Usuário não encontrado' })
    if (target.role === 'OWNER') return reply.status(400).send({ error: 'Não é possível alterar o proprietário' })

    return prisma.user.update({ where: { id }, data: { role } })
  })

  // ─── Deactivate member ────────────────────────────────────────────────────

  app.delete('/members/:id', { onRequest: [app.authenticate], preHandler: [requireRole('OWNER', 'ADMIN')] }, async (req, reply) => {
    const { tenantId, userId: callerId } = (req as any).user

    const { id } = req.params as { id: string }
    if (id === callerId) return reply.status(400).send({ error: 'Não é possível remover a si mesmo' })

    const target = await prisma.user.findFirst({ where: { id, tenantId } })
    if (!target) return reply.status(404).send({ error: 'Usuário não encontrado' })
    if (target.role === 'OWNER') return reply.status(400).send({ error: 'Não é possível remover o proprietário' })

    return prisma.user.update({ where: { id }, data: { isActive: false } })
  })

  // ─── List invitations ─────────────────────────────────────────────────────

  app.get('/invitations', { onRequest: [app.authenticate] }, async (req) => {
    const { tenantId } = (req as any).user
    return prisma.invitation.findMany({
      where: { tenantId, status: 'PENDING' },
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ─── Send invitation ──────────────────────────────────────────────────────

  app.post('/invitations', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId, userId, role: callerRole } = (req as any).user
    if (!['OWNER', 'ADMIN'].includes(callerRole)) return reply.status(403).send({ error: 'Sem permissão' })

    const { email, role } = z.object({
      email: z.string().email(),
      role: z.enum(['ADMIN', 'OPERATOR']),
    }).parse(req.body)

    const { assertPlanLimit, PlanLimitError } = await import('../services/billing.service')
    try {
      await assertPlanLimit(tenantId, 'users')
    } catch (err) {
      if (err instanceof PlanLimitError) return reply.status(402).send({ error: 'PLAN_LIMIT', message: err.message })
      throw err
    }

    // Check not already a member
    const existing = await prisma.user.findFirst({ where: { tenantId, email } })
    if (existing) return reply.status(409).send({ error: 'Este e-mail já é membro da equipe' })

    const invitation = await prisma.invitation.upsert({
      where: { tenantId_email: { tenantId, email } },
      create: {
        tenantId,
        email,
        role,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
      },
      update: {
        role,
        token: randomBytes(16).toString('hex'), // regenerate token on re-invite
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    })

    const inviteUrl = `${process.env.WEB_URL}/accept-invite?token=${invitation.token}`

    // In production: send email via SendGrid/SES
    // For now, return the URL in the response (dev mode)
    return reply.code(201).send({ id: invitation.id, email: invitation.email, inviteUrl })
  })

  // ─── Cancel invitation ────────────────────────────────────────────────────

  app.delete('/invitations/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { tenantId, role: callerRole } = (req as any).user
    if (!['OWNER', 'ADMIN'].includes(callerRole)) return reply.status(403).send({ error: 'Sem permissão' })

    const { id } = req.params as { id: string }
    await prisma.invitation.updateMany({
      where: { id, tenantId },
      data: { status: 'EXPIRED' },
    })
    return reply.status(204).send()
  })

  // ─── Accept invitation (public — no auth) ────────────────────────────────

  app.post('/invitations/accept', async (req, reply) => {
    const { token, name, password } = z.object({
      token: z.string(),
      name: z.string().min(2),
      password: z.string().min(8),
    }).parse(req.body)

    const invitation = await prisma.invitation.findUnique({ where: { token } })
    if (!invitation || invitation.status !== 'PENDING') {
      return reply.status(400).send({ error: 'Convite inválido ou expirado' })
    }
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({ where: { token }, data: { status: 'EXPIRED' } })
      return reply.status(400).send({ error: 'Convite expirado' })
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        tenantId: invitation.tenantId,
        email: invitation.email,
        name,
        passwordHash,
        role: invitation.role,
      },
    })

    await prisma.invitation.update({ where: { token }, data: { status: 'ACCEPTED' } })

    const token_jwt = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '7d' },
    )

    return reply.code(201).send({
      token: token_jwt,
      user: { id: user.id, name: user.name, email: user.email },
    })
  })
}
