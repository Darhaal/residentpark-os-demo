// Title: Admin Loading Boundary
// Path: src/app/admin/loading.tsx
// Functionality: Loading UI for admin segments while server data streams.

import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';

export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="flex-1 flex flex-col items-center justify-center gap-3 p-12">
      <Spinner className="size-8 text-zinc-400" />
      <span className="text-sm font-medium text-zinc-500">{en.common.loading}</span>
    </div>
  );
}
