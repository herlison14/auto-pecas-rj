import type { NextConfig } from 'next'

// NEXT_PUBLIC_API_URL é inlined automaticamente pelo Next.js quando definido
// no momento do build. Não usar o bloco `env` aqui: com fallback para
// localhost ele embutia 'http://localhost:3001' no bundle de produção,
// impedindo o fallback de runtime em src/lib/api.ts de funcionar.
const config: NextConfig = {}

export default config
