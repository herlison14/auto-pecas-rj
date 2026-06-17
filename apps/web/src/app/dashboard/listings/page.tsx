'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Megaphone, Search, Play, Pause, Trash2, RefreshCw,
  Check, ChevronDown, DollarSign, ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI, MARKETPLACES } from '@/lib/marketplace'

const STATUS_CONFIG = {
  ACTIVE:       { label: 'Ativo',         variant: 'success'     as const },
  PAUSED:       { label: 'Pausado',       variant: 'secondary'   as const },
  CLOSED:       { label: 'Encerrado',     variant: 'destructive' as const },
  UNDER_REVIEW: { label: 'Em revisão',    variant: 'warning'     as const },
}

type Listing = {
  id: string; title: string; price: string; status: keyof typeof STATUS_CONFIG; url?: string; externalId: string
  store: { id: string; name: string; marketplace: string }
  product: { id: string; name: string; sku: string }
}

// ── Inline price editor ────────────────────────────────────────────────────────

function PriceCell({ listing, onSave }: { listing: Listing; onSave: (id: string, price: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(Number(listing.price).toFixed(2))

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number" value={val} onChange={(e) => setVal(e.target.value)}
          className="h-7 w-24 text-xs" autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSave(listing.id, Number(val)); setEditing(false) }
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <button onClick={() => { onSave(listing.id, Number(val)); setEditing(false) }}
          className="text-emerald-600 hover:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }
  return (
    <button onClick={() => setEditing(true)}
      className="flex items-center gap-1 font-semibold tabular-nums text-sm hover:text-primary transition-colors group">
      {Number(listing.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      <DollarSign className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </button>
  )
}

// ── Bulk price modal ───────────────────────────────────────────────────────────

function BulkPriceModal({ count, onApply, onClose }: { count: number; onApply: (price: number) => void; onClose: () => void }) {
  const [price, setPrice] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-xs mx-4 p-6 space-y-4">
        <h3 className="font-bold text-sm">Alterar preço de {count} anúncio(s)</h3>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Novo preço (R$)</label>
          <Input type="number" min={0.01} step={0.01} value={price}
            onChange={(e) => setPrice(e.target.value)} className="mt-1" autoFocus />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="sm" className="flex-1" disabled={!price || Number(price) <= 0}
            onClick={() => { onApply(Number(price)); onClose() }}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ListingsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [mpFilter, setMpFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkPrice, setShowBulkPrice] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['listings', search, mpFilter, statusFilter, page],
    queryFn: async () => (await api.get('/listings', {
      params: { search: search || undefined, marketplace: mpFilter || undefined, status: statusFilter || undefined, page, limit: 40 }
    })).data,
  })

  const patchListing = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; price?: number; status?: string }) =>
      (await api.patch(`/listings/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  })

  const bulkUpdate = useMutation({
    mutationFn: async (body: { ids: string[]; price?: number; status?: string }) =>
      (await api.patch('/listings/bulk', body)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listings'] }); setSelected(new Set()) },
  })

  const deleteListing = useMutation({
    mutationFn: async (id: string) => api.delete(`/listings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listings'] }),
  })

  const listings: Listing[] = data?.listings ?? []
  const allIds = listings.map((l) => l.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const selectedList = [...selected]

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      {showBulkPrice && (
        <BulkPriceModal
          count={selectedList.length}
          onApply={(price) => bulkUpdate.mutate({ ids: selectedList, price })}
          onClose={() => setShowBulkPrice(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anúncios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie todos os seus anúncios em um só lugar</p>
        </div>
        {selectedList.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-sm">
            <span className="font-semibold text-blue-400">{selectedList.length} selecionados</span>
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => bulkUpdate.mutate({ ids: selectedList, status: 'ACTIVE' })}>
              <Play className="h-3 w-3" /> Ativar
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => bulkUpdate.mutate({ ids: selectedList, status: 'PAUSED' })}>
              <Pause className="h-3 w-3" /> Pausar
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => setShowBulkPrice(true)}>
              <DollarSign className="h-3 w-3" /> Alterar preço
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar produto ou título..." className="h-8 pl-8 text-xs" />
        </div>

        <div className="flex gap-1 flex-wrap">
          {[{ v: '', l: 'Todos canais' }, ...MARKETPLACES.map((m) => ({ v: m, l: m.replace('_', ' ') }))].map((f) => (
            <button key={f.v} onClick={() => { setMpFilter(f.v); setPage(1) }}
              className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
                mpFilter === f.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              {f.v && (MP_EMOJI[f.v] ?? '🏪')} {f.l}
            </button>
          ))}
        </div>

        <div className="flex gap-1 ml-auto">
          {[{ v: '', l: 'Todos' }, { v: 'ACTIVE', l: 'Ativos' }, { v: 'PAUSED', l: 'Pausados' }].map((f) => (
            <button key={f.v} onClick={() => { setStatusFilter(f.v); setPage(1) }}
              className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
                statusFilter === f.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
<table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="w-10 px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              </th>
              {['Produto', 'Canal', 'Título do anúncio', 'Preço', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
              </tr>
            ))}
            {!isLoading && listings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center">
                  <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">Nenhum anúncio encontrado</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Publique produtos nos seus canais para vê-los aqui</p>
                </td>
              </tr>
            )}
            {listings.map((l) => {
              const cfg = STATUS_CONFIG[l.status] ?? STATUS_CONFIG.PAUSED
              const isSelected = selected.has(l.id)
              return (
                <tr key={l.id} className={cn('border-b last:border-0 transition-colors', isSelected ? 'bg-primary/5' : 'hover:bg-muted/20')}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(l.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{l.product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{l.product.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs">
                      {MP_EMOJI[l.store.marketplace] ?? '🏪'} {l.store.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-xs text-muted-foreground truncate">{l.title}</p>
                    {l.externalId && !l.externalId.startsWith('pending') && (
                      <p className="text-[10px] font-mono text-muted-foreground/60">{l.externalId}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PriceCell listing={l} onSave={(id, price) => patchListing.mutate({ id, price })} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {l.url && (
                        <a href={l.url} target="_blank" rel="noopener noreferrer"
                          className="flex h-7 w-7 items-center justify-center rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {l.status === 'ACTIVE' ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => patchListing.mutate({ id: l.id, status: 'PAUSED' })}>
                          <Pause className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600"
                          onClick={() => patchListing.mutate({ id: l.id, status: 'ACTIVE' })}>
                          <Play className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Remover anúncio?')) deleteListing.mutate(l.id) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
</div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {data.total} anúncio(s) · página {page} de {data.pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
