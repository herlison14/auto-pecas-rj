import { LoginForm } from './login-form';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-8">
      <h2 className="font-display text-2xl tracking-[2px] mb-1">ENTRAR</h2>
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] mb-6">
        Acesse sua conta
      </p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-[var(--color-text-dim)] mt-6 text-center">
        Sem conta?{' '}
        <a
          href="/registro"
          className="text-[var(--color-accent)] hover:underline"
        >
          Criar agora
        </a>
      </p>
    </div>
  );
}
