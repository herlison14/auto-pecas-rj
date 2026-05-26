'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb, schema } from '@/lib/db';
import { batchSearchOSM, nominatimGeocode } from '@/lib/openstreetmap';
import { batchSearchGooglePlaces } from '@/lib/google-places';
import { extractEmailsFromSite } from '@/lib/claude';

const BuscaSchema = z.object({
  setorId: z.string().uuid(),
  cidadeId: z.string().uuid(),
  bairrosIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos um bairro'),
});

export type ResultadoBusca = {
  empresaId: string;
  placeId: string;
  nome: string;
  endereco: string;
  telefone: string | null;
  website: string | null;
  rating: number | null;
  totalReviews: number | null;
  googleMapsUrl: string | null;
  abertoAgora: boolean | null;
  bairro: string;
  emails: string[];
};

/**
 * Server Action: roda a busca via OpenStreetMap, persiste empresas e retorna pra UI.
 * Sem RLS — owner_id é checado manualmente.
 */
export async function executarBusca(input: z.infer<typeof BuscaSchema>) {
  const parsed = BuscaSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      erro: parsed.error.issues[0]?.message ?? 'Input inválido',
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, erro: 'Não autenticado' };
  }
  const userId = session.user.id;
  const db = getDb();

  const [setorList, cidadeList, bairrosList] = await Promise.all([
    db
      .select()
      .from(schema.setores)
      .where(eq(schema.setores.id, parsed.data.setorId))
      .limit(1),
    db
      .select()
      .from(schema.cidades)
      .where(eq(schema.cidades.id, parsed.data.cidadeId))
      .limit(1),
    db
      .select()
      .from(schema.bairros)
      .where(inArray(schema.bairros.id, parsed.data.bairrosIds)),
  ]);

  const setor = setorList[0];
  const cidade = cidadeList[0];
  const bairros = bairrosList;

  if (!setor) return { ok: false as const, erro: 'Setor inválido' };
  if (!cidade) return { ok: false as const, erro: 'Cidade inválida' };
  if (bairros.length === 0)
    return { ok: false as const, erro: 'Bairros inválidos' };

  // ───── Busca: Google Places (quando disponível) ou OSM ─────
  const useGoogle = !!process.env.GOOGLE_PLACES_API_KEY;

  type PlaceRow = {
    ownerId: string;
    placeId: string;
    nome: string;
    setorId: string;
    cidadeId: string;
    bairroId: string;
    endereco: string;
    telefone: string | null;
    website: string | null;
    rating: string | null;
    userRatingsTotal: number | null;
    googleMapsUrl: string | null;
    abertoAgora: boolean | null;
    emails: string[];
  };

  let rows: PlaceRow[];

  if (useGoogle) {
    // Geocoda a primeira cidade (centroide) para usar como âncora de proximidade
    const coords = await nominatimGeocode(bairros[0].nome, cidade.nome, cidade.estado);
    const lat = coords?.lat ?? -22.9068;
    const lon = coords?.lon ?? -43.1729;

    let googleResults: Awaited<ReturnType<typeof batchSearchGooglePlaces>>;
    try {
      googleResults = await batchSearchGooglePlaces(
        setor.queryTemplate,
        lat,
        lon,
        bairros.map((b) => ({ id: b.id, nome: b.nome })),
        cidade.nome,
        { radiusMeters: 1500, maxPerBairro: 20 },
      );
    } catch (err) {
      return {
        ok: false as const,
        erro:
          err instanceof Error
            ? `Google Places: ${err.message}`
            : 'Erro ao consultar Google Places',
      };
    }

    if (googleResults.length === 0) {
      await db.insert(schema.buscas).values({
        ownerId: userId,
        setorId: setor.id,
        cidadeId: cidade.id,
        bairrosIds: bairros.map((b) => b.id),
        totalResultados: 0,
      });
      return { ok: true as const, resultados: [], totalEncontrado: 0 };
    }

    rows = googleResults.map((r) => ({
      ownerId: userId,
      placeId: r.placeId,
      nome: r.nome,
      setorId: setor.id,
      cidadeId: cidade.id,
      bairroId: r.bairroId,
      endereco: r.endereco || `${r.bairroNome}, ${cidade.nome}`,
      telefone: r.telefone,
      website: r.website,
      rating: r.rating != null ? String(r.rating) : null,
      userRatingsTotal: r.totalReviews,
      googleMapsUrl: r.googleMapsUrl,
      abertoAgora: r.abertoAgora,
      emails: [],
    }));
  } else {
    // Fallback: OpenStreetMap
    let osmResults: Awaited<ReturnType<typeof batchSearchOSM>>;
    try {
      osmResults = await batchSearchOSM(
        setor.osmFilter,
        bairros.map((b) => ({ id: b.id, nome: b.nome })),
        cidade.nome,
        cidade.estado,
        { radiusMeters: 1500, maxPerBairro: 30 },
      );
    } catch (err) {
      return {
        ok: false as const,
        erro:
          err instanceof Error
            ? `OpenStreetMap: ${err.message}`
            : 'Erro ao consultar OpenStreetMap',
      };
    }

    if (osmResults.length === 0) {
      await db.insert(schema.buscas).values({
        ownerId: userId,
        setorId: setor.id,
        cidadeId: cidade.id,
        bairrosIds: bairros.map((b) => b.id),
        totalResultados: 0,
      });
      return { ok: true as const, resultados: [], totalEncontrado: 0 };
    }

    rows = osmResults.map((r) => ({
      ownerId: userId,
      placeId: r.osmId,
      nome: r.nome,
      setorId: setor.id,
      cidadeId: cidade.id,
      bairroId: r.bairroId,
      endereco: r.endereco || `${r.bairroNome}, ${cidade.nome}`,
      telefone: r.telefone,
      website: r.website,
      rating: null,
      userRatingsTotal: null,
      googleMapsUrl: `https://www.google.com/maps?q=${r.lat},${r.lon}`,
      abertoAgora: null,
      emails: r.email ? [r.email] : [],
    }));
  }

  const empresasInseridas = await db
    .insert(schema.empresas)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.empresas.ownerId, schema.empresas.placeId],
      set: {
        nome: sql`excluded.nome`,
        endereco: sql`excluded.endereco`,
        telefone: sql`excluded.telefone`,
        website: sql`excluded.website`,
        googleMapsUrl: sql`excluded.google_maps_url`,
        bairroId: sql`excluded.bairro_id`,
        cidadeId: sql`excluded.cidade_id`,
        setorId: sql`excluded.setor_id`,
        emails: sql`
          case
            when array_length(excluded.emails, 1) > 0 then excluded.emails
            else ${schema.empresas.emails}
          end
        `,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: schema.empresas.id,
      placeId: schema.empresas.placeId,
      nome: schema.empresas.nome,
      endereco: schema.empresas.endereco,
      telefone: schema.empresas.telefone,
      website: schema.empresas.website,
      rating: schema.empresas.rating,
      userRatingsTotal: schema.empresas.userRatingsTotal,
      googleMapsUrl: schema.empresas.googleMapsUrl,
      abertoAgora: schema.empresas.abertoAgora,
      emails: schema.empresas.emails,
      bairroId: schema.empresas.bairroId,
    });

  await db.insert(schema.buscas).values({
    ownerId: userId,
    setorId: setor.id,
    cidadeId: cidade.id,
    bairrosIds: bairros.map((b) => b.id),
    totalResultados: empresasInseridas.length,
  });

  const bairroNomeById = new Map(bairros.map((b) => [b.id, b.nome]));

  const resultados: ResultadoBusca[] = empresasInseridas.map((e) => ({
    empresaId: e.id,
    placeId: e.placeId,
    nome: e.nome,
    endereco: e.endereco ?? '',
    telefone: e.telefone,
    website: e.website,
    rating: e.rating ? Number(e.rating) : null,
    totalReviews: e.userRatingsTotal,
    googleMapsUrl: e.googleMapsUrl,
    abertoAgora: e.abertoAgora,
    bairro: e.bairroId ? bairroNomeById.get(e.bairroId) ?? 'Outros' : 'Outros',
    emails: e.emails ?? [],
  }));

  revalidatePath('/dashboard');
  revalidatePath('/prospects');

  return {
    ok: true as const,
    resultados,
    totalEncontrado: resultados.length,
  };
}

/**
 * Server Action: extrai emails de uma empresa específica via Claude scraping.
 */
export async function buscarEmailsEmpresa(empresaId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, erro: 'Não autenticado' };
  }
  const userId = session.user.id;
  const db = getDb();

  const [empresa] = await db
    .select({
      id: schema.empresas.id,
      website: schema.empresas.website,
      ownerId: schema.empresas.ownerId,
      emails: schema.empresas.emails,
    })
    .from(schema.empresas)
    .where(
      and(eq(schema.empresas.id, empresaId), eq(schema.empresas.ownerId, userId)),
    )
    .limit(1);

  if (!empresa) {
    return { ok: false as const, erro: 'Empresa não encontrada' };
  }
  if (!empresa.website) {
    return { ok: false as const, erro: 'Empresa sem site cadastrado' };
  }

  let emails: string[] = [];
  try {
    const result = await extractEmailsFromSite(empresa.website);
    emails = result.emails;
  } catch (err) {
    return {
      ok: false as const,
      erro: err instanceof Error ? err.message : 'Erro na análise',
    };
  }

  // Merge com emails existentes (caso OSM já tenha trazido um)
  const merged = [...new Set([...(empresa.emails ?? []), ...emails])];

  await db
    .update(schema.empresas)
    .set({ emails: merged })
    .where(eq(schema.empresas.id, empresaId));

  return { ok: true as const, emails: merged };
}
