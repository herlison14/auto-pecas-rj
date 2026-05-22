import Link from 'next/link';
import { ArrowRight, Mail, Radar, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* HEADER */}
      <header className="relative border-b border-[var(--color-border-base)] px-8 py-8">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(232,255,71,0.05)] to-transparent pointer-events-none" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl tracking-[4px] text-[var(--color-accent)] glow-accent">
              LEAD <span className="text-[var(--color-orange)]">RADAR</span>
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[2px] text-[var(--color-text-mute)] mt-1">
              Prospecção B2B Multi-Setor · Rio de Janeiro
            </p>
          </div>
          <Link
            href="/login"
            className="font-display text-sm tracking-[2px] px-5 py-2.5 border border-[var(--color-border-strong)] rounded-lg hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition"
          >
            ENTRAR <ArrowRight className="inline ml-1 h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-8 py-24">
        <h2 className="font-display text-6xl md:text-8xl tracking-tight leading-[0.95]">
          ENCONTRE.
          <br />
          QUALIFIQUE.
          <br />
          <span className="text-[var(--color-accent)]">CONTATE.</span>
        </h2>
        <p className="text-lg text-[var(--color-text-dim)] mt-8 max-w-2xl">
          Buscador inteligente de empresas por setor e bairro. Análise de
          atividade com IA, agente de scoring, e envio de email em massa
          conforme LGPD. Para prospecção, portfólio e cases.
        </p>
        <div className="mt-10 flex gap-3 flex-wrap">
          <Link
            href="/registro"
            className="font-display text-lg tracking-[1.5px] px-6 py-3 bg-[var(--color-accent)] text-black rounded-lg hover:bg-[#f5ff80] transition hover:shadow-[0_4px_20px_rgba(232,255,71,0.3)]"
          >
            COMEÇAR AGORA
          </Link>
          <Link
            href="/login"
            className="font-display text-lg tracking-[1.5px] px-6 py-3 border border-[var(--color-border-strong)] rounded-lg hover:border-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)] transition"
          >
            ENTRAR
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-8 pb-24 grid md:grid-cols-3 gap-4">
        <FeatureCard
          icon={<Radar className="h-5 w-5" />}
          title="BUSCA POR SETOR"
          text="140+ categorias do Google Places + custom. Multi-cidade e multi-bairro com filtros profundos."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5" />}
          title="AGENTE DE ATIVIDADE"
          text="Score 0–100 baseado em sinais reais: SSL, reviews recentes, GMB atualizado, WhatsApp ativo."
        />
        <FeatureCard
          icon={<Mail className="h-5 w-5" />}
          title="EMAIL EM MASSA"
          text="Templates, fila com warm-up, tracking de open/click/bounce, unsubscribe LGPD automático."
        />
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-5 hover:border-[var(--color-border-strong)] transition">
      <div className="text-[var(--color-accent)] mb-3">{icon}</div>
      <h3 className="font-display text-lg tracking-[2px] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-text-dim)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
