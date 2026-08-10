// Title: Root Loading Boundary
// Path: src/app/loading.tsx
// Functionality: Default route-level loading UI shown while a server segment streams.

import { ResidentPortalLoading } from '@/components/resident/ResidentPortalLoading';

export default function Loading() {
  return <ResidentPortalLoading variant="dashboard" />;
}
