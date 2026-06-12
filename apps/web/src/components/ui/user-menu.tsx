'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, LogOut, ChevronDown, Crown, Zap, Shield } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const PLAN_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  FREE:    { label: 'Free',    color: '#64748b', icon: Zap },
  STARTER: { label: 'Starter', color: '#6366f1', icon: Zap },
  GROWTH:  { label: 'Growth',  color: '#8b5cf6', icon: Shield },
  PRO:     { label: 'Pro',     color: '#f59e0b', icon: Crown },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

export function UserMenu() {
  const { user, tenant, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!user) return null

  const planKey = (tenant?.plan ?? 'FREE').toUpperCase()
  const plan = PLAN_CONFIG[planKey] ?? PLAN_CONFIG.FREE
  const PlanIcon = plan.icon
  const initials = getInitials(user.name)

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Menu do usuário — ${user.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors"
        style={{ border: '1px solid transparent' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
        }}
      >
        {/* Avatar */}
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Name + plan — hidden on small screens */}
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold leading-none mb-0.5 max-w-[96px] truncate" style={{ color: '#e2e8f0' }}>
            {user.name.split(' ')[0]}
          </p>
          <div className="flex items-center gap-1">
            <PlanIcon className="h-2.5 w-2.5" style={{ color: plan.color }} aria-hidden="true" />
            <span className="text-[10px] font-medium" style={{ color: plan.color }}>
              {plan.label}
            </span>
          </div>
        </div>

        <ChevronDown
          className={cn('h-3 w-3 transition-transform duration-200 hidden sm:block', open && 'rotate-180')}
          style={{ color: '#475569' }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Opções do usuário"
          className="absolute right-0 top-10 z-50 w-56 rounded-xl shadow-2xl animate-fade-in"
          style={{
            background: 'rgba(15,15,25,0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* User info header */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#f1f5f9' }}>{user.name}</p>
                <p className="text-xs truncate" style={{ color: '#64748b' }}>{user.email}</p>
              </div>
            </div>

            {tenant && (
              <div
                className="flex items-center justify-between mt-3 rounded-lg px-2.5 py-2"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
              >
                <div className="flex items-center gap-1.5">
                  <PlanIcon className="h-3 w-3" style={{ color: plan.color }} />
                  <span className="text-xs font-semibold" style={{ color: plan.color }}>Plano {plan.label}</span>
                </div>
                <span className="text-[10px] truncate max-w-[80px]" style={{ color: '#475569' }}>
                  {tenant.name}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="py-1.5">
            <Link
              role="menuitem"
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
                ;(e.currentTarget as HTMLElement).style.color = '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
              }}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Configurações
            </Link>

            {planKey === 'FREE' && (
              <Link
                role="menuitem"
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors"
                style={{ color: '#818cf8' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.08)'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <Crown className="h-4 w-4" aria-hidden="true" />
                Fazer upgrade
              </Link>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-4 py-2 text-sm transition-colors"
              style={{ color: '#f87171' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
