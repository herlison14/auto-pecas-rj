'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import * as Sentry from '@sentry/nextjs'

/**
 * Bloqueia o dashboard sem login válido.
 *
 * 1. Sem token na sessão do navegador → vai direto para /login (o cookie
 *    sozinho não basta — ele só existe junto de uma sessão autenticada).
 * 2. Com token → valida no servidor via /auth/me; token inválido/expirado
 *    recebe 401 e o interceptor global limpa tudo e redireciona.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = sessionStorage.getItem('sellsync:token')
    if (!token) {
      document.cookie = 'sellsync:token=; path=/; max-age=0'
      router.replace('/login')
      return
    }
    setChecked(true)
    // Validação no servidor em segundo plano — 401 derruba a sessão
    api.get('/auth/me').then(({ data }) => {
      // Sentry user context para rastrear erros por usuário/tenant
      Sentry.setUser({ id: data.id, email: data.email })
      if (data.tenant?.id) Sentry.setTag('tenant_id', data.tenant.id)
      if (data.tenant?.plan) Sentry.setTag('plan', data.tenant.plan)
    }).catch(() => { /* interceptor 401 redireciona */ })
  }, [router])

  if (!checked) return null
  return <>{children}</>
}
