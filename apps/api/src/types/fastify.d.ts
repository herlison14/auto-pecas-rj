import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      tenantId?: string
      role?: 'OWNER' | 'ADMIN' | 'OPERATOR'
      name?: string
      pending2fa?: boolean
      purpose?: string
    }
    user: {
      userId: string
      tenantId: string
      role: 'OWNER' | 'ADMIN' | 'OPERATOR'
      name: string
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
