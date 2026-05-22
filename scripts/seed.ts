/**
 * Seed do Lead Radar: cidade RJ + 47 bairros + 47 setores.
 * Idempotente — usa onConflictDoNothing.
 *
 * Rodar:
 *   npm run db:seed
 */
import { eq, and, notInArray } from 'drizzle-orm';
import { getDb, schema } from '../lib/db';

async function main() {
  const db = getDb();

  console.log('▶ Seed: criando cidade Rio de Janeiro...');
  await db
    .insert(schema.cidades)
    .values({ nome: 'Rio de Janeiro', estado: 'RJ' })
    .onConflictDoNothing();

  const [cidadeRj] = await db
    .select()
    .from(schema.cidades)
    .where(
      and(eq(schema.cidades.nome, 'Rio de Janeiro'), eq(schema.cidades.estado, 'RJ')),
    )
    .limit(1);

  if (!cidadeRj) throw new Error('Não foi possível criar cidade RJ');

  console.log('▶ Seed: criando bairros...');
  const bairrosData: Array<{ nome: string; zona: string }> = [
    // Zona Sul (14)
    { nome: 'Copacabana', zona: 'Zona Sul' },
    { nome: 'Ipanema', zona: 'Zona Sul' },
    { nome: 'Leblon', zona: 'Zona Sul' },
    { nome: 'Botafogo', zona: 'Zona Sul' },
    { nome: 'Flamengo', zona: 'Zona Sul' },
    { nome: 'Laranjeiras', zona: 'Zona Sul' },
    { nome: 'Catete', zona: 'Zona Sul' },
    { nome: 'Glória', zona: 'Zona Sul' },
    { nome: 'Urca', zona: 'Zona Sul' },
    { nome: 'Leme', zona: 'Zona Sul' },
    { nome: 'Gávea', zona: 'Zona Sul' },
    { nome: 'Jardim Botânico', zona: 'Zona Sul' },
    { nome: 'Lagoa', zona: 'Zona Sul' },
    { nome: 'Humaitá', zona: 'Zona Sul' },
    // Zona Norte (14)
    { nome: 'Méier', zona: 'Zona Norte' },
    { nome: 'Madureira', zona: 'Zona Norte' },
    { nome: 'Penha', zona: 'Zona Norte' },
    { nome: 'Ilha do Governador', zona: 'Zona Norte' },
    { nome: 'São Cristóvão', zona: 'Zona Norte' },
    { nome: 'Tijuca', zona: 'Zona Norte' },
    { nome: 'Vila Isabel', zona: 'Zona Norte' },
    { nome: 'Engenho Novo', zona: 'Zona Norte' },
    { nome: 'Ramos', zona: 'Zona Norte' },
    { nome: 'Olaria', zona: 'Zona Norte' },
    { nome: 'Brás de Pina', zona: 'Zona Norte' },
    { nome: 'Inhaúma', zona: 'Zona Norte' },
    { nome: 'Del Castilho', zona: 'Zona Norte' },
    { nome: 'Cachambi', zona: 'Zona Norte' },
    // Zona Oeste (11)
    { nome: 'Barra da Tijuca', zona: 'Zona Oeste' },
    { nome: 'Jacarepaguá', zona: 'Zona Oeste' },
    { nome: 'Campo Grande', zona: 'Zona Oeste' },
    { nome: 'Santa Cruz', zona: 'Zona Oeste' },
    { nome: 'Realengo', zona: 'Zona Oeste' },
    { nome: 'Bangu', zona: 'Zona Oeste' },
    { nome: 'Taquara', zona: 'Zona Oeste' },
    { nome: 'Pechincha', zona: 'Zona Oeste' },
    { nome: 'Praça Seca', zona: 'Zona Oeste' },
    { nome: 'Sulacap', zona: 'Zona Oeste' },
    { nome: 'Padre Miguel', zona: 'Zona Oeste' },
    // Centro e Arredores (8)
    { nome: 'Centro', zona: 'Centro e Arredores' },
    { nome: 'Catumbi', zona: 'Centro e Arredores' },
    { nome: 'Rio Comprido', zona: 'Centro e Arredores' },
    { nome: 'Cidade Nova', zona: 'Centro e Arredores' },
    { nome: 'Lapa', zona: 'Centro e Arredores' },
    { nome: 'Estácio', zona: 'Centro e Arredores' },
    { nome: 'Benfica', zona: 'Centro e Arredores' },
    { nome: 'Gamboa', zona: 'Centro e Arredores' },
  ];

  for (const b of bairrosData) {
    await db
      .insert(schema.bairros)
      .values({ cidadeId: cidadeRj.id, nome: b.nome, zona: b.zona })
      .onConflictDoNothing();
  }
  console.log(`   ${bairrosData.length} bairros inseridos`);

  console.log('▶ Seed: criando setores...');
  // queryTemplate é texto descritivo (compat); osmFilter é a tag OSM real usada na busca.
  const setoresData: Array<{
    slug: string;
    nome: string;
    categoria: string;
    queryTemplate: string;
    osmFilter: string;
    icon: string;
  }> = [
    // Automotivo
    { slug: 'auto-pecas', nome: 'Auto Peças', categoria: 'Automotivo', queryTemplate: 'auto peças', osmFilter: 'shop=car_parts', icon: 'Wrench' },
    { slug: 'pneus-rodas', nome: 'Pneus e Rodas', categoria: 'Automotivo', queryTemplate: 'pneus e rodas', osmFilter: 'shop=tyres', icon: 'Disc' },
    { slug: 'oficina-mecanica', nome: 'Oficinas Mecânicas', categoria: 'Automotivo', queryTemplate: 'oficina mecânica', osmFilter: 'shop=car_repair', icon: 'Cog' },
    { slug: 'concessionaria', nome: 'Concessionárias', categoria: 'Automotivo', queryTemplate: 'concessionária', osmFilter: 'shop=car', icon: 'Car' },
    // Comércio
    { slug: 'supermercado', nome: 'Supermercados', categoria: 'Comércio', queryTemplate: 'supermercado', osmFilter: 'shop=supermarket', icon: 'ShoppingCart' },
    { slug: 'farmacia', nome: 'Farmácias', categoria: 'Comércio', queryTemplate: 'farmácia', osmFilter: 'amenity=pharmacy', icon: 'Pill' },
    { slug: 'papelaria', nome: 'Papelarias', categoria: 'Comércio', queryTemplate: 'papelaria', osmFilter: 'shop=stationery', icon: 'BookOpen' },
    { slug: 'material-construcao', nome: 'Material de Construção', categoria: 'Comércio', queryTemplate: 'material de construção', osmFilter: 'shop=hardware,shop=doityourself', icon: 'Hammer' },
    { slug: 'loja-roupas', nome: 'Lojas de Roupas', categoria: 'Comércio', queryTemplate: 'loja de roupas', osmFilter: 'shop=clothes', icon: 'Shirt' },
    { slug: 'petshop', nome: 'Pet Shops', categoria: 'Comércio', queryTemplate: 'pet shop', osmFilter: 'shop=pet', icon: 'Dog' },
    { slug: 'floricultura', nome: 'Floriculturas', categoria: 'Comércio', queryTemplate: 'floricultura', osmFilter: 'shop=florist', icon: 'Flower' },
    { slug: 'joalheria', nome: 'Joalherias', categoria: 'Comércio', queryTemplate: 'joalheria', osmFilter: 'shop=jewelry', icon: 'Gem' },
    { slug: 'optica', nome: 'Óticas', categoria: 'Comércio', queryTemplate: 'ótica', osmFilter: 'shop=optician', icon: 'Eye' },
    // Alimentação
    { slug: 'restaurante', nome: 'Restaurantes', categoria: 'Alimentação', queryTemplate: 'restaurante', osmFilter: 'amenity=restaurant', icon: 'UtensilsCrossed' },
    { slug: 'lanchonete', nome: 'Lanchonetes', categoria: 'Alimentação', queryTemplate: 'lanchonete', osmFilter: 'amenity=fast_food', icon: 'Sandwich' },
    { slug: 'padaria', nome: 'Padarias', categoria: 'Alimentação', queryTemplate: 'padaria', osmFilter: 'shop=bakery', icon: 'Croissant' },
    { slug: 'cafeteria', nome: 'Cafeterias', categoria: 'Alimentação', queryTemplate: 'cafeteria', osmFilter: 'amenity=cafe', icon: 'Coffee' },
    { slug: 'bar', nome: 'Bares', categoria: 'Alimentação', queryTemplate: 'bar', osmFilter: 'amenity=bar,amenity=pub', icon: 'Beer' },
    { slug: 'sorveteria', nome: 'Sorveterias', categoria: 'Alimentação', queryTemplate: 'sorveteria', osmFilter: 'amenity=ice_cream', icon: 'IceCream' },
    // Serviços
    { slug: 'barbearia', nome: 'Barbearias e Salões', categoria: 'Serviços', queryTemplate: 'barbearia', osmFilter: 'shop=hairdresser', icon: 'Scissors' },
    { slug: 'salao-beleza', nome: 'Beleza e Estética', categoria: 'Serviços', queryTemplate: 'salão de beleza', osmFilter: 'shop=beauty', icon: 'Sparkles' },
    { slug: 'lavanderia', nome: 'Lavanderias', categoria: 'Serviços', queryTemplate: 'lavanderia', osmFilter: 'shop=laundry', icon: 'WashingMachine' },
    { slug: 'chaveiro', nome: 'Chaveiros', categoria: 'Serviços', queryTemplate: 'chaveiro', osmFilter: 'shop=locksmith', icon: 'Key' },
    { slug: 'celular-assistencia', nome: 'Celulares e Assistência', categoria: 'Serviços', queryTemplate: 'celular', osmFilter: 'shop=mobile_phone', icon: 'Smartphone' },
    { slug: 'contabilidade', nome: 'Escritórios de Contabilidade', categoria: 'Serviços', queryTemplate: 'contabilidade', osmFilter: 'office=accountant', icon: 'Calculator' },
    { slug: 'advocacia', nome: 'Escritórios de Advocacia', categoria: 'Serviços', queryTemplate: 'advogado', osmFilter: 'office=lawyer', icon: 'Scale' },
    { slug: 'arquitetura', nome: 'Arquitetura', categoria: 'Serviços', queryTemplate: 'arquiteto', osmFilter: 'office=architect', icon: 'Building' },
    // Saúde
    { slug: 'clinica-medica', nome: 'Clínicas Médicas', categoria: 'Saúde', queryTemplate: 'clínica médica', osmFilter: 'amenity=clinic,amenity=doctors', icon: 'Stethoscope' },
    { slug: 'clinica-odontologica', nome: 'Clínicas Odontológicas', categoria: 'Saúde', queryTemplate: 'clínica odontológica', osmFilter: 'amenity=dentist', icon: 'Smile' },
    { slug: 'clinica-veterinaria', nome: 'Clínicas Veterinárias', categoria: 'Saúde', queryTemplate: 'clínica veterinária', osmFilter: 'amenity=veterinary', icon: 'PawPrint' },
    { slug: 'hospital', nome: 'Hospitais', categoria: 'Saúde', queryTemplate: 'hospital', osmFilter: 'amenity=hospital', icon: 'Cross' },
    // Educação
    { slug: 'escola', nome: 'Escolas', categoria: 'Educação', queryTemplate: 'escola', osmFilter: 'amenity=school', icon: 'School' },
    { slug: 'curso-idiomas', nome: 'Cursos de Idiomas', categoria: 'Educação', queryTemplate: 'curso de idiomas', osmFilter: 'amenity=language_school', icon: 'Languages' },
    { slug: 'universidade', nome: 'Universidades e Faculdades', categoria: 'Educação', queryTemplate: 'universidade', osmFilter: 'amenity=university,amenity=college', icon: 'GraduationCap' },
    { slug: 'autoescola', nome: 'Autoescolas', categoria: 'Educação', queryTemplate: 'autoescola', osmFilter: 'amenity=driving_school', icon: 'CarFront' },
    // Imobiliário
    { slug: 'imobiliaria', nome: 'Imobiliárias', categoria: 'Imobiliário', queryTemplate: 'imobiliária', osmFilter: 'office=estate_agent', icon: 'Home' },
    // Hospedagem
    { slug: 'hotel', nome: 'Hotéis', categoria: 'Hospedagem', queryTemplate: 'hotel', osmFilter: 'tourism=hotel', icon: 'BedDouble' },
    { slug: 'pousada', nome: 'Pousadas', categoria: 'Hospedagem', queryTemplate: 'pousada', osmFilter: 'tourism=guest_house', icon: 'Tent' },
    { slug: 'hostel', nome: 'Hostels', categoria: 'Hospedagem', queryTemplate: 'hostel', osmFilter: 'tourism=hostel', icon: 'BedSingle' },
    // Indústria & Ofícios
    { slug: 'grafica', nome: 'Gráficas e Copiadoras', categoria: 'Indústria', queryTemplate: 'gráfica', osmFilter: 'shop=copyshop,craft=printer', icon: 'Printer' },
    { slug: 'marcenaria', nome: 'Marcenarias', categoria: 'Indústria', queryTemplate: 'marcenaria', osmFilter: 'craft=carpenter', icon: 'Hammer' },
    { slug: 'serralheria', nome: 'Serralherias', categoria: 'Indústria', queryTemplate: 'serralheria', osmFilter: 'craft=metal_construction', icon: 'Wrench' },
  ];

  for (const s of setoresData) {
    await db
      .insert(schema.setores)
      .values(s)
      .onConflictDoUpdate({
        target: schema.setores.slug,
        set: {
          nome: s.nome,
          categoria: s.categoria,
          queryTemplate: s.queryTemplate,
          osmFilter: s.osmFilter,
          icon: s.icon,
        },
      });
  }
  console.log(`   ${setoresData.length} setores inseridos/atualizados`);

  // Desativa setores legados (do tempo do Google Places) que não estão na lista nova.
  const slugsNovos = setoresData.map((s) => s.slug);
  const desativados = await db
    .update(schema.setores)
    .set({ ativo: false })
    .where(notInArray(schema.setores.slug, slugsNovos))
    .returning({ slug: schema.setores.slug });
  if (desativados.length > 0) {
    console.log(`   ${desativados.length} setores legados desativados`);
  }

  console.log('✓ Seed concluído');
}

main()
  .catch((err) => {
    console.error('✗ Seed falhou:', err);
    process.exit(1);
  })
  .then(() => process.exit(0));
