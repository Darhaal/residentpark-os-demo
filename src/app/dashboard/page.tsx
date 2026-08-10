// Title: Dashboard Page
// Path: src/app/dashboard/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Legacy route kept for existing bookmarks and external links.
// The resident dashboard has a single canonical implementation at `/`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyDashboardPage() {
  permanentRedirect(LEGACY_REDIRECTS.dashboard);
}
