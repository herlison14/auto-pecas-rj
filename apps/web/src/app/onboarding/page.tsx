'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Zap, Check, ArrowRight, Package, Warehouse, Bell,
  ShoppingBag, ExternalLink, SkipForward, Sparkles,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { QueryProvider } from '@/components/ui/query-provider'

// ── Step types ─────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4

const STEPS = [
  { id: 0, label: 'Bem-vindo' },
  { id: 1, label: 'Marketplace' },
  { id: 2, label: 'Estoque' },
  { id: 3, label: 'Fiscal' },
  { id: 4, label: 'Pronto!' },
] as const

const MARKETPLACES = [
  { key: 'MERCADO_LIVRE', name: 'Mercado Livre', emoji: '🟡', color: 'border-yellow-300 hover:bg-yellow-500/10', path: '/dashboard/integrations' },
  { key: 'SHOPEE',        name: 'Shopee',        emoji: '🟠', color: 'border-orange-300 hover:bg-orange-500/10', path: '/dashboard/integrations' },
  { key: 'AMAZON',        name: 'Amazon',        emoji: '🔵', color: 'border-blue-300 hover:bg-blue-500/10',     path: '/dashboard/integrations' },
  { key: 'MAGALU',        name: 'Magalu',        emoji: '🟢', color: 'border-green-300 hover:bg-green-500/10',   path: '/dashboard/integrations' },
  { key: 'AMERICANAS',    name: 'Americanas',    emoji: '🔴', color: 'border-red-300 hover:bg-red-500/10',       path: '/dashboard/integrations' },
  { key: 'SHEIN',         name: 'Shein',         emoji: '⚫', color: 'border-border hover:bg-muted/30',     path: '/dashboard/integrations' },
  { key: 'TIKTOK_SHOP',   name: 'TikTok Shop',   emoji: '🎵', color: 'border-pink-300 hover:bg-pink-500/10', path: '/dashboard/integrations' },
]

// ── Step components ────────────────────────────────────────────────────────────

function StepWelcome({ tenant, onNext }: { tenant: { name: string } | null; onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-lg">
        <Zap className="h-10 w-10 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Bem-vindo ao SellSync{tenant?.name ? `, ${tenant.name}!` : '!'}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed max-w-sm mx-auto">
          Vamos configurar sua conta em menos de 2 minutos para que você possa começar a gerenciar seus marketplaces.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left">
        {[
          { icon: ShoppingBag, title: 'Multi-canal', desc: 'ML, Shopee, Amazon e mais' },
          { icon: Package,     title: 'Estoque',     desc: 'Controle em tempo real' },
          { icon: Warehouse,   title: 'NF-e',        desc: 'Emissão automática' },
          { icon: Bell,        title: 'Alertas',     desc: 'Estoque crítico e pedidos' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3 rounded-xl border p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Button className="w-full" size="lg" onClick={onNext}>
        Começar configuração <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function StepMarketplace({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [selected, setSelected] = useState<string[]>([])
  const router = useRouter()

  const toggle = (k: string) => setSelected((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Quais marketplaces você usa?</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecione os canais onde você vende. Você conectará cada um individualmente depois.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {MARKETPLACES.map((mp) => {
          const isSelected = selected.includes(mp.key)
          return (
            <button
              key={mp.key}
              onClick={() => toggle(mp.key)}
              className={cn(
                'relative flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150',
                isSelected ? 'border-primary bg-primary/5' : `border-border ${mp.color}`,
              )}
            >
              <span className="text-2xl">{mp.emoji}</span>
              <span className="font-semibold text-sm">{mp.name}</span>
              {isSelected && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          onClick={() => {
            if (selected.length > 0) {
              router.push('/dashboard/integrations')
            } else {
              onNext()
            }
          }}
        >
          {selected.length > 0
            ? <><ExternalLink className="h-4 w-4" /> Ir para Integrações</>
            : <><ArrowRight className="h-4 w-4" /> Continuar</>}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSkip}>
          <SkipForward className="h-4 w-4" /> Pular por agora
        </Button>
      </div>
    </div>
  )
}

function StepStock({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [threshold, setThreshold] = useState('5')
  const [warehouseName, setWarehouseName] = useState('Estoque Principal')

  const save = useMutation({
    mutationFn: async () => {
      await api.post('/inventory/warehouses', { name: warehouseName, minStock: Number(threshold) })
    },
    onSuccess: onNext,
    onError: onNext,
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Configure seu estoque</h2>
        <p className="text-sm text-muted-foreground mt-1">Defina seu armazém principal e o limite para alertas de estoque baixo.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nome do armazém principal</label>
          <Input
            value={warehouseName}
            onChange={(e) => setWarehouseName(e.target.value)}
            placeholder="Ex: Estoque Principal, Galpão SP..."
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Você pode adicionar mais armazéns depois</p>
        </div>

        <div>
          <label className="text-sm font-medium">Alerta de estoque mínimo</label>
          <div className="flex items-center gap-3 mt-1.5">
            <Input
              type="number" min={0} max={999} value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">unidades</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Você receberá uma notificação quando o estoque ficar abaixo deste valor
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={() => save.mutate()} disabled={!warehouseName.trim() || save.isPending}>
          {save.isPending ? 'Salvando...' : <><Check className="h-4 w-4" /> Salvar e continuar</>}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSkip}>
          <SkipForward className="h-4 w-4" /> Pular por agora
        </Button>
      </div>
    </div>
  )
}

function StepFiscal({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [form, setForm] = useState({ cnpj: '', ie: '', uf: '', regime: 'SIMPLES' })
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = useMutation({
    mutationFn: async () => api.patch('/nfe/settings', form),
    onSuccess: onNext,
    onError: onNext,
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Dados fiscais (NF-e)</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure os dados para emissão de notas fiscais eletrônicas.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">CNPJ</label>
          <Input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00" className="mt-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Inscrição Estadual</label>
            <Input value={form.ie} onChange={set('ie')} placeholder="000.000.000.000" className="mt-1.5" />
          </div>
          <div>
            <label className="text-sm font-medium">Estado (UF)</label>
            <Input value={form.uf} onChange={set('uf')} placeholder="RJ" maxLength={2} className="mt-1.5" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Regime tributário</label>
          <select
            value={form.regime}
            onChange={set('regime')}
            className="mt-1.5 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="SIMPLES">Simples Nacional</option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            <option value="LUCRO_REAL">Lucro Real</option>
            <option value="MEI">MEI</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Salvando...' : <><Check className="h-4 w-4" /> Salvar e continuar</>}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSkip}>
          <SkipForward className="h-4 w-4" /> Pular por agora
        </Button>
      </div>
    </div>
  )
}

function StepDone({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
        <Sparkles className="h-10 w-10 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold">Tudo pronto!</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed max-w-sm mx-auto">
          Sua conta está configurada. Agora você pode gerenciar todos os seus marketplaces em um só lugar.
        </p>
      </div>
      <div className="rounded-xl border bg-muted/30 p-4 text-left space-y-2">
        {[
          'Dashboard com visão geral do negócio',
          'Gestão de pedidos de todos os canais',
          'Controle de estoque em tempo real',
          'Emissão de NF-e integrada',
          'Relatórios financeiros e de performance',
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-3 w-3 text-emerald-600" />
            </div>
            {item}
          </div>
        ))}
      </div>
      <Button className="w-full" size="lg" onClick={onFinish}>
        Ir para o Dashboard <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

function OnboardingContent() {
  const router = useRouter()
  const { tenant } = useAuth()
  const [step, setStep] = useState<Step>(0)

  useEffect(() => {
    if (tenant?.onboardingCompletedAt) {
      router.replace('/dashboard')
    }
  }, [tenant, router])

  const completeOnboarding = useMutation({
    mutationFn: async () => api.post('/auth/complete-onboarding'),
    onSuccess: () => router.push('/dashboard'),
  })

  const next = () => setStep((s) => Math.min(s + 1, 4) as Step)
  const finish = () => completeOnboarding.mutate()

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Side progress */}
      <div className="hidden lg:flex w-64 shrink-0 flex-col bg-card border-r p-8">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-sm">SellSync</span>
        </div>

        <div className="space-y-1">
          {STEPS.map((s) => (
            <div key={s.id} className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              step === s.id ? 'bg-primary/10 text-primary font-semibold' :
              step > s.id ? 'text-muted-foreground' : 'text-muted-foreground/50',
            )}>
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                step > s.id ? 'bg-emerald-500/10 text-white' :
                step === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground/60',
              )}>
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : s.id + 1}
              </div>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md bg-card rounded-2xl border shadow-card p-8 animate-fade-in">
          {/* Mobile step indicator */}
          <div className="flex items-center gap-1 mb-6 lg:hidden">
            {STEPS.map((s) => (
              <div key={s.id} className={cn(
                'h-1.5 flex-1 rounded-full transition-all',
                step >= s.id ? 'bg-primary' : 'bg-muted',
              )} />
            ))}
          </div>

          {step === 0 && <StepWelcome tenant={tenant} onNext={next} />}
          {step === 1 && <StepMarketplace onNext={next} onSkip={next} />}
          {step === 2 && <StepStock onNext={next} onSkip={next} />}
          {step === 3 && <StepFiscal onNext={next} onSkip={next} />}
          {step === 4 && <StepDone onFinish={finish} />}
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <QueryProvider>
      <OnboardingContent />
    </QueryProvider>
  )
}
