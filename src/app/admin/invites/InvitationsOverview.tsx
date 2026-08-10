// Title: Invitations Workspace Overview
// Path: src/app/admin/invites/InvitationsOverview.tsx
// Functionality: Presents the page header, visible-record summary, and keyboard-operable workflow tabs.

import type { KeyboardEvent } from 'react';
import {
  ClipboardList,
  List,
  MailQuestion,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import type { InvitationsTab, InvitationStats } from './invites-types';

const messages = en.invitations;

interface InvitationsOverviewProps {
  activeTab: InvitationsTab;
  stats: InvitationStats;
  onTabChange: (tab: InvitationsTab) => void;
}

export function InvitationsOverview({ activeTab, stats, onTabChange }: InvitationsOverviewProps) {
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: InvitationsTab) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextTab: InvitationsTab = tab === 'import' ? 'directory' : 'import';
    onTabChange(nextTab);
    requestAnimationFrame(() => document.getElementById(`invitations-${nextTab}-tab`)?.focus());
  };

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
            <UploadCloud className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
            <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{messages.pageDescription}</p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit bg-card">
          <MailQuestion className="size-3" aria-hidden="true" />
          {messages.manualDeliveryBadge}
        </Badge>
      </header>

      <section className="grid gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-2 lg:grid-cols-4" aria-label={messages.summaryAria}>
        <SummaryCell icon={ClipboardList} label={messages.summary.visible} value={stats.total} />
        <SummaryCell icon={MailQuestion} label={messages.summary.pending} value={stats.pending} tone={stats.pending ? 'info' : undefined} />
        <SummaryCell icon={ShieldCheck} label={messages.summary.accepted} value={stats.accepted} tone={stats.accepted ? 'success' : undefined} />
        <SummaryCell icon={List} label={messages.summary.closed} value={stats.closed} tone={stats.closed ? 'warning' : undefined} />
      </section>

      <div className="rounded-md border border-border bg-muted/50 p-1 shadow-sm" role="tablist" aria-label={messages.tabsAria}>
        <div className="grid gap-1 sm:grid-cols-2">
          <TabButton
            tab="import"
            active={activeTab === 'import'}
            icon={UploadCloud}
            label={messages.tabs.import}
            description={messages.tabs.importDescription}
            onClick={onTabChange}
            onKeyDown={handleTabKeyDown}
          />
          <TabButton
            tab="directory"
            active={activeTab === 'directory'}
            icon={List}
            label={messages.tabs.directory}
            description={messages.tabs.directoryDescription}
            onClick={onTabChange}
            onKeyDown={handleTabKeyDown}
          />
        </div>
      </div>
    </>
  );
}

function SummaryCell({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'info';
}) {
  const toneClass = tone === 'success'
    ? 'text-success'
    : tone === 'warning'
      ? 'text-warning'
      : tone === 'info'
        ? 'text-info'
        : 'text-foreground';

  return (
    <div className="min-h-[92px] bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={cn('text-2xl font-semibold tabular-nums', toneClass)}>{value}</div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
        </div>
        <span className="flex size-8 items-center justify-center rounded-md border border-border bg-muted/20">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  icon: Icon,
  label,
  description,
  onClick,
  onKeyDown,
}: {
  tab: InvitationsTab;
  active: boolean;
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: (tab: InvitationsTab) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tab: InvitationsTab) => void;
}) {
  return (
    <button
      id={`invitations-${tab}-tab`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`invitations-${tab}-panel`}
      tabIndex={active ? 0 : -1}
      onClick={() => onClick(tab)}
      onKeyDown={(event) => onKeyDown(event, tab)}
      className={cn(
        'flex min-h-16 items-center gap-3 rounded-sm px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
