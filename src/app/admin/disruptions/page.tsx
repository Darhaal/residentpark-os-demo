// Title: Construction & Disruptions
// Path: src/app/admin/disruptions/page.tsx
// Functionality: Server-loaded wrapper for the construction disruption workflow.

import { Construction } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadDisruptionsAction } from '@/actions/disruptions';
import { en } from '@/localization/en';
import {
  DisruptionsClient,
  type BlockedSpot,
  type Disruption,
  type Relocation,
  type Spot,
} from './DisruptionsClient';

const messages = en.adminDisruptions;

export default async function DisruptionsPage() {
  const res = await loadDisruptionsAction();

  if (!res.success) {
    return <PageErrorState navTitle={messages.navTitle} icon={Construction} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} />;
  }

  return (
    <PageShell title={messages.navTitle} currentUser={res.currentUser}>
      <DisruptionsClient
        initialDisruptions={res.disruptions as Disruption[]}
        initialRelocations={res.relocations as Relocation[]}
        initialBlockedSpots={res.blockedSpots as BlockedSpot[]}
        initialSpots={res.spots as Spot[]}
      />
    </PageShell>
  );
}
