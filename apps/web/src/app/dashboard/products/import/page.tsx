'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

interface PreviewRow {
  sku: string
  name: string
  brand?: string
  ncm?: string
  weight?: number
  stock?: number
  price?: number
}

interface ImportResult {
  created: number
  updated: number
  errors: Array<{ row: number; sku: string; reason: string }>
}

export default function ImportProductsPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError('')
    setPreview(null)

    const fd = new FormData()
    fd.append('file', f)
    try {
      setLoading(true)
      const res = await api.post('/import/products/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(res.data.preview)
      setTotal(res.data.total)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Erro ao ler arquivo')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await api.post('/import/products', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/products" className="text-sm text-muted-foreground/60 hover:text-muted-foreground">← Voltar</Link>
        <h1 className="text-2xl font-bold">Importar Produtos</h1>
      </div>

      {/* Instructions */}
      <div className="rounded-lg border bg-blue-500/10 border-blue-500/20 p-4 text-sm text-blue-400 space-y-2">
        <p className="font-semibold">Como usar:</p>
        <ol className="list-decimal ml-4 space-y-1">
          <li>Baixe o modelo de planilha abaixo</li>
          <li>Preencha com seus produtos (uma linha por produto)</li>
          <li>Faça upload do arquivo CSV ou XLSX</li>
          <li>Revise a pré-visualização e confirme a importação</li>
        </ol>
        <div className="flex gap-4 mt-2">
          <a
            href="/templates/products-template.xlsx"
            download
            className="inline-flex items-center gap-1 text-blue-400 font-semibold hover:underline"
          >
            ↓ Baixar modelo Excel (recomendado)
          </a>
          <a
            href="/templates/products-template.csv"
            download
            className="inline-flex items-center gap-1 text-blue-400/70 hover:underline"
          >
            ↓ Baixar modelo CSV
          </a>
        </div>
      </div>

      {/* Colunas aceitas */}
      <div className="rounded-lg border bg-card p-4 text-sm space-y-2">
        <p className="font-semibold text-foreground">Colunas aceitas (em português ou inglês, com ou sem acentos):</p>
        <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
          {[
            ['SKU', 'obrigatório'],
            ['Nome', 'obrigatório'],
            ['Descrição', 'opcional'],
            ['Marca', 'opcional'],
            ['NCM', 'opcional'],
            ['EAN', 'opcional'],
            ['Peso (kg)', 'aceita vírgula: 1,5'],
            ['Altura (cm)', 'opcional'],
            ['Largura (cm)', 'opcional'],
            ['Comprimento (cm)', 'opcional'],
            ['Imagens', 'URLs separadas por vírgula'],
            ['Estoque', 'quantidade inicial'],
          ].map(([col, note]) => (
            <div key={col} className="flex gap-1">
              <code className="font-mono text-foreground">{col}</code>
              <span className="text-muted-foreground/60">— {note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upload zone */}
      <div
        className="rounded-lg border-2 border-dashed border-border bg-card p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef} type="file" accept=".csv,.xls,.xlsx" className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-3xl mb-2">📂</p>
        <p className="text-sm font-medium text-foreground">
          {file ? file.name : 'Clique ou arraste um arquivo CSV ou XLSX'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">Máximo 2.000 produtos · 10 MB</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/15 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Preview */}
      {preview && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Pré-visualização: <strong>{preview.length}</strong> de <strong>{total}</strong> produtos
              {total > 10 && <span className="text-muted-foreground/60"> (mostrando primeiros 10)</span>}
            </p>
            <button
              onClick={handleImport}
              disabled={loading}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Importando...' : `✓ Confirmar importação (${total} produtos)`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left">
                <tr>
                  {['SKU', 'Nome', 'Marca', 'NCM', 'Peso (kg)', 'Estoque'].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.sku}</td>
                    <td className="px-3 py-2 font-medium max-w-xs truncate">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.brand ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground/60">{row.ncm ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.weight ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.stock ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{result.created}</p>
              <p className="text-sm text-green-600 mt-1">Produtos criados</p>
            </div>
            <div className="rounded-lg border bg-blue-500/10 border-blue-500/20 p-4 text-center">
              <p className="text-3xl font-bold text-blue-400">{result.updated}</p>
              <p className="text-sm text-blue-600 mt-1">Produtos atualizados</p>
            </div>
            <div className={`rounded-lg border p-4 text-center ${result.errors.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-muted/30 border-border'}`}>
              <p className={`text-3xl font-bold ${result.errors.length > 0 ? 'text-red-400' : 'text-muted-foreground/60'}`}>{result.errors.length}</p>
              <p className={`text-sm mt-1 ${result.errors.length > 0 ? 'text-red-600' : 'text-muted-foreground/60'}`}>Erros</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-red-500/10 px-4 py-2 border-b">
                <p className="text-sm font-semibold text-red-400">Linhas com erro</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left border-b">
                  <tr>
                    {['Linha', 'SKU', 'Motivo'].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{e.row}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{e.sku || '—'}</td>
                      <td className="px-3 py-2 text-red-600">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/dashboard/products')}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ver produtos →
            </button>
            <button
              onClick={() => { setFile(null); setPreview(null); setResult(null); setError('') }}
              className="rounded-lg border px-5 py-2 text-sm hover:bg-muted/30"
            >
              Nova importação
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
