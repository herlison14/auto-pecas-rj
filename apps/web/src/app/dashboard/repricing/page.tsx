'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Play, Trash2, RefreshCw, TrendingUp, Zap, ToggleLeft, ToggleRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI, MARKETPLACES } from '@/lib/marketplace'


const STRATEGY_LABEL: Record<string, string> = {
  MAINTAIN_MARGIN: 'Manter margem',
  MATCH_LOWEST:    'Igualar menor preço',
  BEAT_BY_PCT:     'Bater por %',
  FIXED_MARKUP:    'Markup fixo',
}

const STRATEGY_DESCRIPTION: Record<string, string> = {
  MAINTAIN_MARGIN: 'Ajusta o preço para atingir a margem alvo considerando o custo do produto.',
  MATCH_LOWEST:    'Iguala o menor preço encontrado para o produto no canal.',
  BEAT_BY_PCT:     'Reduz o preço em X% para ficar abaixo da concorrência.',
  FIXED_MARKUP:    'Aplica um markup fixo sobre o custo do produto.',
}


const selectCls = 'flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const emptyForm = {
  name: '', strategy: 'MAINTAIN_MARGIN', marketplace: '',
  targetMargin: '', minPrice: '', maxPrice: '', adjustmentPct: '5',
}

export default function RepricingPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [runResults, setRunResults] = useState<any[]>([])

  const { data: stats } = useQuery({
    queryKey: ['repricing-stats'],
    queryFn: async () => (await api.get('/repricing/stats')).data,
  })

  const { data: rules, isLoading } = useQuery({
    queryKey: ['repricing-rules'],
    queryFn: async () => (await api.get('/repricing/rules')).data,
  })

  const createRule = useMutation({
    mutationFn: async (data: typeof form) => api.post('/repricing/rules', {
      name: data.name,
      strategy: data.strategy,
      marketplace: data.marketplace || undefined,
      targetMargin: data.targetMargin ? Number(data.targetMargin) : undefined,
      minPrice: data.minPrice ? Number(data.minPrice) : undefined,
      maxPrice: data.maxPrice ? Number(data.maxPrice) : undefined,
      adjustmentPct: data.adjustmentPct ? Number(data.adjustmentPct) : 5,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repricing-rules'] })
      qc.invalidateQueries({ queryKey: ['repricing-stats'] })
      setShowForm(false)
      setForm({ ...emptyForm })
    },
  })

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/repricing/rules/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repricing-rules'] }),
  })

  const deleteRule = useMutation({
    mutationFn: async (id: string) => api.delete(`/repricing/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repricing-rules'] })
      qc.invalidateQueries({ queryKey: ['repricing-stats'] })
    },
  })

  const runAll = useMutation({
    mutationFn: async () => (await api.post('/repricing/run')).data,
    onSuccess: (data) => {
      setRunResults(data)
      qc.invalidateQueries({ queryKey: ['repricing-rules'] })
    },
  })

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const needsPct = ['BEAT_BY_PCT', 'FIXED_MARKUP'].includes(form.strategy)
  const needsMargin = form.strategy === 'MAINTAIN_MARGIN'

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reprecificação Automática</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Regras de ajuste de preço com guardrails de margem mínima</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runAll.mutate()} disabled={runAll.isPending}>
            <Play className={cn('h-3.5 w-3.5', runAll.isPending && 'animate-spin')} />
            {runAll.isPending ? 'Executando...' : 'Executar agora'}
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova Regra
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Regras ativas', value: stats.active, icon: Zap, color: 'bg-primary/10 text-primary' },
            { label: 'Total de regras', value: stats.total, icon: TrendingUp, color: 'bg-blue-500/15 text-blue-400' },
            { label: 'Ajustes (24h)', value: stats.changes24h, icon: RefreshCw, color: 'bg-emerald-500/15 text-emerald-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Run results */}
      {runResults.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/10 animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-400">{runResults.length} preço(s) ajustado(s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {runResults.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-emerald-400">
                  <span className="font-mono">{fmt(r.oldPrice)} → {fmt(r.newPrice)}</span>
                  <span className="text-emerald-600/70">{r.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card className="border-primary/30 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nova Regra de Reprecificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium">Nome</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Manter margem 30% no Shopee" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Estratégia</label>
                <select value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} className={selectCls}>
                  {Object.entries(STRATEGY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">{STRATEGY_DESCRIPTION[form.strategy]}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Marketplace <span className="text-muted-foreground font-normal">(opcional)</span></label>
                <select value={form.marketplace} onChange={(e) => setForm({ ...form, marketplace: e.target.value })} className={selectCls}>
                  <option value="">Todos os canais</option>
                  {MARKETPLACES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>

              {needsMargin && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Margem alvo (%)</label>
                  <Input type="number" step="0.1" value={form.targetMargin}
                    onChange={(e) => setForm({ ...form, targetMargin: e.target.value })} placeholder="30" />
                </div>
              )}
              {needsPct && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {form.strategy === 'BEAT_BY_PCT' ? 'Reduzir em (%)' : 'Markup (%)'}
                  </label>
                  <Input type="number" step="0.1" value={form.adjustmentPct}
                    onChange={(e) => setForm({ ...form, adjustmentPct: e.target.value })} placeholder="5" />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Preço mínimo (R$) <span className="text-muted-foreground font-normal">guardrail</span></label>
                <Input type="number" step="0.01" value={form.minPrice}
                  onChange={(e) => setForm({ ...form, minPrice: e.target.value })} placeholder="Ex: 49.90" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Preço máximo (R$) <span className="text-muted-foreground font-normal">guardrail</span></label>
                <Input type="number" step="0.01" value={form.maxPrice}
                  onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} placeholder="Ex: 199.90" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => createRule.mutate(form)} disabled={!form.name || createRule.isPending}>
                {createRule.isPending ? 'Salvando...' : 'Criar Regra'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules list */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Nome', 'Estratégia', 'Canal', 'Guardrails', 'Último ajuste', 'Ativo', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhuma regra criada</td></tr>
              )}
              {(rules ?? []).map((rule: any) => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info" className="text-xs">{STRATEGY_LABEL[rule.strategy]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {rule.marketplace
                      ? <span className="flex items-center gap-1 text-xs">{MP_EMOJI[rule.marketplace] ?? '🏪'} {rule.marketplace.replace('_', ' ')}</span>
                      : <span className="text-xs text-muted-foreground">Todos</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {rule.minPrice && <span>min: {fmt(Number(rule.minPrice))}</span>}
                    {rule.minPrice && rule.maxPrice && ' · '}
                    {rule.maxPrice && <span>max: {fmt(Number(rule.maxPrice))}</span>}
                    {!rule.minPrice && !rule.maxPrice && '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}>
                      {rule.isActive
                        ? <ToggleRight className="h-5 w-5 text-primary" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground/40" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteRule.mutate(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
