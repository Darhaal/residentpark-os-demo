// Title: Approvals Workspace Overview
// Path: src/app/admin/approvals/ApprovalsOverview.tsx
// Functionality: Presents approval queue context, metrics, and keyboard-operable queue tabs.

import type { KeyboardEvent } from 'react';
import { Building2, Car, PlusCircle, ShieldCheck, User, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ADMIN_APPROVALS_CONFIG } from '@/config/admin-clients';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import type { ApprovalTab } from './approvals-types';

const messages = en.adminApprovals;
const tabs = ADMIN_APPROVALS_CONFIG.tabs;

interface ApprovalsOverviewProps {
  accountCount: number;
  activeTab: ApprovalTab;
  apartmentCount: number;
  vehicleCount: number;
  onAddVehicle: () => void;
  onTabChange: (tab: ApprovalTab) => void;
}

export function ApprovalsOverview({
  accountCount,
  activeTab,
  apartmentCount,
  vehicleCount,
  onAddVehicle,
  onTabChange,
}: ApprovalsOverviewProps) {
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: ApprovalTab) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextTab = tab === tabs.accounts ? tabs.vehicles : tabs.accounts;
    onTabChange(nextTab);
    requestAnimationFrame(() => document.getElementById(`approvals-${nextTab}-tab`)?.focus());
  };

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
          </div>
        </div>
        {activeTab === tabs.vehicles && (
          <Button type="button" onClick={onAddVehicle} className="w-full md:w-auto">
            <PlusCircle className="size-4" aria-hidden="true" />
            {messages.addRequest}
          </Button>
        )}
      </header>

      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-3" aria-label={messages.summaryAria}>
        <QueueMetric icon={User} label={messages.summary.accounts} value={accountCount} />
        <QueueMetric icon={Car} label={messages.summary.vehicles} value={vehicleCount} />
        <QueueMetric icon={Building2} label={messages.summary.units} value={apartmentCount} />
      </section>

      <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/50 p-1 shadow-sm sm:w-fit sm:flex-row" role="tablist" aria-label={messages.tabsAria}>
        <QueueTab
          tab={tabs.accounts}
          icon={User}
          label={messages.tabs.accounts}
          count={accountCount}
          active={activeTab === tabs.accounts}
          onClick={onTabChange}
          onKeyDown={handleTabKeyDown}
        />
        <QueueTab
          tab={tabs.vehicles}
          icon={Car}
          label={messages.tabs.vehicles}
          count={vehicleCount}
          active={activeTab === tabs.vehicles}
          onClick={onTabChange}
          onKeyDown={handleTabKeyDown}
        />
      </div>
    </>
  );
}

function QueueMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function QueueTab({
  tab,
  icon: Icon,
  label,
  count,
  active,
  onClick,
  onKeyDown,
}: {
  tab: ApprovalTab;
  icon: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: (tab: ApprovalTab) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tab: ApprovalTab) => void;
}) {
  return (
    <button
      id={`approvals-${tab}-tab`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`approvals-${tab}-panel`}
      tabIndex={active ? 0 : -1}
      onClick={() => onClick(tab)}
      onKeyDown={(event) => onKeyDown(event, tab)}
      className={cn(
        'flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-w-36',
        active
          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
          : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>{label}</span>
      {count > 0 && (
        <span className={cn(
          'rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
          active ? 'bg-muted text-foreground' : 'bg-destructive/12 text-destructive',
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
