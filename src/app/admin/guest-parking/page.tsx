// Title: Guest Parking Page
// Path: src/app/admin/guest-parking/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Guest parking has been retired from the active demo.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function RetiredAdminGuestParkingPage() {
  permanentRedirect(LEGACY_REDIRECTS.adminGuestParking);
}
