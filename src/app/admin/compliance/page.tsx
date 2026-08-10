// Title: Compliance Page
// Path: src/app/admin/compliance/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Compliance has been retired from the active demo until the business rules are redesigned.

import { permanentRedirect } from 'next/navigation';
import { LEGACY_REDIRECTS } from '@/config/routes';

export default function RetiredCompliancePage() {
  permanentRedirect(LEGACY_REDIRECTS.adminCompliance);
}
