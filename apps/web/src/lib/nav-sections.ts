import {
  LayoutDashboard, ShoppingCart, Warehouse, Package,
  Plug, DollarSign, BarChart3, Settings,
  Banknote, PackageX, Activity, RefreshCw, Layers, Truck, Megaphone, Shield, Users, Stethoscope,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Operações',
    items: [
      { href: '/dashboard',              label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/dashboard/orders',       label: 'Pedidos',        icon: ShoppingCart },
      { href: '/dashboard/inventory',    label: 'Estoque',        icon: Warehouse },
      { href: '/dashboard/products',     label: 'Produtos',       icon: Package },
      { href: '/dashboard/catalog',      label: 'Catálogo',       icon: Layers },
      { href: '/dashboard/listings',     label: 'Anúncios',       icon: Megaphone },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/dashboard/integrations', label: 'Integrações',    icon: Plug },
      { href: '/dashboard/pricing',      label: 'Precificação',   icon: DollarSign },
      { href: '/dashboard/repricing',    label: 'Reprecificação', icon: RefreshCw },
      { href: '/dashboard/suppliers',    label: 'Fornecedores',   icon: Truck },
      { href: '/dashboard/customers',    label: 'Clientes',       icon: Users },
    ],
  },
  {
    label: 'Análise',
    items: [
      { href: '/dashboard/financial',    label: 'Financeiro',     icon: Banknote },
      { href: '/dashboard/returns',      label: 'Devoluções',     icon: PackageX },
      { href: '/dashboard/performance',  label: 'Performance',    icon: Activity },
      { href: '/dashboard/funnel-diagnostics', label: 'Diagnóstico de Funil', icon: Stethoscope },
      { href: '/dashboard/reports',      label: 'Relatórios',     icon: BarChart3 },
      { href: '/dashboard/audit',        label: 'Auditoria',      icon: Shield },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/dashboard/settings',     label: 'Configurações',  icon: Settings },
    ],
  },
]

export function findNavLabel(pathname: string): string {
  const exact = NAV_SECTIONS.flatMap((s) => s.items).find((item) => item.href === pathname)
  if (exact) return exact.label

  const prefixMatches = NAV_SECTIONS.flatMap((s) => s.items)
    .filter((item) => item.href !== '/dashboard' && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)

  return prefixMatches[0]?.label ?? 'Dashboard'
}
