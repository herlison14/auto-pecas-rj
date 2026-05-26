import 'server-only';

/**
 * Google Places API (New) — provedor alternativo ao OpenStreetMap.
 * Fornece rating, totalReviews, abertoAgora e googleMapsUri reais.
 *
 * Requer: GOOGLE_PLACES_API_KEY no ambiente.
 * Doc: https://developers.google.com/maps/documentation/places/web-service/text-search
 */

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.currentOpeningHours.openNow',
  'places.googleMapsUri',
].join(',');

// ─── TIPOS ─────────────────────────────────────────────────

export type GooglePlace = {
  placeId: string;
  nome: string;
  lat: number;
  lon: number;
  endereco: string;
  telefone: string | null;
  website: string | null;
  rating: number | null;
  totalReviews: number | null;
  abertoAgora: boolean | null;
  googleMapsUrl: string;
};

type PlaceRaw = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: { openNow?: boolean };
  googleMapsUri?: string;
};

// ─── BUSCA TEXT SEARCH ─────────────────────────────────────

export async function googlePlacesTextSearch(
  textQuery: string,
  lat: number,
  lon: number,
  options: { radiusMeters?: number; maxResults?: number } = {},
): Promise<GooglePlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY não configurada');

  const radius = options.radiusMeters ?? 1500;
  const maxResults = Math.min(options.maxResults ?? 20, 20); // API limita a 20

  const resp = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius,
        },
      },
      maxResultCount: maxResults,
      languageCode: 'pt-BR',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });

  if (resp.status === 400) {
    const body = await resp.text();
    throw new Error(`Google Places: request inválido — ${body.slice(0, 300)}`);
  }
  if (resp.status === 401 || resp.status === 403) {
    throw new Error('Google Places: chave de API inválida ou sem permissão');
  }
  if (resp.status === 429) {
    throw new Error('Google Places: limite de requisições atingido (quota)');
  }
  if (!resp.ok) {
    throw new Error(`Google Places: erro ${resp.status}`);
  }

  const data = (await resp.json()) as { places?: PlaceRaw[] };
  return (data.places ?? []).map(toGooglePlace).filter((p): p is GooglePlace => p !== null);
}

function toGooglePlace(p: PlaceRaw): GooglePlace | null {
  const lat = p.location?.latitude;
  const lon = p.location?.longitude;
  if (lat == null || lon == null) return null;

  const nome = p.displayName?.text;
  if (!nome) return null;

  const telefone = p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null;

  return {
    placeId: p.id,
    nome,
    lat,
    lon,
    endereco: p.formattedAddress ?? '',
    telefone,
    website: p.websiteUri ?? null,
    rating: p.rating ?? null,
    totalReviews: p.userRatingCount ?? null,
    abertoAgora: p.currentOpeningHours?.openNow ?? null,
    googleMapsUrl: p.googleMapsUri ?? `https://www.google.com/maps?q=${lat},${lon}`,
  };
}

// ─── BATCH ─────────────────────────────────────────────────

/**
 * Busca em batch via Google Places Text Search.
 * Para cada bairro: monta a query "{queryTemplate} em {bairro}, {cidade}" e busca.
 * Dedupe global por placeId.
 * Rate limit: 50ms entre requests (Google Places suporta bem mais, mas é prudente).
 */
export async function batchSearchGooglePlaces(
  queryTemplate: string,
  lat: number,
  lon: number,
  bairros: Array<{ id: string; nome: string }>,
  cidadeNome: string,
  options: { radiusMeters?: number; maxPerBairro?: number } = {},
): Promise<Array<GooglePlace & { bairroId: string; bairroNome: string }>> {
  const all: Array<GooglePlace & { bairroId: string; bairroNome: string }> = [];
  const seenPlaceIds = new Set<string>();

  for (const bairro of bairros) {
    const textQuery = `${queryTemplate} em ${bairro.nome}, ${cidadeNome}`;

    let places: GooglePlace[] = [];
    try {
      places = await googlePlacesTextSearch(textQuery, lat, lon, {
        radiusMeters: options.radiusMeters ?? 1500,
        maxResults: options.maxPerBairro ?? 20,
      });
    } catch (err) {
      console.warn(
        `[GooglePlaces] Falha no bairro ${bairro.nome}: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    for (const place of places) {
      if (seenPlaceIds.has(place.placeId)) continue;
      seenPlaceIds.add(place.placeId);
      all.push({ ...place, bairroId: bairro.id, bairroNome: bairro.nome });
    }

    await sleep(50);
  }

  return all;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
