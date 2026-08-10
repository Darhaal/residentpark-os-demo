// Title: Sign-out Button (client)
// Path: src/components/ui/SignOutButton.tsx
// Functionality: Client component that calls supabase.auth.signOut() and redirects to /login.

'use client';

import { createClient } from '@/lib/supabase/client';
import { ROUTES } from '@/config/routes';
import { LogOut } from 'lucide-react';
import { en } from '@/localization/en';

interface SignOutButtonProps {
  label?: string;
  className?: string;
}

export function SignOutButton({ label = en.navigation.signOut, className }: SignOutButtonProps) {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full reload (not router.push) so the previous session's client router cache is
    // fully discarded — prevents stale-tree 404s when switching accounts.
    window.location.assign(ROUTES.login);
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={
        className ??
        'inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background shadow-sm transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
      }
    >
      <LogOut className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
