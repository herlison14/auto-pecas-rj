'use client';

import { LogOut } from 'lucide-react';
import { logoutAction } from './logout-action';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-mute)] hover:text-[var(--color-red)] transition"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </button>
    </form>
  );
}
