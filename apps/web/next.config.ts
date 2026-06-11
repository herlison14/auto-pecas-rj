import type { NextConfig } from 'next'

// O frontend chama sempre /backend/* (same-origin) e o Next faz proxy para a
// API real. Isso elimina CORS e qualquer dependência de env var embutida no
// bundle — a classe inteira de erros "Network Error" por URL errada some.
const API_TARGET =
  process.env.API_PROXY_TARGET ??
  (process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001'
    : 'https://auto-pecas-rj.onrender.com')

const config: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${API_TARGET}/:path*`,
      },
    ]
  },
}

export default config
