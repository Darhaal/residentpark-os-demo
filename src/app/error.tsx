// Title: Root Error Boundary
// Path: src/app/error.tsx
// Functionality: Client error boundary for the root resident segment.

'use client';

import { ResidentPortalError } from '@/components/resident/ResidentPortalError';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ResidentPortalError error={error} reset={reset} scope="root" />;
}
