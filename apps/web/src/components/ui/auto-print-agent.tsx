'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { api } from '@/lib/api'

interface PrintQueueItem {
  id: string
  externalId: string
  buyerName: string | null
  total: string
  marketplace: string
}

/**
 * Agente de impressão automática de DANFE.
 *
 * Consulta a fila de NF-es autorizadas e ainda não impressas e dispara a
 * impressão via diálogo do sistema operacional — funciona com qualquer
 * impressora instalada (térmica, jato de tinta, laser), pois quem fala com
 * o hardware é o driver da impressora no Windows/Mac/Linux.
 */
export function AutoPrintAgent() {
  const printedRef = useRef<Set<string>>(new Set())
  const printingRef = useRef(false)
  const [current, setCurrent] = useState<PrintQueueItem | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['nfe-settings'],
    queryFn: async () => (await api.get('/nfe/settings')).data,
    staleTime: 5 * 60_000,
  })

  const autoPrintEnabled = settings?.autoPrint !== false && !!settings?.cnpj

  const { data: queue } = useQuery({
    queryKey: ['nfe-print-queue'],
    queryFn: async () => (await api.get('/nfe/print-queue')).data as PrintQueueItem[],
    refetchInterval: 30_000,
    enabled: autoPrintEnabled,
  })

  useEffect(() => {
    if (!autoPrintEnabled || !queue?.length || printingRef.current) return
    const next = queue.find((o) => !printedRef.current.has(o.id))
    if (!next) return

    printingRef.current = true
    printedRef.current.add(next.id)
    setCurrent(next)

    printDanfe(next.id)
      .then(() => api.post(`/nfe/orders/${next.id}/printed`))
      .catch(() => { /* tenta de novo no próximo ciclo */ printedRef.current.delete(next.id) })
      .finally(() => {
        printingRef.current = false
        setCurrent(null)
      })
  }, [queue, autoPrintEnabled])

  if (!current) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 animate-fade-in"
      style={{
        background: 'rgba(15,15,25,0.97)',
        border: '1px solid rgba(99,102,241,0.3)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(99,102,241,0.15)',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ background: 'rgba(99,102,241,0.15)' }}
      >
        <Printer className="h-4 w-4 animate-pulse" style={{ color: '#818cf8' }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Imprimindo DANFE</p>
        <p className="text-xs" style={{ color: '#64748b' }}>Pedido #{current.externalId}</p>
      </div>
      <button onClick={() => setCurrent(null)} style={{ color: '#475569' }}>
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Baixa o PDF da DANFE autenticado e abre o diálogo de impressão do sistema. */
export async function printDanfe(orderId: string): Promise<void> {
  return printPdfFromApi(`/nfe/orders/${orderId}/pdf`)
}

/** Baixa a etiqueta de envio do pedido e abre o diálogo de impressão. */
export async function printShippingLabel(orderId: string): Promise<void> {
  return printPdfFromApi(`/orders/${orderId}/label`)
}

/** Busca um PDF autenticado na API e abre o diálogo de impressão do sistema. */
export async function printPdfFromApi(path: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))

  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '-10000px'
    iframe.src = url
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        resolve()
      } catch (e) {
        reject(e)
      } finally {
        // Mantém o iframe vivo por um tempo para o diálogo de impressão usar o PDF
        setTimeout(() => {
          URL.revokeObjectURL(url)
          iframe.remove()
        }, 60_000)
      }
    }
    iframe.onerror = () => reject(new Error('Falha ao carregar PDF'))
    document.body.appendChild(iframe)
  })
}
