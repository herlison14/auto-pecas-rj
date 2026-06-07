'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, AlertTriangle, CheckCircle, Layers, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'



const DRIFT_LABEL: Record<string, string> = {
  title: 'Título divergente',
  sync_stale: 'Sincronização atrasada (+7d)',
}

export default function CatalogPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedDrift, setSelectedDrift] = useState<string[]>([])
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set())

  const { data: stats } = useQuery({
    queryKey: ['catalog-stats'],
    queryFn: async () => (await api.get('/catalog/stats')).data,
  })

  const { data: driftData, isLoading: loadingDrift } = useQuery({
    queryKey: ['catalog-drift'],
    queryFn: async () => (await api.get('/catalog/drift')).data,
    refetchInterval: 60_000,
  })

  const { data: listingsData, isLoading: loadingListings } = useQuery({
    queryKey: ['catalog-listings', search],
    queryFn: async () => (await api.get('/catalog/listings', { params: { search: search || undefined, limit: 40 } })).data,
  })

  const syncOne = useMutation({
    mutationFn: async (listingId: string) => (await api.post(`/catalog/sync/${listingId}`)).data,
    onSuccess: (_, listingId) => {
      setSyncedIds((s) => new Set([...s, listingId]))
      qc.invalidateQueries({ queryKey: ['catalog-drift'] })
      qc.invalidateQueries({ queryKey: ['catalog-stats'] })
    },
  })

  const syncBulk = useMutation({
    mutationFn: async (ids: string[]) => (await api.post('/catalog/sync-bulk', { listingIds: ids })).data,
    onSuccess: (data, ids) => {
      setSyncedIds((s) => new Set([...s, ...ids]))
      qc.invalidateQueries({ queryKey: ['catalog-drift'] })
      qc.invalidateQueries({ queryKey: ['catalog-stats'] })
      setSelectedDrift([])
    },
  })

  const drifts = driftData?.drifts ?? []
  const listings = listingsData?.listings ?? []

  const toggleDrift = (id: string) =>
    setSelectedDrift((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sincronize dados do catálogo com seus anúncios ativos</p>
        </div>
        {selectedDrift.length > 0 && (
          <Button size="sm" onClick={() => syncBulk.mutate(selectedDrift)} disabled={syncBulk.isPending}>
            <RefreshCw className={cn('h-3.5 w-3.5', syncBulk.isPending && 'animate-spin')} />
            {syncBulk.isPending ? 'Sincronizando...' : `Sincronizar ${selectedDrift.length} selecionados`}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Anúncios ativos', value: stats?.activeListings ?? '—', icon: Layers, color: 'bg-blue-500/15 text-blue-400' },
          { label: 'Sincronizados (24h)', value: stats?.recentlySynced ?? '—', icon: CheckCircle, color: 'bg-emerald-500/15 text-emerald-400' },
          { label: 'Com drift', value: loadingDrift ? '—' : drifts.length, icon: AlertTriangle, color: drifts.length > 0 ? 'bg-amber-500/15 text-amber-400' : 'bg-muted text-muted-foreground' },
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

      {/* Drift alerts */}
      {drifts.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {drifts.length} anúncio(s) com divergência detectada
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDrift(drifts.map((d: any) => d.listingId))}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Selecionar tudo
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-amber-500/10/50 border-b border-amber-500/20">
                <tr>
                  <th className="w-10 px-4 py-2.5" />
                  {['Produto', 'Canal', 'Divergência', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-amber-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drifts.map((d: any) => {
                  const isSynced = syncedIds.has(d.listingId)
                  return (
                    <tr key={d.listingId} className={cn('border-b last:border-0',
                      isSynced ? 'opacity-50' : 'hover:bg-amber-500/10/30 transition-colors')}>
                      <td className="px-4 py-3">
                        <input type="checkbox"
                          checked={selectedDrift.includes(d.listingId)}
                          onChange={() => toggleDrift(d.listingId)}
                          disabled={isSynced}
                          className="rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{d.productName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{d.externalId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs">
                          {MP_EMOJI[d.marketplace] ?? '🏪'} {d.storeName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {d.driftFields.map((f: string) => (
                            <Badge key={f} variant="warning" className="text-[10px]">
                              {DRIFT_LABEL[f] ?? f}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSynced ? (
                          <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end">
                            <CheckCircle className="h-3.5 w-3.5" /> Sincronizado
                          </span>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs"
                            onClick={() => syncOne.mutate(d.listingId)}
                            disabled={syncOne.isPending}>
                            <RefreshCw className={cn('h-3 w-3', syncOne.isPending && 'animate-spin')} />
                            Sincronizar
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* All listings */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Todos os Anúncios</CardTitle>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {['Produto', 'Canal', 'Preço', 'Status', 'Última sync', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingListings && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td colSpan={6} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
              </tr>
            ))}
            {!loadingListings && listings.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                {search ? 'Nenhum resultado' : 'Nenhum anúncio encontrado'}
              </td></tr>
            )}
            {listings.map((l: any) => {
              const isSynced = syncedIds.has(l.id)
              return (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{l.product.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{l.product.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs">
                      {MP_EMOJI[l.store.marketplace] ?? '🏪'} {l.store.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    {Number(l.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={l.status === 'ACTIVE' ? 'success' : 'secondary'} className="text-xs">
                      {l.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {l.syncedAt
                      ? new Date(l.syncedAt).toLocaleDateString('pt-BR')
                      : <span className="text-amber-600">Nunca</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSynced ? (
                      <span className="text-xs text-emerald-600 flex items-center gap-1 justify-end">
                        <CheckCircle className="h-3.5 w-3.5" /> OK
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => syncOne.mutate(l.id)} disabled={syncOne.isPending}>
                        <RefreshCw className="h-3 w-3" /> Sync
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
