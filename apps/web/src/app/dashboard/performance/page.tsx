'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Clock, Truck, CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'


const PERIODS = [{ label: '7d', value: 7 }, { label: '30d', value: 30 }, { label: '90d', value: 90 }]
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })


function ScorePill({ value, good, warn }: { value: number | null; good: number; warn: number }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>
  const cls = value >= good ? 'text-emerald-600' : value >= warn ? 'text-amber-600' : 'text-red-600'
  return <span className={cn('font-semibold tabular-nums', cls)}>{value}%</span>
}

function TimePill({ hours }: { hours: number | null }) {
  if (hours == null) return <span className="text-muted-foreground text-xs">—</span>
  const cls = hours <= 24 ? 'text-emerald-600' : hours <= 48 ? 'text-amber-600' : 'text-red-600'
  return (
    <span className={cn('font-semibold tabular-nums', cls)}>
      {hours < 48 ? `${hours}h` : `${(hours / 24).toFixed(1)}d`}
    </span>
  )
}

export default function PerformancePage() {
  const [days, setDays] = useState(30)

  const { data: summary, isLoading } = useQuery({
    queryKey: ['performance-summary', days],
    queryFn: async () => (await api.get('/performance/summary', { params: { days } })).data,
  })

  const { data: daily } = useQuery({
    queryKey: ['performance-daily', days],
    queryFn: async () => (await api.get('/performance/daily', { params: { days } })).data,
  })

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">SLA de envio, taxa de entrega e cancelamento por canal</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setDays(p.value)}
              className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-all',
                days === p.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : [
          {
            label: 'Taxa de Entrega',
            value: summary?.deliveryRate != null ? `${summary.deliveryRate}%` : '—',
            icon: CheckCircle,
            color: 'bg-emerald-500/15 text-emerald-400',
            good: summary?.deliveryRate >= 85,
          },
          {
            label: 'Taxa de Cancelamento',
            value: summary?.cancellationRate != null ? `${summary.cancellationRate}%` : '—',
            icon: XCircle,
            color: summary?.cancellationRate <= 5 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400',
            good: true,
          },
          {
            label: 'Tempo médio de Envio',
            value: summary?.avgShippingHours != null
              ? (summary.avgShippingHours < 48 ? `${summary.avgShippingHours}h` : `${(summary.avgShippingHours / 24).toFixed(1)}d`)
              : '—',
            icon: Truck,
            color: summary?.avgShippingHours <= 24 ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400',
            good: true,
          },
          {
            label: 'Tempo médio de Entrega',
            value: summary?.avgDeliveryDays != null ? `${summary.avgDeliveryDays}d` : '—',
            icon: Clock,
            color: 'bg-purple-50 text-purple-600',
            good: true,
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

      {/* Daily trend */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Pedidos diários — Entregues vs Cancelados</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM', { locale: ptBR })}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(v) => format(new Date(v), 'dd/MM/yyyy', { locale: ptBR })}
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Pedidos" />
              <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} name="Entregues" />
              <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Cancelados" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per-marketplace table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Performance por Canal</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
<table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {['Canal', 'Pedidos', 'Entregues', 'Cancelados', 'Tx. Cancel.', 'SLA Envio', 'Prazo Entrega', 'Receita'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="border-b"><td colSpan={8} className="px-4 py-3"><Skeleton className="h-4" /></td></tr>
            ))}
            {!isLoading && (summary?.byMarketplace ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">Sem dados no período</td></tr>
            )}
            {(summary?.byMarketplace ?? []).map((mp: any) => (
              <tr key={mp.marketplace} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {MP_EMOJI[mp.marketplace] ?? '🏪'}
                    <span className="font-medium text-sm">{mp.marketplace.replace('_', ' ')}</span>
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold tabular-nums">{mp.total}</td>
                <td className="px-4 py-3 text-emerald-600 font-semibold tabular-nums">{mp.delivered}</td>
                <td className="px-4 py-3 text-red-500 tabular-nums">{mp.cancelled}</td>
                <td className="px-4 py-3">
                  <ScorePill value={mp.cancellationRate != null ? (100 - mp.cancellationRate) : null} good={95} warn={90} />
                </td>
                <td className="px-4 py-3"><TimePill hours={mp.avgShippingHours} /></td>
                <td className="px-4 py-3">
                  {mp.avgDeliveryDays != null
                    ? <span className={cn('font-semibold tabular-nums', mp.avgDeliveryDays <= 7 ? 'text-emerald-600' : mp.avgDeliveryDays <= 14 ? 'text-amber-600' : 'text-red-600')}>{mp.avgDeliveryDays}d</span>
                    : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-4 py-3 font-semibold text-primary">{fmt(mp.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </Card>

      {/* Cancellation breakdown bar */}
      {(summary?.byMarketplace ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Taxa de Cancelamento por Canal</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(summary?.byMarketplace ?? []).map((mp: any) => (
                <div key={mp.marketplace}>
                  <div className="flex items-center justify-between mb-1 text-sm">
                    <span className="flex items-center gap-1.5">
                      {MP_EMOJI[mp.marketplace] ?? '🏪'} {mp.marketplace.replace('_', ' ')}
                    </span>
                    <span className={cn('text-xs font-semibold',
                      mp.cancellationRate <= 5 ? 'text-emerald-600' : mp.cancellationRate <= 10 ? 'text-amber-600' : 'text-red-600')}>
                      {mp.cancellationRate}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full',
                        mp.cancellationRate <= 5 ? 'bg-emerald-400' : mp.cancellationRate <= 10 ? 'bg-amber-400' : 'bg-red-400')}
                      style={{ width: `${Math.min(mp.cancellationRate * 3, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
