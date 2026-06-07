'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, ShoppingCart, Receipt, XCircle, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const PERIODS = [{ label: '7d', value: 7 }, { label: '30d', value: 30 }, { label: '90d', value: 90 }]
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ReportsPage() {
  const [days, setDays] = useState(30)

  const { data: overview, isLoading } = useQuery({
    queryKey: ['reports-overview', days],
    queryFn: async () => (await api.get('/reports/overview', { params: { days } })).data,
  })
  const { data: dailySales } = useQuery({
    queryKey: ['reports-daily', days],
    queryFn: async () => (await api.get('/reports/daily-sales', { params: { days } })).data,
  })
  const { data: topProducts } = useQuery({
    queryKey: ['reports-top', days],
    queryFn: async () => (await api.get('/reports/top-products', { params: { days } })).data,
  })
  const { data: nfe } = useQuery({
    queryKey: ['reports-nfe', days],
    queryFn: async () => (await api.get('/reports/nfe-summary', { params: { days } })).data,
  })

  const byMarketplace = overview?.byMarketplace
    ? Object.entries(overview.byMarketplace).map(([mp, d]: [string, any]) => ({ name: mp.replace('_', ' '), ...d }))
    : []

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise de performance do período</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => setDays(p.value)}
                className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-all', days === p.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="relative group">
            <button className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block w-52 rounded-xl border bg-card shadow-lg p-1.5">
              {[
                { label: 'Pedidos (CSV)', href: `/export/orders?days=${days}&format=csv` },
                { label: 'Pedidos (XLSX)', href: `/export/orders?days=${days}&format=xlsx` },
                { label: 'Estoque (CSV)', href: '/export/inventory?format=csv' },
                { label: 'Produtos (XLSX)', href: '/export/products?format=xlsx' },
                { label: 'Financeiro (CSV)', href: `/export/financial?days=${days}&format=csv` },
              ].map((item) => (
                <a key={item.href}
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${item.href}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-muted/50 transition-colors">
                  <Download className="h-3 w-3 text-muted-foreground" /> {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : [
          { label: 'Receita Total', value: fmt(overview?.totalRevenue ?? 0), icon: TrendingUp, color: 'bg-blue-500/15 text-blue-400' },
          { label: 'Pedidos', value: String(overview?.totalOrders ?? 0), icon: ShoppingCart, color: 'bg-amber-500/15 text-amber-400' },
          { label: 'Ticket Médio', value: fmt(overview?.averageTicket ?? 0), icon: Receipt, color: 'bg-emerald-500/15 text-emerald-400' },
          { label: 'Cancelamentos', value: String(overview?.totalCancelled ?? 0), icon: XCircle, color: 'bg-red-500/15 text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight">{value}</p>
                </div>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico de vendas diárias */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Vendas Diárias</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailySales ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM', { locale: ptBR })} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(v) => format(new Date(v), 'dd/MM/yyyy', { locale: ptBR })} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} name="Receita" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Receita por canal */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Receita por Canal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byMarketplace} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={90} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top produtos */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Produtos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(topProducts ?? []).map((p: any, i: number) => (
                <div key={p.sku} className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.totalQty} un. vendidas</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{fmt(p.totalRevenue)}</span>
                </div>
              ))}
              {(!topProducts || topProducts.length === 0) && (
                <p className="text-center text-sm text-muted-foreground py-4">Sem dados no período</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NF-e */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Status NF-e no Período</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Autorizadas', value: nfe?.authorized ?? 0, cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
              { label: 'Pendentes',   value: nfe?.pending ?? 0,    cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
              { label: 'Rejeitadas',  value: nfe?.rejected ?? 0,   cls: 'bg-red-500/10 border-red-500/20 text-red-400' },
              { label: 'Canceladas',  value: nfe?.cancelled ?? 0,  cls: 'bg-muted border-border text-muted-foreground' },
            ].map((s) => (
              <div key={s.label} className={cn('rounded-xl border p-4 text-center', s.cls)}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs mt-0.5 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
