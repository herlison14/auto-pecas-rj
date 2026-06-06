'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Check, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const STEPS = ['Empresa', 'Sua conta', 'Pronto!'] as const

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ tenantName: '', name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  function setField(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (step === 0) {
      if (!form.tenantName.trim()) return setError('Informe o nome da empresa')
      return setStep(1)
    }
    if (step === 1) {
      if (!form.name.trim()) return setError('Informe seu nome')
      if (!form.email.trim()) return setError('Informe seu e-mail')
      if (form.password.length < 8) return setError('A senha deve ter no mínimo 8 caracteres')
      if (form.password !== form.confirmPassword) return setError('As senhas não coincidem')
      setLoading(true)
      try {
        await register(form.tenantName, form.name, form.email, form.password)
        setStep(2)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao criar conta')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-7 animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-2xl">
            <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Criar conta grátis</h1>
            <p className="text-sm text-muted-foreground">Comece a gerenciar seus marketplaces hoje</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center">
          {STEPS.map((label, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                  i < step
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : i === step
                    ? 'text-white shadow-lg'
                    : 'bg-muted text-muted-foreground'
                )}
                style={i === step ? { background: 'linear-gradient(135deg, hsl(var(--gradient-start)), hsl(var(--gradient-end)))', boxShadow: '0 0 12px hsl(var(--primary) / 0.4)' } : undefined}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn('text-[11px] font-medium whitespace-nowrap', i === step ? 'text-foreground' : 'text-muted-foreground')}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-3 mb-5 transition-all duration-300"
                  style={{ background: i < step ? 'hsl(142 71% 45%)' : 'hsl(var(--border))' }}
                />
              )}
            </div>
          ))}
        </div>

        {step < 2 ? (
          <form
            onSubmit={handleNext}
            className="rounded-2xl p-6 space-y-5"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          >
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {step === 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground/80">Nome da empresa / loja</label>
                <Input value={form.tenantName} onChange={(e) => setField('tenantName', e.target.value)}
                  required autoFocus placeholder="Ex: Minha Loja Online" />
                <p className="text-xs text-muted-foreground">Pode ser alterado depois nas configurações</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Seu nome</label>
                  <Input value={form.name} onChange={(e) => setField('name', e.target.value)} required autoFocus placeholder="João Silva" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">E-mail</label>
                  <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required placeholder="joao@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Senha</label>
                  <Input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} required placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Confirmar senha</label>
                  <Input type="password" value={form.confirmPassword} onChange={(e) => setField('confirmPassword', e.target.value)} required placeholder="••••••••" />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? 'Criando conta...' : step === 0 ? (
                <>Continuar <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Criar conta grátis <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>
        ) : (
          <div
            className="rounded-2xl p-8 text-center space-y-5"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'hsl(142 71% 45% / 0.15)', border: '1px solid hsl(142 71% 45% / 0.3)' }}
            >
              <Check className="h-8 w-8" style={{ color: 'hsl(142 71% 45%)' }} strokeWidth={2.5} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Conta criada com sucesso!</h2>
              <p className="text-sm text-muted-foreground">Agora conecte seus marketplaces e comece a vender.</p>
            </div>
            <Button className="w-full gap-2" onClick={() => router.push('/onboarding')}>
              Configurar minha conta <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step < 2 && (
          <p className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: 'hsl(var(--primary))' }}>
              Entrar
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
