'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Plug } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useIntegrationsHealth, type StoreHealth, type HealthStatus } from '@/hooks/use-health'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'



const STATUS_CONFIG: Record<HealthStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary'; dot: string }> = {
  ok:            { label: 'Operacional',   variant: 'success',     dot: 'bg-emerald-500/10' },
  token_expired: { label: 'Token expirado',variant: 'warning',     dot: 'bg-amber-500/10' },
  error:         { label: 'Erro',          variant: 'destructive', dot: 'bg-red-500/10' },
  unconfigured:  { label: 'Desconectado',  variant: 'secondary',   dot: 'bg-muted-foreground/40' },
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </Badge>
  )
}

function LatencyBar({ ms }: { ms: number | null }) {
  if (ms == null) return <span className="text-xs text-muted-foreground/50">—</span>
  const cls = ms < 500 ? 'text-emerald-600' : ms < 1500 ? 'text-amber-600' : 'text-red-600'
  return <span className={cn('text-xs font-mono font-semibold', cls)}>{ms} ms</span>
}

export default function IntegrationHealthPage() {
  const qc = useQueryClient()
  const { data: stores, isLoading, dataUpdatedAt } = useIntegrationsHealth()
  const [rechecking, setRechecking] = useState<Record<string, boolean>>({})

  async function recheckStore(storeId: string) {
    setRechecking((r) => ({ ...r, [storeId]: true }))
    try {
      await api.get(`/integrations/health/${storeId}`)
      await qc.invalidateQueries({ queryKey: ['integrations-health'] })
    } finally {
      setRechecking((r) => ({ ...r, [storeId]: false }))
    }
  }

  async function recheckAll() {
    await qc.invalidateQueries({ queryKey: ['integrations-health'] })
  }

  const summary = stores ? {
    ok:    stores.filter((s) => s.status === 'ok').length,
    warn:  stores.filter((s) => s.status === 'token_expired').length,
    error: stores.filter((s) => s.status === 'error').length,
    total: stores.length,
  } : null

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard/integrations"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Status dos Canais</h1>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Atualizado às {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={recheckAll} disabled={isLoading}>
          <RefreshCw className="h-3.5 w-3.5" /> Verificar tudo
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Operacional', value: summary.ok,   cls: 'text-emerald-600' },
            { label: 'Token expirado', value: summary.warn,  cls: 'text-amber-600' },
            { label: 'Com erro',    value: summary.error, cls: 'text-red-600' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (stores ?? []).length === 0 ? (
        <Card className="py-16 text-center">
          <Plug className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-semibold">Nenhum canal conectado</p>
          <Link href="/dashboard/integrations" className="mt-2 inline-block text-sm text-primary hover:underline">
            Conectar marketplace →
          </Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
<table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Canal', 'Status', 'Latência', 'Token expira em', 'Última verificação', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(stores ?? []).map((s) => (
                <tr key={s.storeId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{MP_EMOJI[s.marketplace] ?? '🏪'}</span>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.marketplace.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                    {s.errorMessage && (
                      <p className="mt-1 text-xs text-destructive max-w-xs truncate" title={s.errorMessage}>
                        {s.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3"><LatencyBar ms={s.latencyMs} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {s.tokenExpiresAt
                      ? (() => {
                          const diffH = Math.round((new Date(s.tokenExpiresAt).getTime() - Date.now()) / 3_600_000)
                          return diffH < 0
                            ? <span className="text-destructive font-semibold">Expirado</span>
                            : diffH < 24
                            ? <span className="text-amber-600 font-semibold">{diffH}h restantes</span>
                            : <span>{Math.round(diffH / 24)}d restantes</span>
                        })()
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.lastCheckedAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => recheckStore(s.storeId)} disabled={!!rechecking[s.storeId]}>
                      {rechecking[s.storeId] ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Verificar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">Atualização automática a cada 60 segundos.</p>
    </div>
  )
}
