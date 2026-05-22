import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { LogoutButton } from './_components/logout-button';
import { LayoutDashboard, Search, Users, Send, Settings } from 'lucide-react';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex">
      {/* SIDEBAR */}
      <aside className="w-64 border-r border-[var(--color-border-base)] bg-[var(--color-surface)] flex flex-col">
        <div className="px-5 py-6 border-b border-[var(--color-border-base)]">
          <Link href="/dashboard" className="block">
            <div className="font-display text-2xl tracking-[3px] text-[var(--color-accent)]">
              LEAD <span className="text-[var(--color-orange)]">RADAR</span>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-[var(--color-text-mute)] mt-0.5">
              Prospecção B2B
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </NavItem>
          <NavItem href="/busca" icon={<Search className="h-4 w-4" />}>
            Buscar
          </NavItem>
          <NavItem href="/prospects" icon={<Users className="h-4 w-4" />}>
            Prospects
          </NavItem>
          <NavItem href="/campanhas" icon={<Send className="h-4 w-4" />}>
            Campanhas
          </NavItem>
          <NavItem href="/settings" icon={<Settings className="h-4 w-4" />}>
            Configurações
          </NavItem>
        </nav>

        <div className="p-4 border-t border-[var(--color-border-base)] text-xs text-[var(--color-text-dim)]">
          <div className="truncate" title={session.user.email ?? ''}>
            {session.user.email}
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition"
    >
      <span className="text-[var(--color-text-mute)]">{icon}</span>
      {children}
    </Link>
  );
}
