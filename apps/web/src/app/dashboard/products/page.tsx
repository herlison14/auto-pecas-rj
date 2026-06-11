'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Upload, Search, Trash2, Package, Download } from 'lucide-react'
import { useProducts, useDeleteProduct } from '@/hooks/use-products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MP_EMOJI } from '@/lib/marketplace'



export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useProducts(search)
  const deleteProduct = useDeleteProduct()

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Catálogo e publicação em marketplaces</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/templates/products-template.xlsx" download>
              <Download className="h-4 w-4" /> Modelo de planilha
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/products/import">
              <Upload className="h-4 w-4" /> Importar
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4" /> Novo Produto
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou SKU..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(data?.data ?? []).map((product) => {
            const totalStock = product.stockItems.reduce((s, i) => s + i.quantity - i.reserved, 0)
            const isLow = totalStock <= 5
            return (
              <div key={product.id} className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-card-hover transition-all duration-200 animate-fade-in">
                <Link href={`/dashboard/products/${product.id}`} className="block">
                  <div className="aspect-square bg-muted/40 overflow-hidden">
                    {product.images[0] ? (
                      <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-3 space-y-2">
                  <Link href={`/dashboard/products/${product.id}`}>
                    <p className="font-semibold text-sm line-clamp-2 leading-snug hover:text-primary transition-colors">{product.name}</p>
                  </Link>
                  <p className="text-xs font-mono text-muted-foreground">{product.sku}</p>

                  <div className="flex items-center justify-between pt-1">
                    <Badge variant={isLow ? 'destructive' : 'secondary'} className="text-xs">
                      {totalStock} un.
                    </Badge>
                    <div className="flex gap-0.5">
                      {product.listings.map((l) => (
                        <span key={l.id} title={l.store.marketplace} className="text-sm leading-none">
                          {MP_EMOJI[l.store.marketplace] ?? '🏪'}
                        </span>
                      ))}
                      {product.listings.length === 0 && (
                        <span className="text-[10px] text-muted-foreground/50">sem anúncios</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button variant="secondary" size="sm" className="flex-1 h-7 text-xs" asChild>
                      <Link href={`/dashboard/products/${product.id}`}>Editar</Link>
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => { if (confirm('Excluir produto?')) deleteProduct.mutate(product.id) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}

          {(data?.data ?? []).length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-foreground">Nenhum produto cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro produto ou importe uma planilha</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/products/import"><Upload className="h-4 w-4" /> Importar</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/dashboard/products/new"><Plus className="h-4 w-4" /> Criar produto</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
