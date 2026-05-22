import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { BuscaClient } from './busca-client';

export default async function BuscaPage() {
  const db = getDb();

  const [setores, cidades, bairros] = await Promise.all([
    db
      .select({
        id: schema.setores.id,
        slug: schema.setores.slug,
        nome: schema.setores.nome,
        categoria: schema.setores.categoria,
        icon: schema.setores.icon,
      })
      .from(schema.setores)
      .where(eq(schema.setores.ativo, true))
      .orderBy(asc(schema.setores.categoria), asc(schema.setores.nome)),
    db
      .select({
        id: schema.cidades.id,
        nome: schema.cidades.nome,
        estado: schema.cidades.estado,
      })
      .from(schema.cidades)
      .orderBy(asc(schema.cidades.nome)),
    db
      .select({
        id: schema.bairros.id,
        cidade_id: schema.bairros.cidadeId,
        nome: schema.bairros.nome,
        zona: schema.bairros.zona,
      })
      .from(schema.bairros)
      .orderBy(asc(schema.bairros.zona), asc(schema.bairros.nome)),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl tracking-[2px] text-[var(--color-text)] mb-1">
          BUSCAR EMPRESAS
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-mute)]">
          Setor + bairro · OpenStreetMap + Claude
        </p>
      </header>

      <BuscaClient setores={setores} cidades={cidades} bairros={bairros} />
    </div>
  );
}
