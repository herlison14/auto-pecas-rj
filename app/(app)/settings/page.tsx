import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb, schema } from '@/lib/db';

export default async function SettingsPage() {
  const session = await auth();
  const db = getDb();

  const [profile] = await db
    .select({
      name: schema.users.name,
      email: schema.users.email,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session!.user.id))
    .limit(1);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-4xl tracking-[2px] mb-1">
          CONFIGURAÇÕES
        </h1>
        <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-[var(--color-text-mute)]">
          Perfil e preferências
        </p>
      </header>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border-base)] rounded-xl p-6 space-y-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
            Nome
          </label>
          <div className="text-sm">{profile?.name ?? '—'}</div>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
            Email
          </label>
          <div className="text-sm">{profile?.email}</div>
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] block mb-1.5">
            Conta criada
          </label>
          <div className="text-sm font-mono text-[var(--color-text-dim)]">
            {profile?.createdAt
              ? new Date(profile.createdAt).toLocaleString('pt-BR')
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
