'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Truck, Plus, Search, X, ChevronRight, Package,
  CheckCircle, Clock, AlertTriangle, Ban, Send,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type Supplier = { id: string; name: string; cnpj?: string; email?: string; phone?: string; contact?: string; isActive: boolean }
type POStatus = 'DRAFT' | 'SENT' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED'
type PO = {
  id: string; number: string; status: POStatus; totalCost: string
  expectedAt?: string; createdAt: string
  supplier: { id: string; name: string }
  items: Array<{ id: string; quantity: number; receivedQty: number; unitCost: string; product: { name: string; sku: string } }>
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PO_STATUS_CONFIG: Record<POStatus, { label: string; variant: 'secondary' | 'warning' | 'success' | 'destructive'; icon: React.ElementType }> = {
  DRAFT:     { label: 'Rascunho',   variant: 'secondary',   icon: Clock },
  SENT:      { label: 'Enviada',    variant: 'warning',     icon: Send },
  PARTIAL:   { label: 'Parcial',    variant: 'warning',     icon: AlertTriangle },
  RECEIVED:  { label: 'Recebida',   variant: 'success',     icon: CheckCircle },
  CANCELLED: { label: 'Cancelada',  variant: 'destructive', icon: Ban },
}

// ── Supplier Form ──────────────────────────────────────────────────────────────

function SupplierForm({ onClose, initial }: { onClose: () => void; initial?: Partial<Supplier> }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', cnpj: '', email: '', phone: '', contact: '', ...initial })

  const save = useMutation({
    mutationFn: async () => initial?.id
      ? api.patch(`/suppliers/${initial.id}`, form)
      : api.post('/suppliers', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); onClose() },
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">{initial?.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input value={form.name} onChange={set('name')} placeholder="Razão social" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
              <Input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <Input value={form.phone} onChange={set('phone')} placeholder="(21) 99999-9999" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">E-mail</label>
            <Input value={form.email} onChange={set('email')} placeholder="contato@fornecedor.com" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contato</label>
            <Input value={form.contact} onChange={set('contact')} placeholder="Nome do representante" className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
            {save.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── PO Form ────────────────────────────────────────────────────────────────────

function PoForm({ suppliers, onClose }: { suppliers: Supplier[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Array<{ productId: string; productName: string; sku: string; quantity: number; unitCost: number }>>([])
  const [productSearch, setProductSearch] = useState('')

  const { data: productData } = useQuery({
    queryKey: ['products-search', productSearch],
    queryFn: async () => (await api.get('/products', { params: { search: productSearch || undefined, limit: 10 } })).data,
    enabled: productSearch.length >= 2,
  })
  const products = productData?.products ?? []

  const addItem = (p: { id: string; name: string; sku: string }) => {
    if (items.find((i) => i.productId === p.id)) return
    setItems((prev) => [...prev, { productId: p.id, productName: p.name, sku: p.sku, quantity: 1, unitCost: 0 }])
    setProductSearch('')
  }

  const updateItem = (idx: number, field: 'quantity' | 'unitCost', val: number) =>
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))

  const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0)

  const save = useMutation({
    mutationFn: async () => api.post('/suppliers/purchase-orders', {
      supplierId, expectedAt: expectedAt || undefined, notes: notes || undefined,
      items: items.map(({ productId, quantity, unitCost }) => ({ productId, quantity, unitCost })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold">Nova Ordem de Compra</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Fornecedor *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Selecione...</option>
              {suppliers.filter((s) => s.isActive).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Previsão de entrega</label>
            <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="mt-1 h-9" />
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground">Adicionar produto</label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              className="pl-8 h-9"
            />
            {products.length > 0 && productSearch.length >= 2 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-card border rounded-lg shadow-lg overflow-hidden">
                {products.map((p: any) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 text-sm">
                    <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium flex-1">{p.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  {['Produto', 'Qtd', 'Custo unit.', 'Subtotal', ''].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.productId} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-xs">{item.productName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={1} value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="h-7 w-16 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} step={0.01} value={item.unitCost}
                        onChange={(e) => updateItem(idx, 'unitCost', Number(e.target.value))}
                        className="h-7 w-24 text-xs" />
                    </td>
                    <td className="px-3 py-2 text-xs font-semibold tabular-nums">
                      {(item.quantity * item.unitCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeItem(idx)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/20">
                  <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-right text-muted-foreground">Total</td>
                  <td colSpan={2} className="px-3 py-2 text-sm font-bold tabular-nums">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!supplierId || items.length === 0 || save.isPending}>
            {save.isPending ? 'Criando...' : 'Criar Ordem'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Receive Modal ──────────────────────────────────────────────────────────────

function ReceiveModal({ po, onClose }: { po: PO; onClose: () => void }) {
  const qc = useQueryClient()
  const [warehouseId, setWarehouseId] = useState('')
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(po.items.map((i) => [i.id, i.quantity - i.receivedQty]))
  )

  const { data: whs } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get('/inventory/warehouses')).data,
  })

  const receive = useMutation({
    mutationFn: async () => api.post(`/suppliers/purchase-orders/${po.id}/receive`, {
      warehouseId,
      items: Object.entries(qty)
        .filter(([, v]) => v > 0)
        .map(([itemId, receivedQty]) => ({ itemId, receivedQty })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">Receber OC {po.number}</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground">Armazém de destino *</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione...</option>
            {(whs ?? []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div className="border rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                {['Produto', 'Pendente', 'Receber agora'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => {
                const pending = item.quantity - item.receivedQty
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <p className="font-medium text-xs">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.product.sku}</p>
                    </td>
                    <td className="px-3 py-2 text-sm tabular-nums">{pending}</td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} max={pending} value={qty[item.id] ?? 0}
                        onChange={(e) => setQty((q) => ({ ...q, [item.id]: Math.min(Number(e.target.value), pending) }))}
                        disabled={pending === 0}
                        className="h-7 w-20 text-xs" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => receive.mutate()} disabled={!warehouseId || receive.isPending}>
            {receive.isPending ? 'Registrando...' : 'Confirmar Recebimento'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers')
  const [search, setSearch] = useState('')
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [showPoForm, setShowPoForm] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [receivingPo, setReceivingPo] = useState<PO | null>(null)
  const [poFilter, setPoFilter] = useState('')

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: async () => (await api.get('/suppliers', { params: { search: search || undefined } })).data,
  })

  const { data: poData, isLoading: loadingPo } = useQuery({
    queryKey: ['purchase-orders', poFilter],
    queryFn: async () => (await api.get('/suppliers/purchase-orders', { params: { status: poFilter || undefined, limit: 30 } })).data,
  })

  const sendPo = useMutation({
    mutationFn: async (id: string) => api.post(`/suppliers/purchase-orders/${id}/send`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  })
  const cancelPo = useMutation({
    mutationFn: async (id: string) => api.post(`/suppliers/purchase-orders/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  })

  const orders: PO[] = poData?.orders ?? []
  const activeSuppliers = (suppliers as Supplier[]).filter((s) => s.isActive)

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      {(showSupplierForm || editSupplier) && (
        <SupplierForm
          initial={editSupplier ?? undefined}
          onClose={() => { setShowSupplierForm(false); setEditSupplier(null) }}
        />
      )}
      {showPoForm && (
        <PoForm suppliers={suppliers as Supplier[]} onClose={() => setShowPoForm(false)} />
      )}
      {receivingPo && (
        <ReceiveModal po={receivingPo} onClose={() => setReceivingPo(null)} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie fornecedores e ordens de compra</p>
        </div>
        <Button size="sm" onClick={() => tab === 'suppliers' ? setShowSupplierForm(true) : setShowPoForm(true)}>
          <Plus className="h-3.5 w-3.5" />
          {tab === 'suppliers' ? 'Novo Fornecedor' : 'Nova Ordem'}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ key: 'suppliers', label: `Fornecedores (${activeSuppliers.length})` }, { key: 'orders', label: `Ordens de Compra (${poData?.total ?? 0})` }].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Suppliers Tab ── */}
      {tab === 'suppliers' && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Fornecedores cadastrados</CardTitle>
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..." className="h-8 pl-8 text-xs" />
              </div>
            </div>
          </CardHeader>
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                {['Fornecedor', 'CNPJ', 'Contato', 'E-mail', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingSuppliers && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td colSpan={6} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                </tr>
              ))}
              {!loadingSuppliers && (suppliers as Supplier[]).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor cadastrado
                </td></tr>
              )}
              {(suppliers as Supplier[]).map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{s.name}</p>
                        {s.contact && <p className="text-xs text-muted-foreground">{s.contact}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{s.cnpj ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">{s.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.isActive ? 'success' : 'secondary'} className="text-xs">
                      {s.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditSupplier(s)}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5 justify-end">
                      Editar <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Purchase Orders Tab ── */}
      {tab === 'orders' && (
        <div className="flex flex-col gap-4">
          {/* Filter */}
          <div className="flex gap-1 flex-wrap">
            {[{ v: '', l: 'Todas' }, { v: 'DRAFT', l: 'Rascunho' }, { v: 'SENT', l: 'Enviadas' }, { v: 'PARTIAL', l: 'Parciais' }, { v: 'RECEIVED', l: 'Recebidas' }, { v: 'CANCELLED', l: 'Canceladas' }].map((f) => (
              <button key={f.v} onClick={() => setPoFilter(f.v)}
                className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                  poFilter === f.v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                {f.l}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  {['Número', 'Fornecedor', 'Itens', 'Total', 'Status', 'Previsão', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingPo && Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))}
                {!loadingPo && orders.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma ordem de compra encontrada
                  </td></tr>
                )}
                {orders.map((po) => {
                  const cfg = PO_STATUS_CONFIG[po.status]
                  const StatusIcon = cfg.icon
                  return (
                    <tr key={po.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-semibold">{po.number}</td>
                      <td className="px-4 py-3 text-sm">{po.supplier.name}</td>
                      <td className="px-4 py-3 text-sm">{po.items.length} produto(s)</td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-sm">
                        {Number(po.totalCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cfg.variant} className="text-xs flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {po.expectedAt
                          ? new Date(po.expectedAt).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {po.status === 'DRAFT' && (
                            <Button variant="outline" size="sm" className="h-7 text-xs"
                              onClick={() => sendPo.mutate(po.id)} disabled={sendPo.isPending}>
                              <Send className="h-3 w-3" /> Enviar
                            </Button>
                          )}
                          {(po.status === 'SENT' || po.status === 'PARTIAL') && (
                            <Button variant="outline" size="sm" className="h-7 text-xs text-emerald-400 border-emerald-300 hover:bg-emerald-500/10"
                              onClick={() => setReceivingPo(po)}>
                              <CheckCircle className="h-3 w-3" /> Receber
                            </Button>
                          )}
                          {!['RECEIVED', 'CANCELLED'].includes(po.status) && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => cancelPo.mutate(po.id)} disabled={cancelPo.isPending}>
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  )
}
