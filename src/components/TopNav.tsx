// Title: Global Top Navigation
// Path: src/components/TopNav.tsx
// Functionality: Role-aware global product shell. Admin sections live in the side panel.

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Bell, ChevronDown, ChevronLeft, Home, LogOut, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdminRole, isApprovedStatus, isSuperadminRole } from '@/config/domain';
import { pathMatchesRoute, ROUTES } from '@/config/routes';
import { UI_TIMING } from '@/config/limits';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import { GlobalSearch } from '@/components/GlobalSearch';
import { HelpButton } from '@/components/HelpButton';
import { MobileNav } from '@/components/MobileNav';
import { NotificationBell } from '@/components/NotificationBell';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
};

interface TopNavProps {
  title?: string;
  showBackButton?: boolean;
  currentUser?: {
    full_name?: string | null;
    role?: string | null;
    approval_status?: string | null;
  } | null;
}

const messages = en.navigation;
const NAV_STACK_KEY = 'resident-park-os:navigation-stack';
const MAX_NAV_STACK_SIZE = 20;

const readNavigationStack = () => {
  if (typeof window === 'undefined') return [];

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(NAV_STACK_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const writeNavigationStack = (stack: string[]) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack.slice(-MAX_NAV_STACK_SIZE)));
};

const getCurrentBrowserPath = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`;
};

const hasSameOriginReferrer = (currentPath: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.referrer) return false;

  try {
    const referrer = new URL(document.referrer);
    return window.history.length > 1
      && referrer.origin === window.location.origin
      && `${referrer.pathname}${referrer.search}` !== currentPath;
  } catch {
    return false;
  }
};

const clearNavigationStack = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(NAV_STACK_KEY);
};

const getRoleLabel = (role?: string | null) => {
  if (role === 'resident' || role === 'admin' || role === 'superadmin') return messages.roleLabels[role];
  return role || messages.signedOutRole;
};

const getInitials = (name?: string | null) => {
  if (!name) return 'RP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || 'R') + (parts[1]?.[0] || parts[0]?.[1] || 'P')).toUpperCase();
};

export function TopNav({ showBackButton = false, currentUser }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasMeaningfulBack, setHasMeaningfulBack] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuListRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A deactivated (suspended/rejected/pending) admin keeps no admin chrome — they are
  // bounced from /admin and land on the restricted resident shell. A missing status
  // (older callers) is treated as approved to preserve existing behaviour.
  const approval = currentUser?.approval_status;
  const isPrivileged = approval == null || isApprovedStatus(approval);
  const isAdmin = isAdminRole(currentUser?.role) && isPrivileged;
  const isSuperadmin = isSuperadminRole(currentUser?.role) && isPrivileged;
  const roleLabel = getRoleLabel(currentUser?.role);
  const portalLabel = isAdmin ? messages.adminConsole : messages.residentPortal;
  const showContextBackButton = showBackButton && hasMeaningfulBack;

  // Admins navigate via the admin side panel (Notices included); only residents get
  // the resident-facing top-nav items.
  const navItems: NavItem[] = isAdmin
    ? []
    : [
        { href: ROUTES.home, label: messages.home, icon: Home, exact: true },
        { href: ROUTES.notices, label: messages.notices, icon: Bell, exact: false },
      ];

  useEffect(() => {
    let cancelled = false;
    const commitBackState = (value: boolean) => {
      queueMicrotask(() => {
        if (!cancelled) setHasMeaningfulBack(value);
      });
    };

    if (!showBackButton) {
      commitBackState(false);
      return () => {
        cancelled = true;
      };
    }

    const currentPath = getCurrentBrowserPath();
    const stack = readNavigationStack();
    const lastPath = stack.at(-1);
    const previousPath = stack.at(-2);
    let nextStack = stack;

    if (lastPath !== currentPath) {
      nextStack = previousPath === currentPath
        ? stack.slice(0, -1)
        : [...stack, currentPath].slice(-MAX_NAV_STACK_SIZE);
    }
    if (nextStack.length === 0) nextStack = [currentPath];

    writeNavigationStack(nextStack);
    commitBackState(nextStack.length > 1 || hasSameOriginReferrer(currentPath));
    return () => {
      cancelled = true;
    };
  }, [pathname, showBackButton]);

  useEffect(() => {
    if (!menuOpen) return;

    const onOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      // Escape closes and restores focus to the trigger, per the menu-button pattern.
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    window.addEventListener('pagehide', clearNavigationStack);
    return () => window.removeEventListener('pagehide', clearNavigationStack);
  }, []);

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const onMouseEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (!menuOpen) openTimer.current = setTimeout(() => setMenuOpen(true), UI_TIMING.notificationOpenDelayMs);
  };

  const onMouseLeave = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    closeTimer.current = setTimeout(() => setMenuOpen(false), UI_TIMING.notificationCloseDelayMs);
  };

  const onAvatarClick = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    setMenuOpen(value => !value);
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    clearNavigationStack();
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full reload (not router.push) so the previous session's client router cache is
    // fully discarded — prevents stale-tree 404s when switching accounts.
    window.location.assign(ROUTES.login);
  };

  // ── Account menu keyboard support (WAI-ARIA menu-button pattern) ──────────────
  const menuItems = () => Array.from(menuListRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const focusItemAt = (index: number) => {
    const items = menuItems();
    if (items.length === 0) return;
    items[(index + items.length) % items.length]?.focus();
  };
  const openMenuWithFocus = (edge: 'first' | 'last') => {
    setMenuOpen(true);
    requestAnimationFrame(() => focusItemAt(edge === 'first' ? 0 : -1));
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); openMenuWithFocus('first'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); openMenuWithFocus('last'); }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = menuItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); focusItemAt(current + 1); break;
      case 'ArrowUp': event.preventDefault(); focusItemAt(current - 1); break;
      case 'Home': event.preventDefault(); focusItemAt(0); break;
      case 'End': event.preventDefault(); focusItemAt(-1); break;
      case 'Tab': setMenuOpen(false); break;
    }
  };

  return (
    <>
      {/* Fixed (not sticky): the global bar must stay glued to the viewport top on every
          page and scroll model. sticky can be silently broken by any ancestor that becomes
          a scroll container (overflow/contain) and can drift during mobile address-bar
          transitions; fixed + an in-flow spacer of the same height is layout-neutral but
          can never scroll away. */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex h-full min-w-0 items-center gap-4">
            {showContextBackButton && (
              <button
                type="button"
                onClick={() => router.back()}
                aria-label={messages.back}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <Link
              href={isAdmin ? ROUTES.admin.root : ROUTES.home}
              className="group flex min-w-0 items-center gap-3 rounded-md pr-2 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-zinc-200 bg-zinc-950 shadow-sm">
                <Image src="/favicon.svg" alt={messages.defaultTitle} width={16} height={16} className="h-4 w-4" priority />
              </span>
              <span className="hidden min-w-0 flex-col md:flex">
                <span className="truncate text-sm font-bold leading-tight text-zinc-950">{messages.defaultTitle}</span>
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{portalLabel}</span>
              </span>
            </Link>

            <nav aria-label={messages.primaryNavigation} className="hidden h-full items-center gap-6 sm:flex">
              {navItems.map(({ href, label, icon: Icon, exact }) => {
                const isActive = exact ? pathname === href : pathMatchesRoute(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group flex h-full items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-[-2px]',
                      isActive
                        ? 'border-zinc-950 text-zinc-950'
                        : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-950',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', isActive ? 'text-zinc-950' : 'text-zinc-400 group-hover:text-zinc-600')} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4">
            {isAdmin && <GlobalSearch />}
            {currentUser && <NotificationBell isAdmin={isAdmin} />}
            <HelpButton isAdmin={isAdmin} />

            <div className="hidden h-6 w-px bg-zinc-200 sm:block" />

            <div className="relative" ref={menuRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
              <button
                ref={triggerRef}
                type="button"
                onClick={onAvatarClick}
                onKeyDown={onTriggerKeyDown}
                aria-label={messages.accountMenu}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
              >
                <span className="grid h-5 w-5 place-items-center rounded bg-zinc-100 text-[10px] font-bold text-zinc-600">
                  {getInitials(currentUser?.full_name)}
                </span>
                <span className="hidden min-w-0 flex-col lg:flex">
                  <span className="max-w-[120px] truncate text-xs font-semibold text-zinc-950">
                    {currentUser?.full_name || messages.defaultUserName}
                  </span>
                </span>
                <ChevronDown className={cn('hidden h-3.5 w-3.5 text-zinc-400 transition-transform sm:block', menuOpen && 'rotate-180')} />
              </button>

              {menuOpen && (
                <div ref={menuListRef} role="menu" aria-label={messages.accountMenu} onKeyDown={onMenuKeyDown} className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-md border border-zinc-200 bg-white shadow-lg">
                  <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{messages.signedInAs}</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-zinc-950">{currentUser?.full_name || messages.defaultUserName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                      {roleLabel} / {portalLabel}
                    </p>
                  </div>

                  <div className="p-1">
                    {currentUser && (
                      <Link
                        href={ROUTES.profile}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                      >
                        <User className="h-4 w-4 text-zinc-400" />
                        {messages.profile}
                      </Link>
                    )}

                    {currentUser && <div className="mx-2 my-1 h-px bg-zinc-100" />}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4 text-destructive" />
                      {messages.signOut}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </header>

      {/* In-flow spacer reserving the fixed bar's height (h-14) so page content starts
          below it — keeps every shell (document-scroll and the parking app-shell) unchanged. */}
      <div aria-hidden className="h-14 shrink-0" />

      <MobileNav isAdmin={isAdmin} isSuperadmin={isSuperadmin} />
    </>
  );
}
