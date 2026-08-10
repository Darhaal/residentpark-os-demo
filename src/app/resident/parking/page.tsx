// Title: Parking Page
// Path: src/app/resident/parking/page.tsx
// Functionality: Next.js route page for resident workflows and screen composition.

// Legacy resident parking route. The canonical parking map lives at `/parking`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyResidentParkingPage() {
  permanentRedirect(LEGACY_REDIRECTS.residentParking);
}
