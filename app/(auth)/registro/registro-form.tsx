'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { registroAction } from './actions';

const initialState = { error: null as string | null };

export function RegistroForm() {
  const [state, formAction, pending] = useActionState(registroAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
          Nome
        </label>
        <input
          name="nome"
          type="text"
          required
          minLength={2}
          autoComplete="name"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
          Senha (mínimo 8 caracteres)
        </label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border-strong)] rounded-lg px-3 py-2.5 text-sm focus:border-[var(--color-accent)] focus:outline-none transition"
        />
      </div>

      {state.error ? (
        <div className="text-sm text-[var(--color-red)] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.3)] rounded-lg px-3 py-2">
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full font-display text-lg tracking-[1.5px] bg-[var(--color-accent)] text-black rounded-lg py-3 hover:bg-[#f5ff80] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'CRIANDO...' : 'CRIAR CONTA'}
      </button>
    </form>
  );
}
