'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, Zap } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hydrate } = useAuth()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState({ name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('As senhas não conferem')
    if (form.password.length < 8) return setError('Senha deve ter no mínimo 8 caracteres')
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/team/invitations/accept', {
        token,
        name: form.name.trim(),
        password: form.password,
      })
      localStorage.setItem('sellsync:token', res.data.token)
      useAuth.setState({ token: res.data.token, user: res.data.user, isAuthenticated: true })
      await hydrate()
      router.replace('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Convite inválido ou expirado')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="rounded-2xl border bg-card shadow-sm p-8 text-center max-w-sm w-full mx-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este link de convite é inválido ou expirou.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="rounded-2xl border bg-card shadow-sm p-8 max-w-md w-full mx-4 space-y-6 animate-fade-in">
        <div className="text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Você foi convidado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Crie sua conta para acessar o SellSync.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Seu nome completo</label>
            <Input type="text" required value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="João da Silva" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Criar senha</label>
            <Input type="password" required value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Confirmar senha</label>
            <Input type="password" required value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              placeholder="Repita a senha" />
          </div>
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? 'Criando conta...' : 'Criar conta e entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteContent />
    </Suspense>
  )
}
