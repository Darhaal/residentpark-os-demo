// Title: Parking Issues Page
// Path: src/app/admin/parking-issues/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Legacy parking issues route. The triage queue is canonical at `/admin/issues`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyParkingIssuesPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminParkingIssues);
}
