// Title: Notices (Admin)
// Path: src/app/admin/notices/page.tsx
// Functionality: Server-loaded admin notices page.

import { Megaphone } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadAdminNoticesAction } from '@/actions/notices';
import { loadSettingsAction } from '@/actions/settings';
import { en } from '@/localization/en';
import { AdminNoticesClient } from './AdminNoticesClient';

const messages = en.adminNotices;

export default async function AdminNoticesPage() {
  const [res, settingsRes] = await Promise.all([loadAdminNoticesAction(), loadSettingsAction()]);

  if (!res.success) {
    return <PageErrorState navTitle={messages.pageTitle} icon={Megaphone} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} />;
  }

  const portalNotice = settingsRes.success ? (settingsRes.settings?.resident_portal_notice ?? '') : '';
  const settingsReady = settingsRes.success ? settingsRes.settingsTableReady : false;

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser}>
      <AdminNoticesClient
        notices={res.notices}
        apartments={res.apartments}
        residents={res.residents}
        portalNotice={portalNotice}
        settingsReady={settingsReady}
      />
    </PageShell>
  );
}
