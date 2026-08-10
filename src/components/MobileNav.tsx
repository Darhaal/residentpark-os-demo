// Title: Mobile Navigation
// Path: src/components/MobileNav.tsx
// Functionality: Responsive bottom navigation. Residents get Home/Notices; admins get
// four primary shortcuts plus a "More" button that opens an accessible sheet listing
// every admin section (so no section is unreachable on mobile).

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Bell, Home, LayoutGrid, X } from 'lucide-react';
import {
  getVisibleAdminMobileShortcuts,
  getVisibleAdminTabs,
  isAdminNavigationTabActive,
} from '@/config/admin-navigation';
import { pathMatchesRoute, ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface MobileNavProps {
  isAdmin: boolean;
  isSuperadmin?: boolean;
}

const messages = en.navigation;

export function MobileNav({ isAdmin, isSuperadmin = false }: MobileNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const sheetRef = useModalA11y<HTMLDivElement>(menuOpen, closeMenu);

  const shortcuts = isAdmin
    ? getVisibleAdminMobileShortcuts(isSuperadmin)
    : [
        { href: ROUTES.home, label: messages.home, shortLabel: messages.home, icon: Home },
        { href: ROUTES.notices, label: messages.notices, shortLabel: messages.notices, icon: Bell },
      ];

  const allTabs = isAdmin ? getVisibleAdminTabs(isSuperadmin) : [];

  const isActive = (href: string) =>
    isAdmin ? isAdminNavigationTabActive(pathname, href) : pathMatchesRoute(pathname, href);

  return (
    <>
      <nav
        aria-label={messages.mobileNavigation}
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-flow-col auto-cols-fr gap-1 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-2xl shadow-zinc-950/10 backdrop-blur-xl">
          {shortcuts.map(({ href, label, shortLabel, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive(href) ? 'page' : undefined}
              className={cn(
                'flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold uppercase tracking-wider transition-all',
                isActive(href)
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800',
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive(href) ? 'stroke-[2.4]' : 'stroke-[1.8]')} />
              <span className="max-w-full truncate">{shortLabel}</span>
            </Link>
          ))}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-label={messages.moreSections}
              className="flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-800"
            >
              <LayoutGrid className="h-4 w-4 shrink-0 stroke-[1.8]" />
              <span className="max-w-full truncate">{messages.more}</span>
            </button>
          )}
        </div>
      </nav>

      {isAdmin && menuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <button
            type="button"
            aria-label={messages.closeMenu}
            onClick={closeMenu}
            className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={messages.adminSections}
            tabIndex={-1}
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-zinc-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl outline-none animate-in slide-in-from-bottom"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{messages.adminSections}</h2>
              <button
                type="button"
                onClick={closeMenu}
                aria-label={messages.closeMenu}
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allTabs.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  aria-current={isActive(href) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-sm font-medium transition-colors',
                    isActive(href)
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
