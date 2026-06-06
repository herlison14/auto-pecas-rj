'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react'
import { useAuth, setAuthCookie } from '@/lib/auth'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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

  if (tempToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 animate-fade-in-scale">
          <div className="text-center space-y-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto"
              style={{ background: 'linear-gradient(135deg, hsl(var(--gradient-start) / 0.2), hsl(var(--gradient-end) / 0.2))', border: '1px solid hsl(var(--primary) / 0.3)' }}
            >
              <ShieldCheck className="h-7 w-7" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <h1 className="text-xl font-bold">Autenticação em 2 fatores</h1>
            <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu autenticador</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
          <form onSubmit={handleVerify2fa} className="space-y-4">
            <Input
              value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" className="text-center text-2xl tracking-[0.5em] font-mono h-14"
              maxLength={6} autoFocus inputMode="numeric"
            />
            <Button type="submit" className="w-full" disabled={totpCode.length !== 6 || loading}>
              {loading ? 'Verificando...' : 'Verificar'}
            </Button>
          </form>
          <button onClick={() => setTempToken('')} className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Voltar ao login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — gradient branding */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(239 60% 12%), hsl(270 60% 10%))' }}
      >
        {/* Background glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'hsl(var(--primary))' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: 'hsl(var(--gradient-end))' }}
        />

        <div className="relative z-10 max-w-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-2xl">
              <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">SellSync</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-bold leading-tight text-white">
              Gerencie todos os seus marketplaces em um só lugar
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              ML, Shopee, Amazon, Magalu e muito mais. Estoque, pedidos e NF-e centralizados.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { n: '7+', label: 'Marketplaces' },
              { n: '100%', label: 'Automatizado' },
              { n: 'NF-e', label: 'Integrado' },
              { n: 'Real-time', label: 'Sincronização' },
            ].map(({ n, label }) => (
              <div
                key={n}
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <p className="text-lg font-bold text-white">{n}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-7 animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary">
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-foreground">SellSync</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Bem-vindo de volta</h1>
            <p className="text-sm text-muted-foreground">Entre com sua conta para continuar</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">E-mail</label>
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoFocus placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Senha</label>
              <div className="relative">
                <Input
                  type={showPwd ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required placeholder="••••••••" className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className={cn('w-full gap-2', loading && 'opacity-80')}
              disabled={loading}
            >
              {loading ? 'Entrando...' : (
                <>Entrar <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: 'hsl(var(--primary))' }}>
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
