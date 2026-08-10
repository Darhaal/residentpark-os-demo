// Title: Unified Approvals Center
// Path: src/app/admin/approvals/page.tsx
// Functionality: Server-loaded wrapper for account and vehicle approvals.

import { ShieldCheck } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadPendingApprovalsAction } from '@/actions/loaders';
import { type ExtendedApartmentObj } from '@/components/shared/VehicleForm';
import { en as locale } from '@/localization/en';
import { ApprovalsClient, type PendingAccount, type PendingVehicle } from './ApprovalsClient';

export default async function ApprovalsPage() {
  const messages = locale.adminApprovals;
  const res = await loadPendingApprovalsAction();

  if (!res.success) {
    return <PageErrorState navTitle={messages.pageTitle} icon={ShieldCheck} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} />;
  }

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser} className="relative overflow-hidden">
      <ApprovalsClient
        initialPendingAccounts={res.pendingAccounts as PendingAccount[]}
        initialPendingVehicles={res.pendingVehicles as PendingVehicle[]}
        initialApartments={res.apartments as ExtendedApartmentObj[]}
      />
    </PageShell>
  );
}
