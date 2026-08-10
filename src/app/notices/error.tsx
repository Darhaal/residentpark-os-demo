// Title: Resident Notices Error Boundary
// Path: src/app/notices/error.tsx
// Functionality: Route-level error state for resident notices.

'use client';

import { ResidentPortalError } from '@/components/resident/ResidentPortalError';

export default function NoticesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ResidentPortalError error={error} reset={reset} scope="notices" />;
}
