// Title: Dashboard Page
// Path: src/app/admin/dashboard/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Legacy admin dashboard route. Reports are the default admin workspace tab.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyAdminDashboardPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminDashboard);
}
