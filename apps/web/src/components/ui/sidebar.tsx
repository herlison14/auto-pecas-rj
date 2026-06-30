'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS } from '@/lib/nav-sections'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden lg:flex w-56 flex-shrink-0 flex-col overflow-hidden"
      style={{ background: '#0b0b14', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center gap-3 px-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl relative"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          <div
            className="absolute inset-0 rounded-xl"
            style={{ boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}
          />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-white">SellSync</p>
          <p className="text-[10px] leading-none" style={{ color: '#334155' }}>Hub Multichannel</p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p
              className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: '#334155' }}
            >
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, label: itemLabel, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                    )}
                    style={active ? {
                      background: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#a5b4fc',
                    } : {
                      color: '#64748b',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
                        ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLElement).style.color = '#64748b'
                      }
                    }}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                        style={{ background: '#818cf8' }}
                      />
                    )}
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: active ? '#818cf8' : 'inherit' }}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    <span className="flex-1 truncate text-[13px]">{itemLabel}</span>
                    {active && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade card */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          className="rounded-xl p-3 relative overflow-hidden"
          style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.18)',
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold" style={{ color: '#818cf8' }}>Plano FREE</span>
              <span className="text-[10px]" style={{ color: '#334155' }}>0/5 canais</span>
            </div>
            <div className="w-full h-1 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-1 rounded-full w-0" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
            </div>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: '#818cf8' }}
            >
              Fazer upgrade <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div
            className="absolute -right-4 -top-4 h-14 w-14 rounded-full blur-2xl"
            style={{ background: 'rgba(99,102,241,0.3)' }}
          />
        </div>
      </div>
    </aside>
  )
}
