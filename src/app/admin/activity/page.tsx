// Title: Activity Page
// Path: src/app/admin/activity/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Legacy activity route. Audit logs are canonical at `/admin/logs`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyAdminActivityPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminActivity);
}
