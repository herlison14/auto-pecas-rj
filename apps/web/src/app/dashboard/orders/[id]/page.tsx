'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Package, MapPin, FileText, Truck, RefreshCw, Printer, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { printDanfe, printShippingLabel } from '@/components/ui/auto-print-agent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'


const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'info' }> = {
  PENDING:   { label: 'Pendente',   variant: 'warning' },
  CONFIRMED: { label: 'Confirmado', variant: 'info' },
  SHIPPED:   { label: 'Enviado',    variant: 'success' },
  DELIVERED: { label: 'Entregue',   variant: 'success' },
  CANCELLED: { label: 'Cancelado',  variant: 'destructive' },
  RETURNED:  { label: 'Devolvido',  variant: 'secondary' },
}

const NFE_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'NF-e em processamento', color: 'text-blue-600' },
  AUTHORIZED: { label: 'NF-e autorizada',       color: 'text-emerald-600' },
  REJECTED:   { label: 'NF-e rejeitada',        color: 'text-red-600' },
  CANCELLED:  { label: 'NF-e cancelada',        color: 'text-muted-foreground' },
  NONE:       { label: 'NF-e não emitida',      color: 'text-amber-600' },
}


function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()

  const { data: order, isLoading } = useQuery({
    queryKey: ['orders', id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data,
    enabled: !!id,
  })

  const emitNfe = useMutation({
    mutationFn: async () => api.post(`/nfe/orders/${id}/emit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', id] }),
  })

  const markShipped = useMutation({
    mutationFn: async () => api.post(`/orders/${id}/ship`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders', id] }),
  })

  const [printing, setPrinting] = useState(false)
  const [printingLabel, setPrintingLabel] = useState(false)
  const [labelError, setLabelError] = useState('')

  async function handlePrint() {
    setPrinting(true)
    try {
      await printDanfe(id)
      await api.post(`/nfe/orders/${id}/printed`)
    } finally {
      setPrinting(false)
    }
  }

  async function handlePrintLabel() {
    setPrintingLabel(true)
    setLabelError('')
    try {
      await printShippingLabel(id)
    } catch (err: any) {
      // erro vem como Blob quando responseType é blob — extrai a mensagem
      let msg = 'Erro ao buscar a etiqueta'
      const data = err?.response?.data
      if (data instanceof Blob) {
        try { msg = JSON.parse(await data.text()).message ?? msg } catch { /* mantém genérica */ }
      } else if (data?.message) {
        msg = data.message
      }
      setLabelError(msg)
    } finally {
      setPrintingLabel(false)
    }
  }

  async function handleDownloadPdf() {
    const res = await api.get(`/nfe/orders/${id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  if (isLoading || !order) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[order.status] ?? { label: order.status, variant: 'secondary' as const }
  const nfeCfg = NFE_CONFIG[order.nfeStatus ?? 'NONE'] ?? NFE_CONFIG.NONE
  const addr = order.shippingAddr as Record<string, string> | null

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{MP_EMOJI[order.marketplace] ?? '🏪'}</span>
            <h1 className="text-xl font-bold tracking-tight">Pedido #{order.externalId}</h1>
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {order.marketplace.replace('_', ' ')} · {new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex gap-2">
          {order.status === 'CONFIRMED' && (
            <Button size="sm" variant="outline" onClick={() => markShipped.mutate()} disabled={markShipped.isPending}>
              <Truck className="h-4 w-4" /> {markShipped.isPending ? 'Processando...' : 'Marcar como enviado'}
            </Button>
          )}
          {order.marketplace === 'MERCADO_LIVRE' && ['CONFIRMED', 'SHIPPED'].includes(order.status) && (
            <Button size="sm" variant="outline" onClick={() => handlePrintLabel()} disabled={printingLabel}>
              <Truck className="h-4 w-4" /> {printingLabel ? 'Buscando...' : 'Imprimir etiqueta'}
            </Button>
          )}
          {order.nfeStatus !== 'AUTHORIZED' && order.nfeStatus !== 'PENDING' && order.status === 'CONFIRMED' && (
            <Button size="sm" onClick={() => emitNfe.mutate()} disabled={emitNfe.isPending}>
              <FileText className="h-4 w-4" /> {emitNfe.isPending ? 'Emitindo...' : 'Emitir NF-e'}
            </Button>
          )}
          {order.nfeStatus === 'AUTHORIZED' && (
            <Button size="sm" variant="outline" onClick={() => handlePrint()} disabled={printing}>
              <Printer className="h-4 w-4" /> {printing ? 'Preparando...' : 'Imprimir DANFE'}
            </Button>
          )}
        </div>
      </div>

      {labelError && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}>
          {labelError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Itens do pedido */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Itens do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
<table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    {['Produto', 'Qtd', 'Preço unit.', 'Total'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((item: any) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3">{fmt(Number(item.unitPrice))}</td>
                      <td className="px-4 py-3 font-semibold">{fmt(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
              <div className="border-t px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{fmt(Number(order.subtotal))}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Frete</span>
                  <span>{fmt(Number(order.shippingCost))}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-primary">{fmt(Number(order.total))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço de entrega */}
          {addr && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Endereço de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{addr.name ?? order.buyerName}</p>
                <p>{addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.complement ? ` — ${addr.complement}` : ''}</p>
                <p>{addr.neighborhood ? `${addr.neighborhood} · ` : ''}{addr.city} — {addr.state}</p>
                <p>CEP {addr.zipCode}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          {/* Comprador */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Comprador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium">{order.buyerName ?? '—'}</p>
              {order.buyerEmail && <p className="text-muted-foreground">{order.buyerEmail}</p>}
              {order.buyerDocument && <p className="text-muted-foreground font-mono text-xs">{order.buyerDocument}</p>}
            </CardContent>
          </Card>

          {/* Status NF-e */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Nota Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className={cn('h-4 w-4', nfeCfg.color)} />
                <span className={cn('text-sm font-semibold', nfeCfg.color)}>{nfeCfg.label}</span>
              </div>
              {order.nfeStatus === 'AUTHORIZED' && (
                <div className="flex flex-col gap-2">
                  <Button size="sm" className="w-full" onClick={() => handlePrint()} disabled={printing}>
                    <Printer className="h-4 w-4" /> {printing ? 'Preparando...' : 'Imprimir DANFE'}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleDownloadPdf()}>
                    <Download className="h-4 w-4" /> Baixar PDF
                  </Button>
                </div>
              )}
              {(!order.nfeStatus || order.nfeStatus === 'REJECTED') && order.status === 'CONFIRMED' && (
                <Button size="sm" className="w-full" onClick={() => emitNfe.mutate()} disabled={emitNfe.isPending}>
                  {emitNfe.isPending ? 'Emitindo...' : 'Emitir NF-e'}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Datas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Datas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                { label: 'Criado em', value: order.createdAt },
                { label: 'Pago em', value: order.paidAt },
                { label: 'Enviado em', value: order.shippedAt },
                { label: 'Entregue em', value: order.deliveredAt },
              ].filter((d) => d.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{new Date(value).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
