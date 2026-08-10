// Title: Audit Page
// Path: src/app/admin/audit/page.tsx
// Functionality: Next.js route page for audit log workflows and screen composition.

// Legacy audit route. Audit logs are canonical at `/admin/logs`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyAdminAuditPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminAudit);
}
