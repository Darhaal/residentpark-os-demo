// Title: Admin Error Boundary
// Path: src/app/admin/error.tsx
// Functionality: Client error boundary scoped to the admin segment; keeps the failure
//   contained to the admin content area and offers retry + a route back to the dashboard.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';
import { logger } from '@/lib/logger';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('Admin error boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <main role="alert" className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8 text-center text-foreground">
      <div className="grid size-12 place-items-center rounded-md border border-destructive/20 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-foreground">{en.common.adminError.title}</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{en.common.adminError.description}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={reset} className="h-10 rounded-md px-5">
          <RotateCw className="size-4" aria-hidden="true" /> {en.common.adminError.retry}
        </Button>
        <Link
          href={ROUTES.admin.root}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {en.common.adminError.dashboard}
        </Link>
      </div>
    </main>
  );
}
