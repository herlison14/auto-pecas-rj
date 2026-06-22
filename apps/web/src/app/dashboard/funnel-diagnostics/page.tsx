'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Stethoscope, Upload, AlertTriangle, Target, TrendingUp } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI, MP_LABEL } from '@/lib/marketplace'

interface FunnelDiagnostic {
  id: string
  gargalo: string
  causaProvavel: string
  alertaEconomico: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'
  createdAt: string
  acoes: Array<{ ordem: number; acao: string; metrica_alvo: string; ganho_estimado_rs: number }>
  snapshot: {
    marketplace: string
    periodStart: string
    periodEnd: string
    product: { id: string; name: string; sku: string }
  }
}

const GARGALO_LABEL: Record<string, string> = {
  ALCANCE: 'Alcance',
  ATRACAO: 'Atração',
  CONVERSAO: 'Conversão',
  ABANDONO_CHECKOUT: 'Abandono de Checkout',
  RENTABILIDADE: 'Rentabilidade',
  SAUDAVEL: 'Saudável',
}

const STATUS_CFG: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'secondary' }> = {
  PENDING: { label: 'Pendente', variant: 'warning' },
  IN_PROGRESS: { label: 'Em andamento', variant: 'info' },
  RESOLVED: { label: 'Resolvido', variant: 'success' },
  DISMISSED: { label: 'Descartado', variant: 'secondary' },
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function FunnelDiagnosticsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'snapshots' | 'diagnostics'>('snapshots')
  const [selected, setSelected] = useState<string | null>(null)
  const [planError, setPlanError] = useState('')

  const { data: snapshotsData, isLoading: loadingSnapshots } = useQuery({
    queryKey: ['funnel-snapshots'],
    queryFn: async () => (await api.get('/funnel-diagnostics/snapshots')).data,
    enabled: tab === 'snapshots',
  })

  const { data: diagnosticsData, isLoading: loadingDiagnostics } = useQuery({
    queryKey: ['funnel-diagnostics'],
    queryFn: async () => (await api.get('/funnel-diagnostics/diagnostics')).data,
    enabled: tab === 'diagnostics',
  })

  const { data: detail } = useQuery<FunnelDiagnostic | undefined>({
    queryKey: ['funnel-diagnostic', selected],
    queryFn: async () => {
      const diagnostics: FunnelDiagnostic[] = (await api.get('/funnel-diagnostics/diagnostics')).data.diagnostics
      return diagnostics.find((d) => d.id === selected)
    },
    enabled: !!selected && tab === 'diagnostics',
  })

  const diagnose = useMutation({
    mutationFn: async (snapshotId: string) =>
      api.post(`/funnel-diagnostics/snapshots/${snapshotId}/diagnose`),
    onSuccess: (res) => {
      setPlanError('')
      qc.invalidateQueries({ queryKey: ['funnel-diagnostics'] })
      setTab('diagnostics')
      setSelected(res.data.id)
    },
    onError: (err: any) => {
      setPlanError(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao gerar diagnóstico')
    },
  })

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" /> Diagnóstico de Funil
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Identifique o gargalo de vendas de cada produto e priorize ações em R$
          </p>
        </div>
        <Link href="/dashboard/funnel-diagnostics/import">
          <Button>
            <Upload className="h-4 w-4" /> Importar dados
          </Button>
        </Link>
      </div>

      {planError && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          {planError}
        </div>
      )}

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {([['snapshots', 'Snapshots de Funil'], ['diagnostics', 'Diagnósticos']] as const).map(([value, label]) => (
          <button key={value} onClick={() => { setTab(value); setSelected(null) }}
            className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-all',
              tab === value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'snapshots' && (
        <Card className="overflow-hidden">
          {loadingSnapshots ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {['Produto', 'Canal', 'Período', 'CTR', 'Conversão', 'Receita', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(snapshotsData?.snapshots ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-16 text-center">
                      <Stethoscope className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum snapshot de funil importado ainda</p>
                    </td></tr>
                  )}
                  {(snapshotsData?.snapshots ?? []).map((s: any) => {
                    const ctr = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : null
                    const conv = s.visits > 0 ? (s.orders / s.visits) * 100 : null
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{s.product?.name}</p>
                          <p className="text-xs font-mono text-muted-foreground">{s.product?.sku}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            {MP_EMOJI[s.marketplace] ?? '🏪'} <span className="text-xs">{MP_LABEL[s.marketplace] ?? s.marketplace}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(s.periodStart), 'dd/MM/yy', { locale: ptBR })} – {format(new Date(s.periodEnd), 'dd/MM/yy', { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{ctr != null ? `${ctr.toFixed(2)}%` : '—'}</td>
                        <td className="px-4 py-3 tabular-nums">{conv != null ? `${conv.toFixed(2)}%` : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-primary">{fmt(Number(s.revenue))}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            disabled={diagnose.isPending}
                            onClick={() => diagnose.mutate(s.id)}>
                            {diagnose.isPending && diagnose.variables === s.id ? 'Diagnosticando…' : 'Diagnosticar'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'diagnostics' && (
        <div className={cn('grid gap-5', selected ? 'lg:grid-cols-5' : 'grid-cols-1')}>
          <div className={cn('space-y-3', selected ? 'lg:col-span-2' : '')}>
            <Card className="overflow-hidden">
              {loadingDiagnostics ? (
                <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
              ) : (
                <div className="divide-y">
                  {(diagnosticsData?.diagnostics ?? []).length === 0 && (
                    <div className="px-4 py-16 text-center">
                      <Target className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum diagnóstico gerado ainda</p>
                    </div>
                  )}
                  {(diagnosticsData?.diagnostics ?? []).map((d: FunnelDiagnostic) => (
                    <button key={d.id} onClick={() => setSelected(selected === d.id ? null : d.id)}
                      className={cn('w-full text-left px-4 py-3 hover:bg-muted/20 transition-colors',
                        selected === d.id && 'bg-primary/5')}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{d.snapshot?.product?.name}</p>
                        <Badge variant={STATUS_CFG[d.status]?.variant ?? 'secondary'} className="text-xs">
                          {STATUS_CFG[d.status]?.label ?? d.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {MP_EMOJI[d.snapshot?.marketplace] ?? '🏪'} {GARGALO_LABEL[d.gargalo] ?? d.gargalo} · {format(new Date(d.createdAt), 'dd/MM/yy', { locale: ptBR })}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {selected && detail && (
            <div className="lg:col-span-3 space-y-3 animate-fade-in">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Produto</p>
                      <p className="font-bold">{detail.snapshot?.product?.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{detail.snapshot?.product?.sku}</p>
                    </div>
                    <Badge variant="destructive">{GARGALO_LABEL[detail.gargalo] ?? detail.gargalo}</Badge>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Causa provável</p>
                    <p className="text-sm">{detail.causaProvavel}</p>
                  </div>

                  {detail.alertaEconomico && (
                    <div className="flex gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-sm text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      {detail.alertaEconomico}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" /> Ações priorizadas
                    </p>
                    <div className="space-y-2">
                      {(detail.acoes ?? []).sort((a, b) => a.ordem - b.ordem).map((acao) => (
                        <div key={acao.ordem} className="rounded-lg border bg-muted/20 px-3.5 py-2.5">
                          <div className="flex items-start gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-bold mt-0.5">
                              {acao.ordem}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm">{acao.acao}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-muted-foreground">Métrica: {acao.metrica_alvo}</span>
                                <span className="text-xs font-semibold text-emerald-500">+{fmt(acao.ganho_estimado_rs)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
