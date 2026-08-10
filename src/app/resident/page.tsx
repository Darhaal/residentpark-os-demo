// Title: Resident Page
// Path: src/app/resident/page.tsx
// Functionality: Next.js route page for resident workflows and screen composition.

// Legacy resident route. The resident dashboard is canonical at `/`.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function LegacyResidentPage() {
  permanentRedirect(LEGACY_REDIRECTS.residentRoot);
}
