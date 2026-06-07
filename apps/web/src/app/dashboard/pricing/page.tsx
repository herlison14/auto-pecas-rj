'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Calculator, DollarSign } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<string, string> = {
  MARKUP_PERCENTAGE: 'Markup (%)',
  MARGIN_PERCENTAGE: 'Margem (%)',
  FIXED_ADDITION: 'Adição Fixa (R$)',
  FIXED_PRICE: 'Preço Fixo (R$)',
}

const MARKETPLACES = ['MERCADO_LIVRE', 'SHOPEE', 'AMAZON', 'MAGALU', 'AMERICANAS']

interface Rule { id: string; name: string; marketplace: string | null; type: string; value: string; isActive: boolean }

export default function PricingPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [simBase, setSimBase] = useState('')
  const [simMarketplace, setSimMarketplace] = useState('')
  const [simResult, setSimResult] = useState<{ finalPrice: number; margin: string } | null>(null)
  const [form, setForm] = useState({ name: '', marketplace: '', type: 'MARKUP_PERCENTAGE', value: '' })

  const { data: rules, isLoading } = useQuery<Rule[]>({
    queryKey: ['pricing-rules'],
    queryFn: async () => (await api.get('/pricing/rules')).data,
  })

  const createRule = useMutation({
    mutationFn: async (data: typeof form) => api.post('/pricing/rules', { ...data, value: Number(data.value), marketplace: data.marketplace || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricing-rules'] }); setShowForm(false); setForm({ name: '', marketplace: '', type: 'MARKUP_PERCENTAGE', value: '' }) },
  })

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => api.put(`/pricing/rules/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-rules'] }),
  })

  const deleteRule = useMutation({
    mutationFn: async (id: string) => api.delete(`/pricing/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-rules'] }),
  })

  async function simulate() {
    const { data } = await api.post('/pricing/simulate', { basePrice: Number(simBase), marketplace: simMarketplace || undefined })
    setSimResult(data)
  }

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Precificação</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Regras aplicadas automaticamente ao publicar anúncios</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Nova Regra
        </Button>
      </div>

      {/* Simulador */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Simulador de Preço
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Custo base (R$)</label>
              <Input type="number" value={simBase} onChange={(e) => setSimBase(e.target.value)} placeholder="100.00" className="w-32" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Marketplace (opcional)</label>
              <select value={simMarketplace} onChange={(e) => setSimMarketplace(e.target.value)}
                className="flex h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Todas as regras</option>
                {MARKETPLACES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <Button variant="secondary" onClick={simulate} disabled={!simBase}>Simular</Button>
            {simResult && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <span className="font-bold text-emerald-400">
                  {simResult.finalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <span className="text-emerald-600 text-xs">margem: {simResult.margin}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Novo formulário */}
      {showForm && (
        <Card className="border-primary/30 animate-fade-in">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Nova Regra de Preço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-sm font-medium">Nome</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Markup Shopee 20%" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Valor</label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Ex: 20" />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-sm font-medium">Marketplace <span className="text-muted-foreground font-normal">(vazio = todos)</span></label>
                <select value={form.marketplace} onChange={(e) => setForm({ ...form, marketplace: e.target.value })}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Todos os canais</option>
                  {MARKETPLACES.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={() => createRule.mutate(form)} disabled={!form.name || !form.value || createRule.isPending}>
                {createRule.isPending ? 'Salvando...' : 'Salvar Regra'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de regras */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-5 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Nome', 'Tipo', 'Valor', 'Canal', 'Ativo', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rules ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">Nenhuma regra criada</td></tr>
              )}
              {(rules ?? []).map((rule) => (
                <tr key={rule.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[rule.type]}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{Number(rule.value).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="text-xs">{rule.marketplace ?? 'Todos'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                      className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', rule.isActive ? 'bg-primary' : 'bg-muted-foreground/30')}>
                      <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-card shadow transition-transform', rule.isActive ? 'translate-x-[18px]' : 'translate-x-[2px]')} />
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
