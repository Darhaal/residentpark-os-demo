// Title: Resident Portal Loading
// Path: src/components/resident/ResidentPortalLoading.tsx
// Functionality: Route-level skeleton screens for resident dashboard, parking, profile, and notices.

import { Bell, Home, Map, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { en } from '@/localization/en';
import { cn } from '@/lib/utils';

type ResidentLoadingVariant = 'dashboard' | 'notices' | 'parking' | 'profile';

const variantMeta: Record<ResidentLoadingVariant, { icon: LucideIcon; titleWidth: string; subtitleWidth: string }> = {
  dashboard: { icon: Home, titleWidth: 'w-56', subtitleWidth: 'w-72' },
  notices: { icon: Bell, titleWidth: 'w-32', subtitleWidth: 'w-44' },
  parking: { icon: Map, titleWidth: 'w-40', subtitleWidth: 'w-60' },
  profile: { icon: User, titleWidth: 'w-36', subtitleWidth: 'w-64' },
};

export function ResidentPortalLoading({ variant = 'dashboard' }: { variant?: ResidentLoadingVariant }) {
  if (variant === 'parking') return <ResidentParkingLoading />;

  const meta = variantMeta[variant];
  const Icon = meta.icon;
  const isDashboard = variant === 'dashboard';

  return (
    <main role="status" aria-live="polite" className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      <span className="sr-only">{en.common.loading}</span>
      <div className={cn('mx-auto space-y-5', isDashboard ? 'max-w-6xl' : 'max-w-3xl')}>
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-2">
              <Skeleton className={cn('h-6', meta.titleWidth)} />
              <Skeleton className={cn('h-4', meta.subtitleWidth)} />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-md" />
        </header>

        <section className="grid gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
          {Array.from({ length: isDashboard ? 4 : 3 }).map((_, index) => (
            <div key={index} className="bg-card p-4">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))}
        </section>

        {isDashboard ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-12" aria-hidden="true">
              <PanelSkeleton className="md:col-span-5 lg:col-span-4" rows={3} />
              <PanelSkeleton className="md:col-span-7 lg:col-span-8" rows={3} dark />
            </section>
            <PanelSkeleton rows={4} />
          </>
        ) : (
          <PanelSkeleton rows={variant === 'notices' ? 5 : 4} />
        )}
      </div>
    </main>
  );
}

function PanelSkeleton({ className, rows, dark }: { className?: string; rows: number; dark?: boolean }) {
  return (
    <section className={cn('overflow-hidden rounded-md border border-border bg-card shadow-sm', dark && 'bg-foreground', className)} aria-hidden="true">
      <div className={cn('border-b px-4 py-3', dark ? 'border-background/10' : 'border-border bg-muted/20')}>
        <Skeleton className={cn('h-4 w-36', dark && 'bg-background/20')} />
      </div>
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className={cn('rounded-md border p-3', dark ? 'border-background/10' : 'border-border bg-muted/20')}>
            <Skeleton className={cn('h-4 w-2/3', dark && 'bg-background/20')} />
            <Skeleton className={cn('mt-2 h-3 w-1/2', dark && 'bg-background/20')} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ResidentParkingLoading() {
  return (
    <main role="status" aria-live="polite" className="flex flex-1 flex-col overflow-hidden bg-muted/30 lg:flex-row">
      <span className="sr-only">{en.common.loading}</span>
      <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8" aria-hidden="true">
        <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-5">
            {Array.from({ length: 30 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-md" />
            ))}
          </div>
        </div>
      </section>
      <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-card xl:w-96 lg:flex" aria-hidden="true">
        <div className="space-y-3 border-b border-border p-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-12 rounded-md" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="space-y-3 border-b border-border p-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-28 rounded-md" />
        </div>
        <div className="space-y-3 p-6">
          <Skeleton className="h-3 w-36" />
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-md" />
          ))}
        </div>
      </aside>
    </main>
  );
}
