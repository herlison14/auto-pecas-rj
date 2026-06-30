'use client'

import { useState } from 'react'
import Link from 'next/link'
import { KeyRound, ArrowLeft, MailCheck } from 'lucide-react'
import { api } from '@/lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
    } finally {
      setSent(true)
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
            {sent ? <MailCheck className="h-6 w-6" style={{ color: '#34d399' }} /> : <KeyRound className="h-6 w-6" style={{ color: '#818cf8' }} />}
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {sent ? 'Verifique seu e-mail' : 'Esqueceu a senha?'}
            </h1>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              {sent
                ? 'Se o e-mail existir na nossa base, enviamos um link para redefinir a senha. O link vale por 30 minutos.'
                : 'Informe seu e-mail e enviaremos um link para criar uma nova senha.'}
            </p>
          </div>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" required autoFocus
              className="w-full h-11 rounded-xl px-3.5 text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }}
            />
            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm font-medium mt-5"
          style={{ color: '#818cf8' }}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o login
        </Link>
      </div>
    </div>
  )
}
