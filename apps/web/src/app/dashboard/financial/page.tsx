'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Receipt, Percent, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'


const PERIODS = [{ label: '7d', value: 7 }, { label: '30d', value: 30 }, { label: '90d', value: 90 }]
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const TX_TYPE_LABEL: Record<string, string> = {
  SALE: 'Venda', COMMISSION: 'Comissão', MARKETPLACE_FEE: 'Taxa plataforma',
  SHIPPING_COST: 'Custo frete', SHIPPING_CREDIT: 'Crédito frete',
  REFUND: 'Estorno', CHARGEBACK: 'Chargeback', ADVERTISEMENT: 'Publicidade', OTHER: 'Outro',
}

const TX_TYPE_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'secondary' | 'info'> = {
  SALE: 'success', SHIPPING_CREDIT: 'success',
  COMMISSION: 'warning', MARKETPLACE_FEE: 'warning', ADVERTISEMENT: 'warning',
  SHIPPING_COST: 'secondary',
  REFUND: 'destructive', CHARGEBACK: 'destructive',
  OTHER: 'secondary',
}


export default function FinancialPage() {
  const [days, setDays] = useState(30)
  const [page, setPage] = useState(1)

  const { data: summary, isLoading, refetch } = useQuery({
    queryKey: ['financial-summary', days],
    queryFn: async () => (await api.get('/financial/summary', { params: { days } })).data,
  })

  const { data: cashflow } = useQuery({
    queryKey: ['financial-cashflow', days],
    queryFn: async () => (await api.get('/financial/cashflow', { params: { days } })).data,
  })

  const { data: txData } = useQuery({
    queryKey: ['financial-transactions', days, page],
    queryFn: async () => (await api.get('/financial/transactions', { params: { days, page, limit: 25 } })).data,
  })

  const sync = useMutation({
    mutationFn: async () => (await api.post('/financial/sync', { days })).data,
    onSuccess: () => refetch(),
  })

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Receita líquida após taxas e comissões dos marketplaces</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => { setDays(p.value); setPage(1) }}
                className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-all',
                  days === p.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw className={cn('h-3.5 w-3.5', sync.isPending && 'animate-spin')} />
            {sync.isPending ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : [
          {
            label: 'Receita Bruta',
            value: fmt(summary?.grossRevenue ?? 0),
            icon: DollarSign,
            color: 'bg-blue-500/15 text-blue-400',
            sub: null,
          },
          {
            label: 'Receita Líquida',
            value: fmt(summary?.netRevenue ?? 0),
            icon: TrendingUp,
            color: 'bg-emerald-500/15 text-emerald-400',
            sub: null,
          },
          {
            label: 'Total de Taxas',
            value: fmt(summary?.totalDeductions ?? 0),
            icon: TrendingDown,
            color: 'bg-red-500/15 text-red-400',
            sub: null,
          },
          {
            label: 'Margem Líquida',
            value: `${summary?.margin ?? '0.0'}%`,
            icon: Percent,
            color: 'bg-amber-500/15 text-amber-400',
            sub: null,
          },
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

      {/* Fee breakdown */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Comissões', value: summary.totalCommissions, cls: 'text-orange-600' },
            { label: 'Taxas plataforma', value: summary.totalFees, cls: 'text-amber-600' },
            { label: 'Frete líquido', value: summary.totalShippingCost - summary.totalShippingCredit, cls: 'text-blue-600' },
            { label: 'Estornos', value: summary.totalRefunds, cls: 'text-red-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={cn('text-lg font-bold mt-0.5', s.cls)}>{fmt(s.value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cashflow chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Fluxo de Caixa Diário</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={cashflow ?? []}>
              <defs>
                <linearGradient id="gross-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="net-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM', { locale: ptBR })}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt(v)}
                labelFormatter={(v) => format(new Date(v), 'dd/MM/yyyy', { locale: ptBR })}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Area type="monotone" dataKey="gross" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gross-grad)" name="Bruto" />
              <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} fill="url(#net-grad)" name="Líquido" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* By marketplace */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Por Marketplace</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(summary?.byMarketplace ?? []).sort((a: any, b: any) => b.gross - a.gross).map((mp: any) => {
                const pct = mp.gross > 0 ? (mp.fees / mp.gross) * 100 : 0
                return (
                  <div key={mp.marketplace}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{MP_EMOJI[mp.marketplace] ?? '🏪'}</span>
                        <span className="text-sm font-medium">{mp.marketplace.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">{fmt(mp.gross)}</span>
                        <span className="font-semibold text-emerald-600">{fmt(mp.net)} líq.</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Taxa efetiva: {pct.toFixed(1)}%</p>
                  </div>
                )
              })}
              {(summary?.byMarketplace ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma transação. Clique em <strong>Sincronizar</strong>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fee composition bar chart */}
        {summary && summary.grossRevenue > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Composição das Deduções</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[
                  { name: 'Comissões',      value: summary.totalCommissions },
                  { name: 'Taxas',           value: summary.totalFees },
                  { name: 'Frete s/ créd.', value: Math.max(0, summary.totalShippingCost - summary.totalShippingCredit) },
                  { name: 'Estornos',        value: summary.totalRefunds },
                ]} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => fmt(v)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Valor" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transactions table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Transações
            {txData?.total != null && (
              <Badge variant="secondary" className="text-xs">{txData.total}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
<table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {['Data', 'Tipo', 'Canal', 'Descrição', 'Valor'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(txData?.transactions ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                Nenhuma transação. Clique em Sincronizar para importar dados dos pedidos.
              </td></tr>
            )}
            {(txData?.transactions ?? []).map((tx: any) => {
              const isPositive = ['SALE', 'SHIPPING_CREDIT'].includes(tx.type)
              return (
                <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(tx.referenceDate), 'dd/MM/yy', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={TX_TYPE_VARIANT[tx.type] ?? 'secondary'} className="text-xs">
                      {TX_TYPE_LABEL[tx.type] ?? tx.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {tx.marketplace ? (
                      <span className="flex items-center gap-1">
                        {MP_EMOJI[tx.marketplace] ?? '🏪'}
                        <span className="text-xs text-muted-foreground">{tx.marketplace.replace('_', ' ')}</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{tx.description ?? '—'}</td>
                  <td className={cn('px-4 py-3 font-semibold tabular-nums', isPositive ? 'text-emerald-600' : 'text-red-500')}>
                    {isPositive ? '+' : ''}{Number(tx.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
</div>
        {txData && txData.pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">Página {page} de {txData.pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= txData.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
