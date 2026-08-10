// Title: Residents Page
// Path: src/app/admin/residents/page.tsx
// Functionality: Next.js route page for resident workflows and screen composition.

// Legacy residents route. Identity management is canonical at `/admin/users`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyAdminResidentsPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminResidents);
}
