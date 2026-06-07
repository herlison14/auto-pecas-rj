'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, AlertCircle, ArrowRight, Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth'

const STEPS = ['Empresa', 'Sua conta', 'Pronto!'] as const

export default function RegisterPage() {
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({ tenantName: '', name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const { register }        = useAuth()
  const router              = useRouter()

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
      if (!form.name.trim())                           return setError('Informe seu nome')
      if (!form.email.trim())                          return setError('Informe seu e-mail')
      if (form.password.length < 8)                   return setError('Senha deve ter no mínimo 8 caracteres')
      if (form.password !== form.confirmPassword)     return setError('As senhas não coincidem')
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
      <div
        className="w-full max-w-md rounded-2xl p-8 animate-fade-in"
        style={{
          background: 'rgba(15,15,25,0.9)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-7">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 24px rgba(99,102,241,0.4)' }}
          >
            <Zap className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white tracking-tight">Criar conta grátis</h1>
            <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>Comece a gerenciar seus marketplaces</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-7">
          {STEPS.map((label, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300"
                  style={
                    i < step
                      ? { background: '#10b981', color: '#fff' }
                      : i === step
                      ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 0 12px rgba(99,102,241,0.4)' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#475569', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className="text-[10px] font-medium whitespace-nowrap"
                  style={{ color: i === step ? '#e2e8f0' : '#334155' }}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 mb-4 transition-all duration-300"
                  style={{ background: i < step ? '#10b981' : 'rgba(255,255,255,0.06)' }}
                />
              )}
            </div>
          ))}
        </div>

        {step < 2 ? (
          <form onSubmit={handleNext} className="space-y-4">
            {error && (
              <div
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {step === 0 && (
              <FormField label="Nome da empresa / loja">
                <Input
                  type="text" value={form.tenantName}
                  onChange={(v) => setField('tenantName', v)}
                  placeholder="Ex: Minha Loja Online" autoFocus required
                />
                <p className="text-xs mt-1" style={{ color: '#334155' }}>Pode ser alterado depois nas configurações</p>
              </FormField>
            )}

            {step === 1 && (
              <>
                <FormField label="Seu nome">
                  <Input type="text" value={form.name} onChange={(v) => setField('name', v)} placeholder="João Silva" autoFocus required />
                </FormField>
                <FormField label="E-mail">
                  <Input type="email" value={form.email} onChange={(v) => setField('email', v)} placeholder="joao@empresa.com" required />
                </FormField>
                <FormField label="Senha">
                  <Input type="password" value={form.password} onChange={(v) => setField('password', v)} placeholder="Mínimo 8 caracteres" required />
                </FormField>
                <FormField label="Confirmar senha">
                  <Input type="password" value={form.confirmPassword} onChange={(v) => setField('confirmPassword', v)} placeholder="••••••••" required />
                </FormField>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
            >
              {loading ? 'Criando conta...' : step === 0 ? (<>Continuar <ArrowRight className="h-4 w-4" /></>) : (<>Criar conta grátis <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-5">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
            >
              <Check className="h-8 w-8" style={{ color: '#34d399' }} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Conta criada!</h2>
              <p className="text-sm mt-1" style={{ color: '#64748b' }}>Agora conecte seus marketplaces e comece a vender.</p>
            </div>
            <button
              onClick={() => router.push('/onboarding')}
              className="w-full h-11 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}
            >
              Configurar minha conta <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step < 2 && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-xs" style={{ color: '#1e293b' }}>ou</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
            <p className="text-center text-sm" style={{ color: '#475569' }}>
              Já tem conta?{' '}
              <Link href="/login" className="font-semibold" style={{ color: '#818cf8' }}>
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-widest" style={{ color: '#475569' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Input({ type, value, onChange, placeholder, autoFocus, required }: {
  type: string; value: string; onChange: (v: string) => void
  placeholder?: string; autoFocus?: boolean; required?: boolean
}) {
  return (
    <input
      type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} autoFocus={autoFocus} required={required}
      className="w-full h-11 rounded-xl px-3.5 text-sm outline-none transition-all"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9' }}
      onFocus={(e) => { e.target.style.border = '1px solid rgba(99,102,241,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
      onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
    />
  )
}
