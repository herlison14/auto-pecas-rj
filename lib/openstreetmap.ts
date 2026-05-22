import 'server-only';

/**
 * OpenStreetMap data layer — substitui Google Places API.
 * 100% gratuito, sem cartão, sem billing.
 *
 * - Nominatim: geocoding de bairros → lat/lon
 * - Overpass: busca de POIs (Points of Interest) por filtro OSM + área
 *
 * Rate limits (respeitar pra não ser banido):
 * - Nominatim: 1 request/segundo, requer User-Agent identificável
 * - Overpass: ~10k queries/dia por IP, timeout 25s padrão
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

// HTTP headers só aceitam ASCII — sem em-dash, sem acentos.
const USER_AGENT =
  'lead-radar/0.1 (B2B prospection tool - https://github.com/herlison14/auto-pecas-rj)';

// ─── TIPOS ─────────────────────────────────────────────────────

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OsmPlace = {
  osmId: string; // formato: "node/123456" — chave única
  nome: string;
  lat: number;
  lon: number;
  endereco: string;
  telefone: string | null;
  website: string | null;
  email: string | null;
  openingHours: string | null;
};

// ─── NOMINATIM (geocode) ───────────────────────────────────────

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
};

const geocodeCache = new Map<string, { lat: number; lon: number }>();

/**
 * Geocode um nome de bairro/cidade → lat/lon.
 * Cacheia em memória pra evitar bater repetidamente no Nominatim.
 */
export async function nominatimGeocode(
  bairro: string,
  cidade: string,
  estado = 'RJ',
): Promise<{ lat: number; lon: number } | null> {
  const key = `${bairro}|${cidade}|${estado}`.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: `${bairro}, ${cidade}, ${estado}, Brasil`,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });

  const resp = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!resp.ok) {
    throw new Error(`Nominatim falhou: ${resp.status}`);
  }

  const data = (await resp.json()) as NominatimResult[];
  if (!data.length) return null;

  const result = {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
  };
  geocodeCache.set(key, result);
  return result;
}

// ─── OVERPASS (POI search) ─────────────────────────────────────

/**
 * Faz request Overpass com fallback entre múltiplos mirrors.
 */
async function overpassRequest(query: string, attempt = 0): Promise<unknown> {
  const url = OVERPASS_URLS[attempt % OVERPASS_URLS.length];
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: 'data=' + encodeURIComponent(query),
      cache: 'no-store',
      // Overpass pode demorar até ~30s
      signal: AbortSignal.timeout(35000),
    });

    if (resp.status === 429 || resp.status === 504) {
      // Rate limit ou timeout no mirror — tenta o próximo
      if (attempt < OVERPASS_URLS.length - 1) {
        await sleep(2000);
        return overpassRequest(query, attempt + 1);
      }
      throw new Error(`Overpass: todos os mirrors falharam (${resp.status})`);
    }

    if (!resp.ok) {
      throw new Error(`Overpass falhou: ${resp.status}`);
    }

    const text = await resp.text();
    // Overpass pode retornar HTML de erro mesmo com 200 quando sobrecarregado
    if (text.startsWith('<') || text.includes('runtime error')) {
      if (attempt < OVERPASS_URLS.length - 1) {
        await sleep(2000);
        return overpassRequest(query, attempt + 1);
      }
      throw new Error('Overpass: servidor sobrecarregado em todos os mirrors');
    }

    return JSON.parse(text);
  } catch (err) {
    if (
      attempt < OVERPASS_URLS.length - 1 &&
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      return overpassRequest(query, attempt + 1);
    }
    throw err;
  }
}

/**
 * Constrói parte da query Overpass pra um filtro OSM (ex: "shop=car_parts").
 * Aceita múltiplos filtros separados por vírgula: "shop=car_parts,shop=tyres".
 */
function buildOverpassClauses(
  osmFilter: string,
  lat: number,
  lon: number,
  radiusMeters: number,
): string {
  const filters = osmFilter.split(',').map((f) => f.trim()).filter(Boolean);
  const clauses: string[] = [];

  for (const filter of filters) {
    const [tag, value] = filter.split('=').map((s) => s.trim());
    if (!tag) continue;
    const tagFilter = value && value !== '*' ? `["${tag}"="${value}"]` : `["${tag}"]`;
    clauses.push(`node${tagFilter}(around:${radiusMeters},${lat},${lon});`);
    clauses.push(`way${tagFilter}(around:${radiusMeters},${lat},${lon});`);
  }

  return clauses.join('\n');
}

/**
 * Busca POIs num raio ao redor de lat/lon que casem com o filtro OSM.
 */
export async function overpassSearch(
  osmFilter: string,
  lat: number,
  lon: number,
  options: { radiusMeters?: number; maxResults?: number } = {},
): Promise<OsmPlace[]> {
  const radius = options.radiusMeters ?? 1500;
  const maxResults = options.maxResults ?? 50;

  const query = `
[out:json][timeout:25];
(
${buildOverpassClauses(osmFilter, lat, lon, radius)}
);
out center ${maxResults};
`.trim();

  const data = (await overpassRequest(query)) as { elements?: OsmElement[] };
  const elements = data.elements ?? [];

  return elements
    .map(toOsmPlace)
    .filter((p): p is OsmPlace => p !== null);
}

function toOsmPlace(el: OsmElement): OsmPlace | null {
  const tags = el.tags ?? {};
  const nome = tags['name'] ?? tags['brand'] ?? null;
  if (!nome) return null; // sem nome não serve

  const lat = el.type === 'node' ? el.lat : el.center?.lat;
  const lon = el.type === 'node' ? el.lon : el.center?.lon;
  if (lat == null || lon == null) return null;

  // Endereço estruturado do OSM
  const endParts: string[] = [];
  if (tags['addr:street']) {
    let street = tags['addr:street'];
    if (tags['addr:housenumber']) street += `, ${tags['addr:housenumber']}`;
    endParts.push(street);
  }
  if (tags['addr:suburb']) endParts.push(tags['addr:suburb']);
  if (tags['addr:city']) endParts.push(tags['addr:city']);
  const endereco = endParts.join(' - ');

  return {
    osmId: `${el.type}/${el.id}`,
    nome,
    lat,
    lon,
    endereco,
    telefone: tags['phone'] ?? tags['contact:phone'] ?? null,
    website: tags['website'] ?? tags['contact:website'] ?? null,
    email: tags['email'] ?? tags['contact:email'] ?? null,
    openingHours: tags['opening_hours'] ?? null,
  };
}

// ─── HIGH-LEVEL ────────────────────────────────────────────────

/**
 * Busca em batch: pra cada bairro, geocoda → busca POIs do filtro.
 * Dedupe global por osmId.
 * Respeita rate limit do Nominatim (1 req/sec).
 */
export async function batchSearchOSM(
  osmFilter: string,
  bairros: Array<{ id: string; nome: string }>,
  cidadeNome: string,
  estado: string,
  options: { radiusMeters?: number; maxPerBairro?: number } = {},
): Promise<Array<OsmPlace & { bairroId: string; bairroNome: string }>> {
  const all: Array<OsmPlace & { bairroId: string; bairroNome: string }> = [];
  const seenOsmIds = new Set<string>();

  for (const bairro of bairros) {
    // Nominatim: 1 req/seg
    const coords = await nominatimGeocode(bairro.nome, cidadeNome, estado);
    await sleep(1100);
    if (!coords) continue;

    let places: OsmPlace[] = [];
    try {
      places = await overpassSearch(osmFilter, coords.lat, coords.lon, {
        radiusMeters: options.radiusMeters ?? 1500,
        maxResults: options.maxPerBairro ?? 30,
      });
    } catch (err) {
      // Não derruba a busca inteira se 1 bairro falhar
      console.warn(
        `[OSM] Overpass falhou pro bairro ${bairro.nome}: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    for (const place of places) {
      if (seenOsmIds.has(place.osmId)) continue;
      seenOsmIds.add(place.osmId);
      all.push({ ...place, bairroId: bairro.id, bairroNome: bairro.nome });
    }
  }

  return all;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
