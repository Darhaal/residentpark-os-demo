// Title: Admin Side Panel
// Path: src/components/admin/AdminSidePanel.tsx
// Functionality: Always-open admin workspace navigation with grouped sections and active route state.

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import {
  type AdminNavigationTab,
  getVisibleAdminTabs,
  isAdminNavigationTabActive,
} from '@/config/admin-navigation';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';

interface AdminSidePanelProps {
  isSuperadmin: boolean;
}

type AdminGroup = AdminNavigationTab['group'];

const messages = en.navigation.adminPanel;
const groupOrder: AdminGroup[] = ['workspace', 'operations', 'records', 'system'];

export function AdminSidePanel({ isSuperadmin }: AdminSidePanelProps) {
  const pathname = usePathname();

  const visibleTabs = useMemo(() => getVisibleAdminTabs(isSuperadmin), [isSuperadmin]);
  const groupedTabs = useMemo(
    () => groupOrder
      .map(group => ({
        group,
        label: messages.groups[group],
        tabs: visibleTabs.filter(tab => tab.group === group),
      }))
      .filter(section => section.tabs.length > 0),
    [visibleTabs],
  );

  // The panel is permanently open on md+ screens — there is no collapse toggle.
  return (
    <aside
      id="admin-side-panel"
      className="fixed bottom-0 left-0 top-14 z-40 hidden w-64 flex-col overflow-hidden border-r border-zinc-200 bg-white shadow-[1px_0_0_rgba(24,24,27,0.02)] md:flex"
    >
      <div className="flex h-14 shrink-0 items-center border-b border-zinc-100 px-3">
        <div className="min-w-0 pl-1">
          <p className="truncate text-sm font-bold text-zinc-950">{messages.title}</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{messages.subtitle}</p>
        </div>
      </div>

      <nav id="admin-side-panel-navigation" className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3" aria-label={en.navigation.adminSections}>
        <div className="space-y-5">
          {groupedTabs.map((section) => (
            <div key={section.group}>
              <div className="mb-1 h-5 px-3 text-[10px] font-bold uppercase leading-5 tracking-wider text-zinc-400">
                {section.label}
              </div>

              <div className="space-y-1">
                {section.tabs.map(tab => {
                  const isActive = isAdminNavigationTabActive(pathname, tab.href);
                  const Icon = tab.icon;

                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-label={tab.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex h-10 w-full items-center gap-3 overflow-hidden rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1',
                        isActive
                          ? 'bg-zinc-950 text-white shadow-sm'
                          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950',
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-700',
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-colors', isActive ? 'text-white/55' : 'text-zinc-300 group-hover:text-zinc-500')} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
