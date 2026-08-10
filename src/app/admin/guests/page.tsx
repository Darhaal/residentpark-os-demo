// Title: Guests Page
// Path: src/app/admin/guests/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Legacy guest route. Guest parking has been retired from the active demo.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyAdminGuestsPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminGuests);
}
