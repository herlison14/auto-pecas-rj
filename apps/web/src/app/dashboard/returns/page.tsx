'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PackageX, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'


const STATUS_CFG: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' }> = {
  REQUESTED:  { label: 'Solicitado',   variant: 'warning' },
  APPROVED:   { label: 'Aprovado',     variant: 'info' },
  IN_TRANSIT: { label: 'Em trânsito',  variant: 'info' },
  RECEIVED:   { label: 'Recebido',     variant: 'info' },
  INSPECTING: { label: 'Inspeção',     variant: 'warning' },
  REFUNDED:   { label: 'Reembolsado',  variant: 'success' },
  REJECTED:   { label: 'Rejeitado',    variant: 'destructive' },
  CLOSED:     { label: 'Encerrado',    variant: 'secondary' },
}

const REASON_LABEL: Record<string, string> = {
  DEFECTIVE:          'Produto defeituoso',
  WRONG_ITEM:         'Item errado',
  NOT_AS_DESCRIBED:   'Não conforme anúncio',
  BUYER_REMORSE:      'Desistência do comprador',
  LATE_DELIVERY:      'Entrega atrasada',
  DAMAGED_PACKAGING:  'Embalagem danificada',
  OTHER:              'Outro motivo',
}


const STATUS_FLOW = ['REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTING', 'REFUNDED']

export default function ReturnsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [tracking, setTracking] = useState('')

  const { data: summary, isLoading: loadingSum } = useQuery({
    queryKey: ['returns-summary'],
    queryFn: async () => (await api.get('/returns/summary')).data,
  })

  const { data: returnsData, isLoading } = useQuery({
    queryKey: ['returns', statusFilter],
    queryFn: async () => (await api.get('/returns', { params: { status: statusFilter || undefined } })).data,
  })

  const { data: detail } = useQuery({
    queryKey: ['return', selected],
    queryFn: async () => (await api.get(`/returns/${selected}`)).data,
    enabled: !!selected,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      api.patch(`/returns/${id}/status`, { status, sellerNote: note || undefined, trackingCode: tracking || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] })
      qc.invalidateQueries({ queryKey: ['return', selected] })
      qc.invalidateQueries({ queryKey: ['returns-summary'] })
      setNote('')
      setTracking('')
    },
  })

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devoluções (RMA)</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie solicitações de devolução e reembolso</p>
      </div>

      {/* Summary */}
      {loadingSum ? (
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Pendentes', value: summary?.pending ?? 0, icon: Clock, cls: 'text-amber-600', bg: 'bg-amber-500/10' },
            { label: 'Reembolsados', value: summary?.refunded ?? 0, icon: CheckCircle, cls: 'text-emerald-600', bg: 'bg-emerald-500/10' },
            { label: 'Rejeitados', value: summary?.rejected ?? 0, icon: XCircle, cls: 'text-red-600', bg: 'bg-red-500/10' },
            { label: 'Valor reembolsado', value: fmt(summary?.refundTotal ?? 0), icon: RotateCcw, cls: 'text-blue-600', bg: 'bg-blue-500/10' },
          ].map(({ label, value, icon: Icon, cls, bg }) => (
            <Card key={label}>
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-1.5 text-xl font-bold">{value}</p>
                </div>
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', bg)}>
                  <Icon className={cn('h-4 w-4', cls)} strokeWidth={2} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className={cn('grid gap-5', selected ? 'lg:grid-cols-5' : 'grid-cols-1')}>
        {/* List */}
        <div className={cn('space-y-3', selected ? 'lg:col-span-3' : '')}>
          {/* Filter */}
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
            {['', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'REFUNDED', 'REJECTED'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('rounded-md px-3 py-1 text-xs font-semibold transition-all',
                  statusFilter === s ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {s === '' ? 'Todos' : STATUS_CFG[s]?.label ?? s}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {['Pedido', 'Canal', 'Motivo', 'Status', 'Valor', 'Data'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(returnsData?.returns ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-16 text-center">
                      <PackageX className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma devolução encontrada</p>
                    </td></tr>
                  )}
                  {(returnsData?.returns ?? []).map((r: any) => {
                    const sc = STATUS_CFG[r.status] ?? { label: r.status, variant: 'secondary' as const }
                    return (
                      <tr key={r.id}
                        onClick={() => setSelected(selected === r.id ? null : r.id)}
                        className={cn('border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer',
                          selected === r.id && 'bg-primary/5')}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                          #{r.order?.externalId}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1">
                            {MP_EMOJI[r.marketplace] ?? '🏪'}
                            <span className="text-xs text-muted-foreground">{r.store?.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">
                          {REASON_LABEL[r.reason] ?? r.reason}
                        </td>
                        <td className="px-4 py-3"><Badge variant={sc.variant} className="text-xs">{sc.label}</Badge></td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {r.refundAmount ? fmt(Number(r.refundAmount)) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(r.createdAt), 'dd/MM/yy', { locale: ptBR })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Detail panel */}
        {selected && detail && (
          <div className="lg:col-span-2 space-y-3 animate-fade-in">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido</p>
                    <p className="font-mono font-bold text-primary">#{detail.order?.externalId}</p>
                  </div>
                  <Badge variant={STATUS_CFG[detail.status]?.variant ?? 'secondary'}>
                    {STATUS_CFG[detail.status]?.label ?? detail.status}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Comprador</p>
                  <p className="text-sm font-medium">{detail.order?.buyerName ?? '—'}</p>
                  {detail.order?.buyerEmail && <p className="text-xs text-muted-foreground">{detail.order?.buyerEmail}</p>}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo</p>
                  <p className="text-sm">{REASON_LABEL[detail.reason] ?? detail.reason}</p>
                </div>

                {detail.buyerNote && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Nota do comprador</p>
                    <p className="text-sm bg-muted/40 rounded-lg px-3 py-2">{detail.buyerNote}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Itens</p>
                  <div className="space-y-1">
                    {(detail.items ?? []).map((item: any) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span>{item.name} × {item.quantity}</span>
                        <span className="font-medium">{fmt(Number(item.unitPrice) * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  {detail.refundAmount && (
                    <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t">
                      <span>Total</span>
                      <span className="text-primary">{fmt(Number(detail.refundAmount))}</span>
                    </div>
                  )}
                </div>

                {/* Status progress */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Progresso</p>
                  <div className="flex items-center gap-1">
                    {STATUS_FLOW.map((s, i) => {
                      const idx = STATUS_FLOW.indexOf(detail.status)
                      const done = i <= idx
                      return (
                        <div key={s} className="flex-1 flex flex-col items-center gap-1">
                          <div className={cn('h-2 w-full rounded-full', done ? 'bg-primary' : 'bg-muted')} />
                          <span className="text-[10px] text-muted-foreground leading-tight text-center hidden lg:block">
                            {STATUS_CFG[s]?.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                {!['REFUNDED', 'REJECTED', 'CLOSED'].includes(detail.status) && (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs font-medium">Atualizar status</p>
                    <div className="space-y-2">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Nota interna (opcional)"
                        rows={2}
                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      />
                      {detail.status === 'APPROVED' && (
                        <input
                          value={tracking}
                          onChange={(e) => setTracking(e.target.value)}
                          placeholder="Código de rastreio (opcional)"
                          className="flex h-8 w-full rounded-lg border border-input bg-background px-3 py-1 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {detail.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: detail.id, status: 'APPROVED' })}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: detail.id, status: 'REJECTED' })}>
                            Rejeitar
                          </Button>
                        </>
                      )}
                      {detail.status === 'APPROVED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: detail.id, status: 'IN_TRANSIT' })}>
                          Marcar em trânsito
                        </Button>
                      )}
                      {detail.status === 'IN_TRANSIT' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: detail.id, status: 'RECEIVED' })}>
                          Marcar recebido
                        </Button>
                      )}
                      {(detail.status === 'RECEIVED' || detail.status === 'INSPECTING') && (
                        <>
                          <Button size="sm" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: detail.id, status: 'REFUNDED' })}>
                            Confirmar reembolso
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => updateStatus.mutate({ id: detail.id, status: 'REJECTED' })}>
                            Rejeitar após inspeção
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
