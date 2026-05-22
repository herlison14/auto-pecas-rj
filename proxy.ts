import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/**
 * Proxy.ts (Next 16) — auth check edge-safe.
 * Usa apenas authConfig SEM adapter Drizzle pra não puxar
 * @neondatabase/serverless na boundary do middleware.
 * O callback `authorized` em auth.config faz redirect/protect.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
