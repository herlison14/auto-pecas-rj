/**
 * Smoke test que invoca Overpass/Nominatim direto via fetch,
 * sem importar o lib (que tem `server-only`).
 *
 * Uso: npx dotenv -e .env.local -- tsx scripts/test-osm.ts
 */
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const UA = 'lead-radar/0.1 smoketest';

async function main() {
  console.log('▶ Nominatim: geocoding Tijuca, Rio de Janeiro...');
  const geo = await fetch(
    `${NOMINATIM}/search?q=${encodeURIComponent('Tijuca, Rio de Janeiro, RJ, Brasil')}&format=json&limit=1`,
    { headers: { 'User-Agent': UA } },
  ).then((r) => r.json() as Promise<Array<{ lat: string; lon: string; display_name: string }>>);

  if (!geo.length) throw new Error('Tijuca não geocodada.');
  const { lat, lon } = geo[0];
  console.log(`   ${geo[0].display_name}\n   coords: ${lat}, ${lon}\n`);

  // Respeita rate limit 1 req/seg do Nominatim
  await new Promise((r) => setTimeout(r, 1200));

  console.log('▶ Overpass: farmácias num raio 1.5km...');
  const query = `[out:json][timeout:25];
(
node["amenity"="pharmacy"](around:1500,${lat},${lon});
way["amenity"="pharmacy"](around:1500,${lat},${lon});
);
out center 10;`;

  const resp = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'data=' + encodeURIComponent(query),
  });

  if (!resp.ok) throw new Error(`Overpass falhou: ${resp.status}`);
  const data = (await resp.json()) as {
    elements: Array<{
      type: string;
      id: number;
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }>;
  };

  const results = data.elements
    .map((el) => {
      const tags = el.tags ?? {};
      const nome = tags.name ?? tags.brand;
      if (!nome) return null;
      const elat = el.type === 'node' ? el.lat : el.center?.lat;
      const elon = el.type === 'node' ? el.lon : el.center?.lon;
      return {
        nome,
        endereco: [tags['addr:street'], tags['addr:housenumber']]
          .filter(Boolean)
          .join(', '),
        telefone: tags.phone ?? tags['contact:phone'] ?? null,
        website: tags.website ?? null,
        lat: elat,
        lon: elon,
      };
    })
    .filter(Boolean);

  console.log(`   ${results.length} farmácias encontradas:\n`);
  for (const r of results) {
    console.log(`   • ${r!.nome}`);
    if (r!.endereco) console.log(`       endereço: ${r!.endereco}`);
    if (r!.telefone) console.log(`       tel: ${r!.telefone}`);
    if (r!.website) console.log(`       site: ${r!.website}`);
  }

  console.log('\n✓ OSM pipeline OK — Server Action pode usar normalmente');
}

main().catch((err) => {
  console.error('✗', err);
  process.exit(1);
});
