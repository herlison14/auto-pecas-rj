'use client'

import { useState } from 'react'
import { useAdjustStock } from '@/hooks/use-inventory'

interface StockItem {
  id: string
  quantity: number
  reserved: number
  minAlert: number
  product: { id: string; sku: string; name: string; images: string[] }
  warehouse: { id: string; name: string }
}

export function StockTable({ items, isLoading }: { items: StockItem[]; isLoading: boolean }) {
  const [adjusting, setAdjusting] = useState<{ itemId: string; productId: string; warehouseId: string } | null>(null)
  const [qty, setQty] = useState('')
  const adjust = useAdjustStock()

  if (isLoading) return <div className="p-8 text-center text-gray-400 animate-pulse">Carregando estoque...</div>

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="overflow-x-auto">
<table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="p-3 text-left">Produto</th>
            <th className="p-3 text-left">SKU</th>
            <th className="p-3 text-left">Armazém</th>
            <th className="p-3 text-right">Disponível</th>
            <th className="p-3 text-right">Reservado</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3 text-center">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.length === 0 && (
            <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum item no estoque</td></tr>
          )}
          {items.map((item) => {
            const available = item.quantity - item.reserved
            const isLow = available <= item.minAlert
            const isOut = item.quantity === 0
            return (
              <tr key={item.id} className={`hover:bg-gray-50 ${isOut ? 'bg-red-50' : isLow ? 'bg-yellow-50' : ''}`}>
                <td className="p-3 font-medium">
                  <div className="flex items-center gap-2">
                    {item.product.images[0] && (
                      <img src={item.product.images[0]} alt="" className="h-8 w-8 rounded object-cover" />
                    )}
                    <span className="line-clamp-1">{item.product.name}</span>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs text-gray-500">{item.product.sku}</td>
                <td className="p-3 text-gray-600">{item.warehouse.name}</td>
                <td className={`p-3 text-right font-bold ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {available}
                </td>
                <td className="p-3 text-right text-gray-500">{item.reserved}</td>
                <td className="p-3 text-right text-gray-700">{item.quantity}</td>
                <td className="p-3 text-center">
                  {adjusting?.itemId === item.id ? (
                    <div className="flex items-center gap-1 justify-center">
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        className="w-20 rounded border px-2 py-1 text-sm text-center"
                        placeholder="±qtd"
                        autoFocus
                      />
                      <button
                        onClick={async () => {
                          await adjust.mutateAsync({ productId: item.product.id, warehouseId: item.warehouse.id, quantity: Number(qty) })
                          setAdjusting(null)
                          setQty('')
                        }}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        OK
                      </button>
                      <button onClick={() => setAdjusting(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdjusting({ itemId: item.id, productId: item.product.id, warehouseId: item.warehouse.id })}
                      className="rounded border px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Ajustar
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
</div>
    </div>
  )
}
