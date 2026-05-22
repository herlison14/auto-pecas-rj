import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Cliente Drizzle + Neon (serverless HTTP).
 * Inicialização lazy: não falha em build time se DATABASE_URL ausente.
 * NÃO usar Proxy wrapper aqui — quebra @auth/drizzle-adapter.
 */
type DbClient = ReturnType<typeof createDb>;

function createDb() {
  // Build-time fallback: neon() é lazy — não abre conexão até uma query rodar.
  // Em runtime, se DATABASE_URL faltar, a primeira query vai falhar com erro claro do driver.
  // (Não usamos Proxy wrapper porque o @auth/drizzle-adapter inspeciona o objeto db.)
  const url =
    process.env.DATABASE_URL ??
    'postgresql://noop:noop@localhost:5432/noop?sslmode=disable';
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: DbClient | null = null;

export function getDb(): DbClient {
  if (!_db) _db = createDb();
  return _db;
}

export { schema };
