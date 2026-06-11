'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, ShieldCheck, ArrowRight, Zap } from 'lucide-react'
import { useAuth, setAuthCookie } from '@/lib/auth'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const { login } = useAuth()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result?.requires2fa && result.tempToken) {
        setTempToken(result.tempToken)
      } else {
        router.push('/dashboard')
      }
    } catch {
      setError('E-mail ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/2fa/verify', { token: totpCode, tempToken })
      localStorage.setItem('sellsync:token', data.token)
      setAuthCookie(data.token)
      router.push('/dashboard')
    } catch {
      setError('Código incorreto. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  /* ── 2FA screen ──────────────────────────────────────────────────────────── */
  if (tempToken) {
    return (
      <Page>
        <Card>
          <div className="flex flex-col items-center gap-3 mb-8">
            <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl">
              <ShieldCheck className="h-7 w-7" style={{ color: '#818cf8' }} />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-white">Verificação em 2 etapas</h1>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                Digite o código de 6 dígitos do seu autenticador
              </p>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <form onSubmit={handleVerify2fa} className="space-y-4">
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000 000"
              maxLength={6}
              autoFocus
              inputMode="numeric"
              className="w-full text-center text-2xl tracking-[0.4em] font-mono h-14 rounded-xl px-4 outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#f1f5f9',
              }}
              onFocus={(e) => { e.target.style.border = '1px solid rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
              onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
            />
            <PrimaryButton disabled={totpCode.length !== 6 || loading}>
              {loading ? 'Verificando...' : 'Verificar código'}
            </PrimaryButton>
          </form>

          <button
            onClick={() => setTempToken('')}
            className="w-full text-center text-sm mt-4 transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#94a3b8' }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#64748b' }}
          >
            ← Voltar ao login
          </button>
        </Card>
      </Page>
    )
  }

  /* ── Login screen ────────────────────────────────────────────────────────── */
  return (
    <Page>
      <Card>
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}
          >
            <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h1>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>Entre na sua conta SellSync</p>
          </div>
        </div>

        {error && <ErrorBox message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="E-mail">
            <TextInput
              type="email"
              value={email}
              onChange={(v) => setEmail(v)}
              placeholder="seu@email.com"
              autoFocus
              required
            />
          </Field>

          <Field label="Senha">
            <div className="relative">
              <TextInput
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(v) => setPassword(v)}
                placeholder="••••••••"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#475569' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#94a3b8' }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#475569' }}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="flex justify-end -mt-1">
            <Link href="/forgot-password" className="text-xs font-medium" style={{ color: '#64748b' }}>
              Esqueci minha senha
            </Link>
          </div>

          <PrimaryButton disabled={loading} className="mt-2">
            {loading
              ? <span className="flex items-center gap-2 justify-center"><Spinner />Entrando...</span>
              : <span className="flex items-center gap-2 justify-center">Entrar <ArrowRight className="h-4 w-4" /></span>
            }
          </PrimaryButton>
        </form>

        <Divider />

        <p className="text-center text-sm" style={{ color: '#475569' }}>
          Não tem conta?{' '}
          <Link href="/register" className="font-semibold transition-colors" style={{ color: '#818cf8' }}
            onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#a5b4fc' }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#818cf8' }}
          >
            Criar conta grátis
          </Link>
        </p>
      </Card>

      {/* Footer branding */}
      <p className="mt-6 text-center text-xs" style={{ color: '#1e293b' }}>
        ML · Shopee · Amazon · Magalu · Americanas
      </p>
    </Page>
  )
}

/* ── Shared sub-components ──────────────────────────────────────────────────── */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: '#080810',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 50%)
        `,
      }}
    >
      {children}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-sm rounded-2xl p-8 animate-fade-in"
      style={{
        background: 'rgba(15, 15, 25, 0.9)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
        backdropFilter: 'blur(20px)',
      }}
    >
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-widest" style={{ color: '#475569' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({ type, value, onChange, placeholder, autoFocus, required, className }: {
  type: string; value: string; onChange: (v: string) => void
  placeholder?: string; autoFocus?: boolean; required?: boolean; className?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      required={required}
      className={cn('w-full h-11 rounded-xl px-3.5 text-sm outline-none transition-all', className)}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#f1f5f9',
      }}
      onFocus={(e) => {
        e.target.style.border = '1px solid rgba(99,102,241,0.5)'
        e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'
        e.target.style.background = 'rgba(255,255,255,0.06)'
      }}
      onBlur={(e) => {
        e.target.style.border = '1px solid rgba(255,255,255,0.08)'
        e.target.style.boxShadow = 'none'
        e.target.style.background = 'rgba(255,255,255,0.04)'
      }}
    />
  )
}

function PrimaryButton({ children, disabled, className }: {
  children: React.ReactNode; disabled?: boolean; className?: string
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={cn('w-full h-11 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed', className)}
      style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        boxShadow: '0 0 20px rgba(99,102,241,0.3)',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {children}
    </button>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm mb-4"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
    >
      <AlertCircle className="h-4 w-4 shrink-0" /> {message}
    </div>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <span className="text-xs" style={{ color: '#1e293b' }}>ou</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
