import { Suspense } from 'react';
import { RegistroForm } from './registro-form';

export default function RegistroPage() {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-8">
      <h2 className="font-display text-2xl tracking-[2px] mb-1">CRIAR CONTA</h2>
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] mb-6">
        Comece a prospectar agora
      </p>
      <Suspense fallback={null}>
        <RegistroForm />
      </Suspense>
      <p className="text-sm text-[var(--color-text-dim)] mt-6 text-center">
        Já tem conta?{' '}
        <a
          href="/login"
          className="text-[var(--color-accent)] hover:underline"
        >
          Entrar
        </a>
      </p>
    </div>
  );
}
