import type { NextAuthConfig } from 'next-auth';

/**
 * Config minimalista de NextAuth — sem providers, sem adapter.
 * Usado APENAS no proxy.ts (que roda em edge/middleware boundary).
 * O adapter Drizzle + provider Credentials estão no lib/auth.ts.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!session?.user;

      const isAuthRoute =
        pathname.startsWith('/login') || pathname.startsWith('/registro');
      const isProtected =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/busca') ||
        pathname.startsWith('/prospects') ||
        pathname.startsWith('/campanhas') ||
        pathname.startsWith('/settings');

      if (isProtected && !isLoggedIn) return false;
      if (isAuthRoute && isLoggedIn) {
        return Response.redirect(new URL('/dashboard', request.nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
