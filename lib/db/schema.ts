import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  numeric,
  boolean,
  primaryKey,
  uuid,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { AdapterAccountType } from 'next-auth/adapters';

// ─── NEXT-AUTH TABLES (compatível com @auth/drizzle-adapter) ─────

export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  // Campo extra: hash de senha (Credentials provider)
  hashedPassword: text('hashed_password'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (a) => ({
    pk: primaryKey({ columns: [a.provider, a.providerAccountId] }),
  }),
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ─── DOMAIN TABLES ───────────────────────────────────────────────

export const cidades = pgTable(
  'cidades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nome: text('nome').notNull(),
    estado: varchar('estado', { length: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqNomeEstado: uniqueIndex('cidades_nome_estado_idx').on(t.nome, t.estado),
  }),
);

export const bairros = pgTable(
  'bairros',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cidadeId: uuid('cidade_id')
      .notNull()
      .references(() => cidades.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    zona: text('zona'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqCidadeNome: uniqueIndex('bairros_cidade_nome_idx').on(t.cidadeId, t.nome),
    idxZona: index('bairros_zona_idx').on(t.zona),
  }),
);

export const setores = pgTable(
  'setores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    nome: text('nome').notNull(),
    categoria: text('categoria').notNull(),
    queryTemplate: text('query_template').notNull(),
    /**
     * Filtro Overpass/OSM no formato "tag=value", ex: "shop=car_parts" ou "amenity=pharmacy".
     * Múltiplos separados por vírgula: "shop=car_parts,shop=tyres".
     */
    osmFilter: text('osm_filter').notNull().default('shop=*'),
    icon: text('icon'),
    ativo: boolean('ativo').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxCategoria: index('setores_categoria_idx').on(t.categoria),
    idxAtivo: index('setores_ativo_idx').on(t.ativo),
  }),
);

export const empresas = pgTable(
  'empresas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    placeId: text('place_id').notNull(),
    nome: text('nome').notNull(),
    setorId: uuid('setor_id').references(() => setores.id, { onDelete: 'set null' }),
    cidadeId: uuid('cidade_id').references(() => cidades.id, { onDelete: 'set null' }),
    bairroId: uuid('bairro_id').references(() => bairros.id, { onDelete: 'set null' }),
    endereco: text('endereco'),
    telefone: text('telefone'),
    website: text('website'),
    rating: numeric('rating', { precision: 2, scale: 1 }),
    userRatingsTotal: integer('user_ratings_total'),
    googleMapsUrl: text('google_maps_url'),
    abertoAgora: boolean('aberto_agora'),
    emails: text('emails')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scoreAtividade: integer('score_atividade'),
    scoreDetalhes: jsonb('score_detalhes'),
    statusProspect: text('status_prospect').notNull().default('novo'),
    ultimaAnalise: timestamp('ultima_analise', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqOwnerPlace: uniqueIndex('empresas_owner_place_idx').on(t.ownerId, t.placeId),
    idxOwner: index('empresas_owner_idx').on(t.ownerId),
    idxSetor: index('empresas_setor_idx').on(t.setorId),
    idxStatus: index('empresas_status_idx').on(t.statusProspect),
  }),
);

export const buscas = pgTable(
  'buscas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    setorId: uuid('setor_id').references(() => setores.id, { onDelete: 'set null' }),
    cidadeId: uuid('cidade_id').references(() => cidades.id, { onDelete: 'set null' }),
    bairrosIds: uuid('bairros_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    queryCustom: text('query_custom'),
    totalResultados: integer('total_resultados').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idxOwner: index('buscas_owner_idx').on(t.ownerId, t.createdAt),
  }),
);

// ─── RELATIONS ──────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  empresas: many(empresas),
  buscas: many(buscas),
}));

export const empresasRelations = relations(empresas, ({ one }) => ({
  owner: one(users, { fields: [empresas.ownerId], references: [users.id] }),
  setor: one(setores, { fields: [empresas.setorId], references: [setores.id] }),
  cidade: one(cidades, { fields: [empresas.cidadeId], references: [cidades.id] }),
  bairro: one(bairros, { fields: [empresas.bairroId], references: [bairros.id] }),
}));

export const bairrosRelations = relations(bairros, ({ one }) => ({
  cidade: one(cidades, { fields: [bairros.cidadeId], references: [cidades.id] }),
}));

// ─── TYPE EXPORTS ───────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Setor = typeof setores.$inferSelect;
export type Cidade = typeof cidades.$inferSelect;
export type Bairro = typeof bairros.$inferSelect;
export type Empresa = typeof empresas.$inferSelect;
export type NewEmpresa = typeof empresas.$inferInsert;
export type Busca = typeof buscas.$inferSelect;
