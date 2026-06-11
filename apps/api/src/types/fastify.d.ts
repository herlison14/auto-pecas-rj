import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      tenantId?: string
      role?: 'OWNER' | 'ADMIN' | 'OPERATOR'
      pending2fa?: boolean
      // Tokens de propósito específico (ex: 'pwreset' para redefinição de senha)
      purpose?: string
    }
    user: {
      userId: string
      tenantId: string
      role: 'OWNER' | 'ADMIN' | 'OPERATOR'
      pending2fa?: boolean
      purpose?: string
    }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => Promise<void>
  }
}
