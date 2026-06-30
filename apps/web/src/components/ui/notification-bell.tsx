'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Bell, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TYPE_ICON, TYPE_COLOR } from '@/lib/notification-constants'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: ['inbox-count'],
    queryFn: async () => (await api.get('/inbox/unread-count')).data,
    refetchInterval: 30_000,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get('/inbox', { params: { limit: 20 } })).data,
    enabled: open,
  })

  const markAll = useMutation({
    mutationFn: async () => api.patch('/inbox/read', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] })
      qc.invalidateQueries({ queryKey: ['inbox-count'] })
    },
  })

  const markOne = useMutation({
    mutationFn: async (id: string) => api.patch('/inbox/read', { ids: [id] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] })
      qc.invalidateQueries({ queryKey: ['inbox-count'] })
    },
  })

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const unread = countData?.count ?? 0
  const notifications = data?.notifications ?? []

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notificações — ${unread} não lida${unread > 1 ? 's' : ''}` : 'Notificações'}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificações"
          className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-card shadow-lg animate-fade-in"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Notificações</p>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
              </div>
            )}

            {notifications.map((n: any) => {
              const Icon = TYPE_ICON[n.type] ?? Info
              const colorCls = TYPE_COLOR[n.type] ?? 'text-muted-foreground bg-muted'
              return (
                <button
                  key={n.id}
                  type="button"
                  className={cn(
                    'w-full text-left flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b last:border-0',
                    !n.isRead && 'bg-primary/5'
                  )}
                  onClick={() => {
                    if (!n.isRead) markOne.mutate(n.id)
                    if (n.link) setOpen(false)
                  }}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', colorCls)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-xs font-medium leading-snug', !n.isRead && 'font-semibold')}>
                        {n.link
                          ? <Link href={n.link} className="hover:text-primary">{n.title}</Link>
                          : n.title}
                      </p>
                      {!n.isRead && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {notifications.length > 0 && (
            <div className="border-t px-4 py-2.5 text-center">
              <Link
                href="/dashboard/notifications"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                Ver todas as notificações
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
