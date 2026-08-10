// Title: Page Header
// Path: src/components/layout/PageHeader.tsx
// Functionality: Reusable page title, description, and action layout for application screens.

import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 pb-6', className)}>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-950 tracking-tight flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-zinc-400" />}
          {title}
        </h1>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
