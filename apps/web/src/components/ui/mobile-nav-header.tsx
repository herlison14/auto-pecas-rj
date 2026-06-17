'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { findNavLabel } from '@/lib/nav-sections'

export function MobileNavHeader() {
  const pathname = usePathname()

  if (pathname === '/dashboard/menu') return null

  return (
    <div className="flex items-center gap-2 min-w-0 lg:hidden">
      <Link
        href="/dashboard/menu"
        aria-label="Abrir menu completo"
        className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors"
        style={{ color: '#94a3b8' }}
      >
        <Menu className="h-5 w-5" />
      </Link>
      <span className="text-sm font-semibold text-white truncate">{findNavLabel(pathname)}</span>
    </div>
  )
}
