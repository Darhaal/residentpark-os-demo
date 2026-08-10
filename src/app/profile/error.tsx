// Title: Profile Error Boundary
// Path: src/app/profile/error.tsx
// Functionality: Route-level error state for the resident profile page.

'use client';

import { ResidentPortalError } from '@/components/resident/ResidentPortalError';

export default function ProfileError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ResidentPortalError error={error} reset={reset} scope="profile" />;
}
