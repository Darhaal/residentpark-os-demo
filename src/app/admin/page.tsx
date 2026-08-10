// Title: Admin Page
// Path: src/app/admin/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

// Default admin workspace route. Reports are the first tab in the admin console.

import { permanentRedirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

export default function AdminWorkspaceDefaultPage() {
  permanentRedirect(ROUTES.admin.reports);
}
