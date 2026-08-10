// Title: Resident Account States
// Path: src/components/resident/ResidentAccountStates.tsx
// Functionality: Resident-facing restricted account states with safe account actions.

import { AlertTriangle, Clock, Lock, type LucideIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { Badge } from '@/components/ui/badge';
import { en } from '@/localization/en';

interface ResidentAccountStatesProps {
  isMissingProfile: boolean;
  isPendingApproval: boolean;
  isSuspended: boolean;
  isRejected: boolean;
}

interface StateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  helper?: string;
  tone: 'warning' | 'info' | 'destructive';
  showPendingBadge?: boolean;
}

const iconToneClasses = {
  warning: 'text-warning',
  info: 'text-info',
  destructive: 'text-destructive',
} as const;

function StateCard({ icon: Icon, title, description, helper, tone, showPendingBadge }: StateCardProps) {
  return (
    <section className="mx-auto mt-8 max-w-2xl rounded-md border border-border bg-card p-5 text-center shadow-sm sm:p-6" aria-label={title}>
      <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className={`size-5 ${iconToneClasses[tone]}`} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {helper ? <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{helper}</p> : null}
      <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {showPendingBadge ? (
          <Badge variant="info" className="px-3 py-1 text-xs font-medium">
            <Spinner className="size-3.5 text-current" />
            {en.residentDashboard.awaitingSignature}
          </Badge>
        ) : null}
        <SignOutButton
          label={en.navigation.signOut}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background shadow-sm transition-colors hover:bg-foreground/85"
        />
      </div>
    </section>
  );
}

export function ResidentAccountStates({
  isMissingProfile,
  isPendingApproval,
  isSuspended,
  isRejected,
}: ResidentAccountStatesProps) {
  return (
    <>
      {isMissingProfile && (
        <StateCard
          icon={AlertTriangle}
          title={en.residentDashboard.missingProfileTitle}
          description={en.residentDashboard.missingProfileDescription}
          helper={en.residentDashboard.missingProfileContact}
          tone="warning"
        />
      )}

      {isSuspended && (
        <StateCard
          icon={Lock}
          title={en.residentDashboard.suspendedTitle}
          description={en.residentDashboard.suspendedDescription}
          tone="destructive"
        />
      )}

      {isRejected && (
        <StateCard
          icon={Lock}
          title={en.residentDashboard.rejectedTitle}
          description={en.residentDashboard.rejectedDescription}
          tone="destructive"
        />
      )}

      {isPendingApproval && (
        <StateCard
          icon={Clock}
          title={en.residentDashboard.pendingTitle}
          description={en.residentDashboard.pendingDescription}
          tone="info"
          showPendingBadge
        />
      )}
    </>
  );
}
