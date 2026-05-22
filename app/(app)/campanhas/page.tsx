import { Send } from 'lucide-react';

export default function CampanhasPage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl tracking-[2px] mb-1">CAMPANHAS</h1>
        <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-mute)]">
          Envio de email em massa · Templates · Tracking
        </p>
      </header>
      <div className="border border-dashed border-[var(--color-accent)] rounded-xl p-12 text-center bg-[rgba(232,255,71,0.03)]">
        <Send className="h-10 w-10 text-[var(--color-accent)] mx-auto mb-3" />
        <p className="font-display text-xl tracking-[2px] text-[var(--color-accent)]">
          FASE 2 — EM CONSTRUÇÃO
        </p>
        <p className="text-sm text-[var(--color-text-mute)] mt-2 max-w-md mx-auto">
          Templates de email, fila com warm-up, tracking de open/click/bounce
          e unsubscribe LGPD automático via Resend.
        </p>
      </div>
    </div>
  );
}
