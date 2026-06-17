'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MP_EMOJI } from '@/lib/marketplace'



const STATUS_CFG: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' | 'secondary' }> = {
  PENDING:       { label: 'Aguardando',     variant: 'warning' },
  CONFIRMED:     { label: 'Confirmado',     variant: 'info' },
  INVOICED:      { label: 'NF Emitida',     variant: 'info' },
  READY_TO_SHIP: { label: 'Pronto p/ Env.', variant: 'info' },
  SHIPPED:       { label: 'Enviado',        variant: 'success' },
  DELIVERED:     { label: 'Entregue',       variant: 'success' },
  CANCELLED:     { label: 'Cancelado',      variant: 'destructive' },
  RETURNED:      { label: 'Devolvido',      variant: 'secondary' },
}

const NFE_CFG: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  ISSUED:    { label: 'Emitida',  variant: 'success' },
  EMITTING:  { label: 'Emitindo', variant: 'warning' },
  ERROR:     { label: 'Erro',     variant: 'destructive' },
  PENDING:   { label: 'Pendente', variant: 'secondary' },
  CANCELLED: { label: 'Cancelada',variant: 'secondary' },
}

interface Order {
  id: string; externalId: string; marketplace: string
  store: { name: string; marketplace: string }
  status: string; buyerName: string; total: number; createdAt: string; nfeStatus?: string
}

export function OrdersTable({ orders, isLoading, selected, onSelect }: {
  orders: Order[]; isLoading: boolean; selected: string[]; onSelect: (ids: string[]) => void
}) {
  const toggleAll = () => onSelect(selected.length === orders.length ? [] : orders.map((o) => o.id))
  const toggle = (id: string) => onSelect(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])

  if (orders.length === 0 && !isLoading) {
    return (
      <Card className="py-16 text-center">
        <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold">Nenhum pedido encontrado</p>
        <p className="text-sm text-muted-foreground mt-1">Tente ajustar os filtros</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
<table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className="w-10 px-4 py-3">
              <input type="checkbox" className="rounded" checked={selected.length === orders.length && orders.length > 0} onChange={toggleAll} />
            </th>
            {['Pedido', 'Canal', 'Comprador', 'Status', 'NF-e', 'Total', 'Data'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const sc = STATUS_CFG[order.status] ?? { label: order.status, variant: 'secondary' as const }
            const nfc = order.nfeStatus ? NFE_CFG[order.nfeStatus] : null
            return (
              <tr key={order.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
                <td className="px-4 py-3">
                  <input type="checkbox" className="rounded" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                    #{order.externalId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span>{MP_EMOJI[order.marketplace] ?? '🏪'}</span>
                    <span className="text-xs text-muted-foreground">{order.store.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[140px] truncate">{order.buyerName ?? '—'}</td>
                <td className="px-4 py-3"><Badge variant={sc.variant} className="text-xs">{sc.label}</Badge></td>
                <td className="px-4 py-3">
                  {nfc ? <Badge variant={nfc.variant} className="text-xs">{nfc.label}</Badge> : <span className="text-xs text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {format(new Date(order.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
</div>
    </Card>
  )
}
