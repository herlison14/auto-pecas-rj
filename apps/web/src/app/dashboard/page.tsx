'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, ShoppingCart, AlertTriangle,
  Plug, DollarSign, ArrowRight, Package, BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell, CartesianGrid,
} from 'recharts'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, trend, colorClass, loading }: {
  title: string; value: string; sub: string; icon: React.ElementType
  trend?: number; colorClass: string; loading?: boolean
}) {
  if (loading) return <Skeleton className="h-32 rounded-xl" />
  return (
    <Card className="animate-fade-in hover:shadow-card-hover transition-shadow duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colorClass)}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3">
            {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            <span className={cn('text-xs font-bold', trend >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-xs text-muted-foreground">vs. mês anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

// ── Channel colors ────────────────────────────────────────────────────────────

const CHANNEL_COLOR: Record<string, string> = {
  MERCADO_LIVRE: '#FFE600',
  SHOPEE: '#FF5722',
  AMAZON: '#FF9900',
  MAGALU: '#0066CC',
  AMERICANAS: '#CC0000',
  SHEIN: '#111111',
  TIKTOK_SHOP: '#010101',
}

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(1)}k`
  return fmtCurrency(v)
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-muted-foreground mb-1">{label}</p>
      <p className="font-bold text-base">{fmtCurrency(payload[0]?.value ?? 0)}</p>
      <p className="text-muted-foreground">{payload[0]?.payload?.orders ?? 0} pedidos</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [days, setDays] = useState(30)

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['dashboard-overview', days],
    queryFn: async () => (await api.get('/reports/overview', { params: { days } })).data,
  })

  const { data: dailySales, isLoading: loadingChart } = useQuery({
    queryKey: ['dashboard-daily', days],
    queryFn: async () => (await api.get('/reports/daily-sales', { params: { days } })).data,
  })

  const { data: topProducts, isLoading: loadingTop } = useQuery({
    queryKey: ['dashboard-top', days],
    queryFn: async () => (await api.get('/reports/top-products', { params: { days, limit: 5 } })).data,
  })

  const { data: extras } = useQuery({
    queryKey: ['dashboard-extras'],
    queryFn: async () => {
      const [lowStock, stores, pendingOrders] = await Promise.all([
        api.get('/inventory/alerts/low-stock'),
        api.get('/integrations/stores'),
        api.get('/orders', { params: { limit: 1, status: 'PENDING' } }),
      ])
      return {
        lowStockCount: lowStock.data.length,
        connectedStores: stores.data.filter((s: any) => s.isActive).length,
        pendingOrders: pendingOrders.data.meta?.total ?? 0,
      }
    },
  })

  // Build channel chart data
  const channelData = overview?.byMarketplace
    ? Object.entries(overview.byMarketplace as Record<string, { orders: number; revenue: number }>)
        .map(([mp, v]) => ({ name: mp.replace('_', ' '), revenue: v.revenue, orders: v.orders, mp }))
        .sort((a, b) => b.revenue - a.revenue)
    : []

  const chartData = (dailySales as any[] ?? []).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    revenue: d.revenue,
    orders: d.orders,
  }))

  const maxRevenue = Math.max(...channelData.map((c) => c.revenue), 1)

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do seu negócio</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border bg-muted/60 p-1">
            {PERIODS.map((p) => (
              <button key={p.days} onClick={() => setDays(p.days)}
                className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-all',
                  days === p.days ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {p.label}
              </button>
            ))}
          </div>
          <Badge variant="secondary" className="text-xs font-medium hidden sm:flex">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
          </Badge>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Receita do período" loading={loadingOverview}
          value={fmtCurrency(overview?.totalRevenue ?? 0)}
          sub={`${overview?.totalOrders ?? 0} pedidos confirmados`}
          icon={DollarSign} trend={0} colorClass="bg-blue-500/15 text-blue-400"
        />
        <StatCard
          title="Ticket médio" loading={loadingOverview}
          value={fmtCurrency(overview?.averageTicket ?? 0)}
          sub="Por pedido no período"
          icon={BarChart3} colorClass="bg-violet-500/15 text-violet-400"
        />
        <StatCard
          title="Pedidos pendentes"
          value={String(extras?.pendingOrders ?? 0)}
          sub="Aguardando processamento"
          icon={ShoppingCart} colorClass="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          title="Estoque crítico"
          value={String(extras?.lowStockCount ?? 0)}
          sub="Produtos abaixo do mínimo"
          icon={AlertTriangle}
          colorClass={extras?.lowStockCount ? 'bg-red-500/15 text-red-400' : 'bg-muted text-muted-foreground'}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Revenue area chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Receita diária</CardTitle>
              <span className="text-xs text-muted-foreground">Últimos {days} dias</span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingChart ? (
              <Skeleton className="h-52 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                Sem dados para o período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={208}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false}
                    interval={Math.floor(chartData.length / 6)}
                  />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false} width={56}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone" dataKey="revenue" stroke="hsl(var(--primary))"
                    strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Channel breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Receita por canal</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : channelData.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
                <Plug className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nenhum canal com vendas</p>
                <Link href="/dashboard/integrations" className="text-xs text-primary hover:underline">
                  Conectar marketplace
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {channelData.map((c) => (
                  <div key={c.mp} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtCurrency(c.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(c.revenue / maxRevenue) * 100}%`,
                          backgroundColor: CHANNEL_COLOR[c.mp] ?? 'hsl(var(--primary))',
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">{c.orders} pedidos</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Top products */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Top 5 produtos</CardTitle>
              <Link href="/dashboard/products" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingTop ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !topProducts?.length ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                Sem vendas no período
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    {['#', 'Produto', 'Qtd', 'Receita'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(topProducts as any[]).map((p: any, i: number) => (
                    <tr key={p.productId || p.sku} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-bold text-muted-foreground w-8">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-sm truncate max-w-[200px]">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm tabular-nums">{p.totalQty}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold tabular-nums">
                        {fmtCurrency(p.totalRevenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Quick actions + alerts */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {[
                { href: '/dashboard/orders',       label: 'Pedidos pendentes',  desc: `${extras?.pendingOrders ?? 0} aguardando`, color: 'hover:bg-amber-500/10' },
                { href: '/dashboard/inventory',    label: 'Estoque baixo',      desc: `${extras?.lowStockCount ?? 0} produtos`, color: 'hover:bg-red-500/10' },
                { href: '/dashboard/integrations', label: 'Canais ativos',      desc: `${extras?.connectedStores ?? 0} conectados`, color: 'hover:bg-blue-500/10' },
                { href: '/dashboard/catalog',      label: 'Sync catálogo',      desc: 'Verificar divergências', color: 'hover:bg-violet-500/10' },
              ].map(({ href, label, desc, color }) => (
                <Link key={href} href={href}
                  className={cn('flex items-center justify-between px-4 py-3 border-b last:border-0 transition-colors', color)}>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
