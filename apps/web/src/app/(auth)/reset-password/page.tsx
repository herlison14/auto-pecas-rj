'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Check, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

function ResetPasswordContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('A senha deve ter no mínimo 8 caracteres')
    if (password !== confirm) return setError('As senhas não coincidem')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao redefinir a senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: '#080810',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%)',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 animate-fade-in"
        style={{
          background: 'rgba(15,15,25,0.9)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            {done ? <Check className="h-6 w-6" style={{ color: '#34d399' }} /> : <Lock className="h-6 w-6" style={{ color: '#818cf8' }} />}
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {done ? 'Senha alterada!' : 'Criar nova senha'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              {done ? 'Redirecionando para o login...' : 'Escolha uma senha forte com no mínimo 8 caracteres.'}
            </p>
          </div>
        </div>

        {!done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha" required autoFocus
              className="w-full h-11 rounded-xl px-3.5 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }}
            />
            <input
              type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha" required
              className="w-full h-11 rounded-xl px-3.5 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }}
            />
            <button
              type="submit" disabled={loading || !token}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
            >
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
            {!token && (
              <p className="text-center text-xs" style={{ color: '#f87171' }}>
                Link inválido. <Link href="/forgot-password" className="underline">Solicite um novo</Link>.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  )
}
