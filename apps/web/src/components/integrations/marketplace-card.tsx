'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, KeyRound, Loader2, Plug } from 'lucide-react'
import { api } from '@/lib/api'
import { useDisconnectStore } from '@/hooks/use-stores'

interface MarketplaceInfo {
  id: string
  name: string
  slug: string
  emoji: string
  color: string
}

interface ConnectedStore {
  id: string
  name: string
  isActive: boolean
}

export function MarketplaceCard({ marketplace, connectedStores }: { marketplace: MarketplaceInfo; connectedStores: ConnectedStore[] }) {
  const disconnect = useDisconnectStore()
  const isConnected = connectedStores.some((s) => s.isActive)
  const [connecting, setConnecting] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [notice, setNotice] = useState('')

  async function handleConnect() {
    setConnecting(true)
    setNotice('')
    try {
      const { data } = await api.get(`/integrations/${marketplace.slug}/connect-url`)
      window.location.href = data.url
    } catch (err: any) {
      // OAuth indisponível (não configurado ou em desenvolvimento) → oferece conexão manual
      setNotice(err?.response?.data?.message ?? 'Conexão automática indisponível no momento.')
      setManualOpen(true)
      setConnecting(false)
    }
  }

  return (
    <>
      <div
        className="rounded-xl p-5 flex flex-col gap-4 transition-all hover:-translate-y-0.5"
        style={{
          background: 'rgba(15,15,25,0.9)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xl"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {marketplace.emoji}
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#f1f5f9' }}>{marketplace.name}</h3>
            <span className="text-xs" style={{ color: isConnected ? '#34d399' : '#64748b' }}>
              {isConnected ? `${connectedStores.filter((s) => s.isActive).length} loja(s) conectada(s)` : 'Não conectado'}
            </span>
          </div>
          <div
            className="ml-auto h-2.5 w-2.5 rounded-full"
            style={{ background: isConnected ? '#10b981' : 'rgba(255,255,255,0.15)', boxShadow: isConnected ? '0 0 8px rgba(16,185,129,0.5)' : 'none' }}
          />
        </div>

        {connectedStores.filter((s) => s.isActive).map((store) => (
          <div
            key={store.id}
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{store.name}</span>
            <button
              onClick={() => disconnect.mutate(store.id)}
              disabled={disconnect.isPending}
              className="text-xs disabled:opacity-50 transition-colors"
              style={{ color: '#f87171' }}
            >
              Desconectar
            </button>
          </div>
        ))}

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-auto w-full rounded-lg py-2.5 text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            border: '1px dashed rgba(99,102,241,0.35)',
            color: '#818cf8',
            background: 'rgba(99,102,241,0.06)',
          }}
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Conectar {isConnected ? 'outra loja' : marketplace.name}
        </button>
      </div>

      {manualOpen && (
        <ManualConnectModal
          marketplace={marketplace}
          notice={notice}
          onClose={() => setManualOpen(false)}
        />
      )}
    </>
  )
}

// ── Conexão manual (login de acesso) ───────────────────────────────────────────

function ManualConnectModal({ marketplace, notice, onClose }: {
  marketplace: MarketplaceInfo; notice: string; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', externalId: '', accessToken: '', refreshToken: '' })
  const [error, setError] = useState('')

  const connect = useMutation({
    mutationFn: async () =>
      api.post('/integrations/manual', {
        marketplace: marketplace.id,
        name: form.name,
        externalId: form.externalId,
        accessToken: form.accessToken,
        refreshToken: form.refreshToken || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] })
      onClose()
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erro ao conectar loja')
    },
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const canSubmit = form.name.trim() && form.externalId.trim() && form.accessToken.trim()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 animate-fade-in"
        style={{
          background: 'rgba(15,15,25,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <KeyRound className="h-4 w-4" style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#f1f5f9' }}>Conexão manual — {marketplace.name}</h2>
              <p className="text-xs" style={{ color: '#64748b' }}>Login de acesso com credenciais do marketplace</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#64748b' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {notice && (
          <div
            className="rounded-lg px-3 py-2.5 text-xs mb-4 leading-relaxed"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24' }}
          >
            {notice}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Nome da loja" value={form.name} onChange={set('name')} placeholder="Ex: Minha Loja Oficial" />
          <Field label="ID da loja no marketplace" value={form.externalId} onChange={set('externalId')} placeholder="Ex: 123456789" />
          <Field label="Token de acesso (access token)" value={form.accessToken} onChange={set('accessToken')} placeholder="Gerado no painel de desenvolvedor" type="password" />
          <Field label="Refresh token (opcional)" value={form.refreshToken} onChange={set('refreshToken')} placeholder="Para renovação automática" type="password" />
        </div>

        {error && (
          <div
            className="rounded-lg px-3 py-2 text-xs mt-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
          >
            {error}
          </div>
        )}

        <button
          onClick={() => connect.mutate()}
          disabled={!canSubmit || connect.isPending}
          className="w-full h-10 rounded-xl text-sm font-semibold text-white mt-5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 16px rgba(99,102,241,0.25)' }}
        >
          {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          Conectar loja
        </button>

        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: '#475569' }}>
          O token é gerado no painel de desenvolvedor do {marketplace.name}. Ele fica criptografado e é usado
          apenas para sincronizar pedidos, estoque e anúncios da sua loja.
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: '#94a3b8' }}>{label}</label>
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }}
      />
    </div>
  )
}
