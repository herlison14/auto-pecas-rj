import Link from 'next/link';
import { eq, desc, count, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb, schema } from '@/lib/db';
import { Search, Building2, Mail, TrendingUp } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const db = getDb();

  const [
    totalEmpresasRes,
    totalContatadasRes,
    totalConvertidasRes,
    ultimasBuscas,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.empresas)
      .where(eq(schema.empresas.ownerId, userId)),
    db
      .select({ value: count() })
      .from(schema.empresas)
      .where(
        and(
          eq(schema.empresas.ownerId, userId),
          eq(schema.empresas.statusProspect, 'contatado'),
        ),
      ),
    db
      .select({ value: count() })
      .from(schema.empresas)
      .where(
        and(
          eq(schema.empresas.ownerId, userId),
          eq(schema.empresas.statusProspect, 'convertido'),
        ),
      ),
    db
      .select()
      .from(schema.buscas)
      .where(eq(schema.buscas.ownerId, userId))
      .orderBy(desc(schema.buscas.createdAt))
      .limit(5),
  ]);

  const totalEmpresas = totalEmpresasRes[0]?.value ?? 0;
  const totalContatadas = totalContatadasRes[0]?.value ?? 0;
  const totalConvertidas = totalConvertidasRes[0]?.value ?? 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-[2px] text-[var(--color-text)] mb-1">
          DASHBOARD
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-mute)]">
          Visão geral da sua prospecção
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <KpiCard
          icon={<Building2 className="h-5 w-5" />}
          label="EMPRESAS NO RADAR"
          value={totalEmpresas}
          color="accent"
        />
        <KpiCard
          icon={<Mail className="h-5 w-5" />}
          label="CONTATADAS"
          value={totalContatadas}
          color="blue"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="CONVERTIDAS"
          value={totalConvertidas}
          color="green"
        />
      </div>

      <Link
        href="/busca"
        className="block bg-gradient-to-br from-[rgba(232,255,71,0.1)] to-[rgba(232,255,71,0.02)] border border-[var(--color-accent)] rounded-xl p-6 mb-8 hover:shadow-[0_4px_24px_rgba(232,255,71,0.15)] transition group"
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-[var(--color-accent)] text-black flex items-center justify-center">
            <Search className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl tracking-[2px]">NOVA BUSCA</h2>
            <p className="text-sm text-[var(--color-text-dim)] mt-1">
              Encontre empresas por setor + bairro em segundos
            </p>
          </div>
          <span className="font-mono text-xs text-[var(--color-accent)] group-hover:translate-x-1 transition">
            COMEÇAR →
          </span>
        </div>
      </Link>

      <section>
        <h2 className="font-display text-lg tracking-[2px] mb-4">
          ÚLTIMAS BUSCAS
        </h2>
        {ultimasBuscas.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border-strong)] rounded-xl p-12 text-center">
            <p className="text-sm text-[var(--color-text-mute)]">
              Nenhuma busca ainda. Comece por uma nova busca acima.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ultimasBuscas.map((b) => (
              <div
                key={b.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm">
                    {b.queryCustom ?? '(busca por setor)'}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--color-text-mute)] mt-0.5">
                    {new Date(b.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="font-mono text-xs text-[var(--color-accent)]">
                  {b.totalResultados} resultados
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'accent' | 'blue' | 'green';
}) {
  const colorMap = {
    accent: 'text-[var(--color-accent)]',
    blue: 'text-[var(--color-blue)]',
    green: 'text-[var(--color-green)]',
  };
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-5">
      <div className={`mb-3 ${colorMap[color]}`}>{icon}</div>
      <div className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] mb-1">
        {label}
      </div>
      <div className="font-display text-4xl tracking-[1px]">
        {value.toLocaleString('pt-BR')}
      </div>
    </div>
  );
}
