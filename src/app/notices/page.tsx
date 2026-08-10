// Title: Notices (Resident)
// Path: src/app/notices/page.tsx
// Functionality: Server-loaded resident notices page. Redirects to login if not authenticated.

import { Bell } from 'lucide-react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadMyNoticesAction } from '@/actions/notices';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';
import { ResidentNoticesClient } from './ResidentNoticesClient';

const messages = en.residentNotices;

export default async function ResidentNoticesPage() {
  // Guard: unauthenticated users go to login, not a generic error page.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.login);

  const res = await loadMyNoticesAction();

  if (!res.success) {
    return <PageErrorState navTitle={messages.pageTitle} icon={Bell} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} maxWidthClassName="max-w-2xl" />;
  }

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser}>
      <ResidentNoticesClient notices={res.notices} />
    </PageShell>
  );
}
