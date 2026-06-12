import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// O frontend chama sempre /backend/* (same-origin) e o Next faz proxy para a
// API real. Isso elimina CORS e qualquer dependência de env var embutida no
// bundle — a classe inteira de erros "Network Error" por URL errada some.
const API_TARGET =
  process.env.API_PROXY_TARGET ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : 'https://auto-pecas-rj.onrender.com')

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${API_TARGET}/:path*`,
      },
    ]
  },
}

// withSentryConfig só age quando SENTRY_AUTH_TOKEN está definido (build de CI/prod)
// Em dev local sem a var, exporta nextConfig puro
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT ?? 'sellsync-web',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      tunnelRoute: '/monitoring',
      silent: !process.env.CI,
      disableLogger: true,
    })
  : nextConfig
