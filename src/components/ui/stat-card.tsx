// Title: UI Stat Card Component
// Path: src/components/ui/stat-card.tsx
// Functionality: Shared metric card for compact operational counts and status summaries.

import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

type StatTone = 'success' | 'destructive' | 'warning' | 'info';

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: StatTone;
  className?: string;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
}

const toneClass: Record<StatTone, string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};

export function StatCard({ label, value, tone, className, icon: Icon, iconClassName }: StatCardProps) {
  return (
    <div className={cn('rounded-md border border-border bg-card p-4 shadow-sm', className)}>
      <div className={cn(Icon && 'flex items-center gap-3')}>
        {Icon && <Icon className={cn('size-5 text-muted-foreground', tone && toneClass[tone], iconClassName)} />}
        <div>
          <div className={cn('text-2xl font-semibold tabular-nums text-foreground', tone && toneClass[tone])}>{value}</div>
          <div className="mt-0.5 text-xs font-medium uppercase text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}
