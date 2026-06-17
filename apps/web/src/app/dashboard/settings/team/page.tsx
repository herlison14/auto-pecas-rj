'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, AlertCircle, CheckCircle } from 'lucide-react'
import {
  useTeamMembers, useInvitations,
  useInviteMember, useCancelInvitation,
  useUpdateMemberRole, useRemoveMember,
} from '@/hooks/use-team'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Proprietário', ADMIN: 'Administrador', OPERATOR: 'Operador',
}

const ROLE_VARIANT: Record<string, 'secondary' | 'info' | 'warning'> = {
  OWNER: 'warning', ADMIN: 'info', OPERATOR: 'secondary',
}

const selectCls = 'rounded-lg border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function TeamPage() {
  const { data: members, isLoading: loadingMembers } = useTeamMembers()
  const { data: invitations, isLoading: loadingInvitations } = useInvitations()
  const invite = useInviteMember()
  const cancelInvitation = useCancelInvitation()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  const [inviteForm, setInviteForm] = useState({ email: '', role: 'OPERATOR' as 'ADMIN' | 'OPERATOR' })
  const [inviteError, setInviteError] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteUrl('')
    try {
      const res = await invite.mutateAsync(inviteForm)
      setInviteUrl(res.inviteUrl)
      setInviteForm({ email: '', role: 'OPERATOR' })
    } catch (err: any) {
      setInviteError(err?.response?.data?.error ?? 'Erro ao enviar convite')
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-5 p-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/dashboard/settings"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground">Gerencie membros e convites</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm">Membros ativos</CardTitle>
        </CardHeader>
        {loadingMembers ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <div className="overflow-x-auto">
<table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                {['Nome', 'E-mail', 'Perfil', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(members ?? []).filter((m) => m.isActive).map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3">
                    {m.role === 'OWNER' ? (
                      <Badge variant={ROLE_VARIANT[m.role]} className="text-xs">{ROLE_LABEL[m.role]}</Badge>
                    ) : (
                      <select value={m.role} onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })} className={selectCls}>
                        <option value="ADMIN">Administrador</option>
                        <option value="OPERATOR">Operador</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== 'OWNER' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => { if (confirm(`Remover ${m.name} da equipe?`)) removeMember.mutate(m.id) }}>
                        Remover
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
</div>
        )}
      </Card>

      {(invitations ?? []).length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 border-b">
            <CardTitle className="text-sm">Convites pendentes</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
<table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                {['E-mail', 'Perfil', 'Expira em', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invitations ?? []).map((inv) => {
                const expiresIn = Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / 86_400_000)
                return (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{inv.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={ROLE_VARIANT[inv.role] ?? 'secondary'} className="text-xs">{ROLE_LABEL[inv.role]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{expiresIn}d</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => cancelInvitation.mutate(inv.id)}>
                        Cancelar
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
</div>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Convidar membro</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">O convidado receberá um link para criar sua conta. Válido por 7 dias.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleInvite} className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-48 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <Input type="email" required value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="colega@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Perfil</label>
              <select value={inviteForm.role}
                onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'OPERATOR' }))}
                className="flex h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="ADMIN">Administrador</option>
                <option value="OPERATOR">Operador</option>
              </select>
            </div>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Enviando...' : 'Enviar convite'}
            </Button>
          </form>

          {inviteError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {inviteError}
            </div>
          )}

          {inviteUrl && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <CheckCircle className="h-4 w-4" /> Convite criado!
              </div>
              <p className="text-xs text-emerald-600">Compartilhe este link com o convidado:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-card border border-emerald-500/20 px-2 py-1.5 text-xs break-all text-foreground">
                  {inviteUrl}
                </code>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0" onClick={copyUrl}>
                  {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Proprietário:</strong> Acesso total, não pode ser removido.</p>
            <p><strong className="text-foreground">Administrador:</strong> Produtos, pedidos, estoque, integrações e convites.</p>
            <p><strong className="text-foreground">Operador:</strong> Produtos, pedidos e estoque. Não altera integrações ou configurações.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
