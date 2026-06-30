'use client'

import Link from 'next/link'
import { Zap, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'

export function OnboardingBanner() {
  const { tenant } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !tenant || tenant.onboardingCompletedAt) return null

  return (
    <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary">
        <Zap className="h-3.5 w-3.5 text-primary-foreground" />
      </div>
      <p className="flex-1 text-foreground font-medium">
        Complete a configuração inicial para aproveitar todos os recursos do SellSync.
      </p>
      <Link
        href="/onboarding"
        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline shrink-0"
      >
        Configurar agora <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Fechar aviso de configuração"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
