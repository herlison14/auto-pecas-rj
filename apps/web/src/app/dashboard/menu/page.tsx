'use client'

import Link from 'next/link'
import { X, ChevronRight } from 'lucide-react'
import { NAV_SECTIONS } from '@/lib/nav-sections'

export default function MobileMenuPage() {
  return (
    <div className="animate-fade-in mx-auto max-w-lg p-4 pb-10 lg:hidden">
      <div className="mb-6 flex items-center justify-between pt-2">
        <div>
          <p className="text-lg font-bold text-white">Menu completo</p>
          <p className="text-xs" style={{ color: '#64748b' }}>Todas as seções do SellSync</p>
        </div>
        <Link
          href="/dashboard"
          aria-label="Fechar menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <X className="h-4 w-4" style={{ color: '#94a3b8' }} />
        </Link>
      </div>

      <div className="space-y-6">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p
              className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: '#334155' }}
            >
              {label}
            </p>
            <div
              className="overflow-hidden rounded-xl"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15,15,25,0.9)' }}
            >
              {items.map(({ href, label: itemLabel, icon: Icon }, i) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.04]"
                  style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : undefined}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(99,102,241,0.12)' }}
                  >
                    <Icon className="h-4 w-4" style={{ color: '#818cf8' }} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-white">{itemLabel}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: '#334155' }} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
