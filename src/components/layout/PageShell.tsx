// Title: Page Shell
// Path: src/components/layout/PageShell.tsx
// Functionality: Reusable page container that standardizes spacing and responsive content width.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AdminSidePanel } from '@/components/admin/AdminSidePanel';
import { TopNav } from '@/components/TopNav';
import { EmptyState } from '@/components/ui/empty-state';
import { isAdminRole, isSuperadminRole } from '@/config/domain';
import { cn } from '@/lib/utils';

export interface ShellUser {
  full_name?: string | null;
  role?: string | null;
}

interface PageShellProps {
  title: string;
  currentUser?: ShellUser | null;
  showBackButton?: boolean;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  wrapMain?: boolean;
}

interface PageErrorStateProps {
  navTitle: string;
  icon: LucideIcon;
  title: string;
  description: string;
  currentUser?: ShellUser | null;
  maxWidthClassName?: string;
}

export function PageShell({
  title,
  currentUser,
  showBackButton = true,
  children,
  className,
  mainClassName,
  wrapMain = false,
}: PageShellProps) {
  const isAdmin = isAdminRole(currentUser?.role);
  const isSuperadmin = isSuperadminRole(currentUser?.role);

  return (
    <div className={cn('min-h-screen bg-zinc-50 flex flex-col', className)}>
      <TopNav title={title} showBackButton={showBackButton} currentUser={currentUser} />
      {isAdmin && <AdminSidePanel isSuperadmin={isSuperadmin} />}
      {wrapMain ? (
        <main className={cn('flex-1 p-4 sm:p-8', mainClassName, isAdmin && 'admin-content-pad')}>
          {children}
        </main>
      ) : (
        <div className={cn('flex-1', isAdmin && 'admin-content-pad')}>
          {children}
        </div>
      )}
    </div>
  );
}

export function PageErrorState({
  navTitle,
  icon,
  title,
  description,
  currentUser,
  maxWidthClassName = 'max-w-5xl',
}: PageErrorStateProps) {
  return (
    <PageShell title={navTitle} currentUser={currentUser} wrapMain>
      <div className={cn(maxWidthClassName, 'mx-auto')}>
        <EmptyState icon={icon} title={title} description={description} />
      </div>
    </PageShell>
  );
}
