// Title: Resident Parking Error Boundary
// Path: src/app/parking/error.tsx
// Functionality: Route-level error state for the resident parking map.

'use client';

import { ResidentPortalError } from '@/components/resident/ResidentPortalError';

export default function ParkingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ResidentPortalError error={error} reset={reset} scope="parking" />;
}
