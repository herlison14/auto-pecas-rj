'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Warehouse, Package,
  Plug, DollarSign, BarChart3, Settings,
  Zap, Banknote, PackageX, Activity, RefreshCw, Layers, Truck, Megaphone, Shield, Users,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_SECTIONS = [
  {
    label: 'Operações',
    items: [
      { href: '/dashboard',              label: 'Dashboard',     icon: LayoutDashboard },
      { href: '/dashboard/orders',       label: 'Pedidos',       icon: ShoppingCart },
      { href: '/dashboard/inventory',    label: 'Estoque',       icon: Warehouse },
      { href: '/dashboard/products',     label: 'Produtos',      icon: Package },
      { href: '/dashboard/catalog',      label: 'Catálogo',      icon: Layers },
      { href: '/dashboard/listings',     label: 'Anúncios',      icon: Megaphone },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/dashboard/integrations', label: 'Integrações',   icon: Plug },
      { href: '/dashboard/pricing',      label: 'Precificação',  icon: DollarSign },
      { href: '/dashboard/repricing',    label: 'Reprecificação', icon: RefreshCw },
      { href: '/dashboard/suppliers',    label: 'Fornecedores',  icon: Truck },
      { href: '/dashboard/customers',    label: 'Clientes',      icon: Users },
    ],
  },
  {
    label: 'Análise',
    items: [
      { href: '/dashboard/financial',    label: 'Financeiro',    icon: Banknote },
      { href: '/dashboard/returns',      label: 'Devoluções',    icon: PackageX },
      { href: '/dashboard/performance',  label: 'Performance',   icon: Activity },
      { href: '/dashboard/reports',      label: 'Relatórios',    icon: BarChart3 },
      { href: '/dashboard/audit',        label: 'Auditoria',     icon: Shield },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/dashboard/settings',     label: 'Configurações', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="flex w-58 flex-shrink-0 flex-col overflow-hidden"
      style={{ background: 'hsl(var(--sidebar))', borderRight: '1px solid hsl(var(--sidebar-border))' }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center gap-3 px-4"
        style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}
      >
        <div className="relative flex h-8 w-8 items-center justify-center rounded-xl gradient-primary shadow-lg">
          <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          <div className="absolute inset-0 rounded-xl glow-primary opacity-50" />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-foreground">SellSync</p>
          <p className="text-[10px] leading-none" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Hub Multichannel
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p
              className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}
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
                      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      active
                        ? 'text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    style={active ? {
                      background: 'linear-gradient(135deg, hsl(var(--gradient-start) / 0.25), hsl(var(--gradient-end) / 0.15))',
                      border: '1px solid hsl(var(--primary) / 0.3)',
                    } : undefined}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                        style={{ background: 'hsl(var(--primary))' }}
                      />
                    )}
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-all duration-150',
                        active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground group-hover:scale-110'
                      )}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    <span className="flex-1 truncate">{itemLabel}</span>
                    {active && (
                      <ChevronRight className="h-3 w-3 opacity-50 text-white shrink-0" />
                    )}
                    {!active && (
                      <div
                        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ background: 'hsl(var(--accent))' }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Upgrade card */}
      <div className="p-3" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        <div
          className="rounded-xl p-3 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--gradient-start) / 0.12), hsl(var(--gradient-end) / 0.08))',
            border: '1px solid hsl(var(--primary) / 0.2)',
          }}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-xs font-semibold"
                style={{ color: 'hsl(var(--primary))' }}
              >
                Plano FREE
              </span>
              <span className="text-[10px] text-muted-foreground">0/5 canais</span>
            </div>
            <div className="w-full rounded-full h-1 bg-muted mb-2">
              <div className="gradient-primary h-1 rounded-full" style={{ width: '0%' }} />
            </div>
            <Link
              href="/dashboard/settings"
              className="group flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: 'hsl(var(--primary))' }}
            >
              Fazer upgrade
              <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full blur-2xl opacity-20"
            style={{ background: 'hsl(var(--primary))' }}
          />
        </div>
      </div>
    </aside>
  )
}
