// Title: Property Directory
// Path: src/app/admin/apartments/page.tsx
// Functionality: Server-loaded wrapper for the apartment directory.

import { Building } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadApartmentsDirectoryAction } from '@/actions/loaders';
import { en as locale } from '@/localization/en';
import { ApartmentsClient, type ApartmentListItem } from './ApartmentsClient';

export default async function ApartmentsPage() {
  const messages = locale.adminApartments;
  const res = await loadApartmentsDirectoryAction();

  if (!res.success) {
    return <PageErrorState navTitle={messages.pageTitle} icon={Building} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} />;
  }

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser}>
      <ApartmentsClient initialApartments={(res.apartments || []) as ApartmentListItem[]} />
    </PageShell>
  );
}
