'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, ShoppingCart, TrendingUp, ChevronRight, X, Package } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'



const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' | 'destructive' }> = {
  DELIVERED: { label: 'Entregue', variant: 'success' },
  SHIPPED: { label: 'Enviado', variant: 'warning' },
  PENDING: { label: 'Pendente', variant: 'secondary' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
}

type Customer = { name: string; document: string; orderCount: number; totalSpent: number; lastOrderAt: string }
type Order = { id: string; externalId: string; status: string; total: string; createdAt: string; store: { name: string; marketplace: string }; items: any[] }

function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer-detail', customer.document],
    queryFn: async () => (await api.get(`/customers/${encodeURIComponent(customer.document)}`)).data,
  })

  const orders: Order[] = data?.orders ?? []
  const stats = data?.stats

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg bg-card border-l shadow-xl h-full overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm">{customer.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{customer.document ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total gasto</p>
                <p className="text-xl font-bold">
                  {(stats?.totalSpent ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-xl font-bold">{stats?.orderCount ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Order history */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Histórico de pedidos</h3>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido encontrado</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => {
                  const cfg = STATUS_CONFIG[o.status] ?? { label: o.status, variant: 'secondary' as const }
                  return (
                    <div key={o.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{MP_EMOJI[o.store.marketplace] ?? '🏪'}</span>
                          <span className="text-sm font-medium">#{o.externalId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">
                            {Number(o.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {o.items.slice(0, 2).map((item: any) => (
                            <span key={item.id} className="text-xs text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                              {item.product?.name ?? item.name}
                            </span>
                          ))}
                          {o.items.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{o.items.length - 2}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Customer | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: async () => (await api.get('/customers', { params: { search: search || undefined, page, limit: 30 } })).data,
  })

  const customers: Customer[] = data?.customers ?? []

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data?.total ?? 0} compradores · histórico de compras
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Compradores</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por nome..." className="h-8 pl-8 text-xs" />
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
<table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              {['#', 'Comprador', 'Pedidos', 'Total gasto', 'Último pedido', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b">
                <td colSpan={6} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
              </tr>
            ))}
            {!isLoading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">Nenhum cliente encontrado</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Os compradores aparecerão aqui conforme os pedidos forem recebidos</p>
                </td>
              </tr>
            )}
            {customers.map((c, idx) => {
              const rank = (page - 1) * 30 + idx + 1
              return (
                <tr key={c.document || c.name} className="border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelected(c)}>
                  <td className="px-4 py-3 text-xs font-bold text-muted-foreground w-8">{rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        {c.document && <p className="text-xs text-muted-foreground font-mono">{c.document}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm">
                      <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.orderCount}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold tabular-nums text-sm">
                    {c.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.lastOrderAt ? formatDistanceToNow(new Date(c.lastOrderAt), { addSuffix: true, locale: ptBR }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
</div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">Página {page} de {data.pages}</span>
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
