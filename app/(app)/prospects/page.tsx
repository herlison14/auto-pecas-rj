import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb, schema } from '@/lib/db';

export default async function ProspectsPage() {
  const session = await auth();
  const db = getDb();

  const empresas = await db
    .select({
      id: schema.empresas.id,
      nome: schema.empresas.nome,
      statusProspect: schema.empresas.statusProspect,
      scoreAtividade: schema.empresas.scoreAtividade,
      emails: schema.empresas.emails,
      telefone: schema.empresas.telefone,
      website: schema.empresas.website,
      createdAt: schema.empresas.createdAt,
    })
    .from(schema.empresas)
    .where(eq(schema.empresas.ownerId, session!.user.id))
    .orderBy(desc(schema.empresas.createdAt))
    .limit(50);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl tracking-[2px] mb-1">PROSPECTS</h1>
        <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-mute)]">
          Empresas no seu radar
        </p>
      </header>

      {empresas.length === 0 ? (
        <div className="border border-dashed border-[var(--color-border-strong)] rounded-xl p-12 text-center">
          <p className="text-sm text-[var(--color-text-mute)]">
            Nenhum prospect ainda. Use{' '}
            <a href="/busca" className="text-[var(--color-accent)] hover:underline">
              Buscar
            </a>{' '}
            pra encontrar empresas.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border-base)]">
              <tr>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)]">
                  Empresa
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)]">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)]">
                  Score
                </th>
                <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[1px] text-[var(--color-text-mute)]">
                  Contato
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-base)]">
              {empresas.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-surface-2)]">
                  <td className="px-4 py-3">{e.nome}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-[1px] px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-dim)]">
                      {e.statusProspect}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {e.scoreAtividade ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-dim)]">
                    {e.emails.length > 0
                      ? e.emails[0]
                      : e.telefone || e.website || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
