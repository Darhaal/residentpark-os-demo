// Title: Resident Portal Error
// Path: src/components/resident/ResidentPortalError.tsx
// Functionality: Shared route-level error state for resident-facing pages.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';
import { logger } from '@/lib/logger';

interface ResidentPortalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  scope: string;
}

export function ResidentPortalError({ error, reset, scope }: ResidentPortalErrorProps) {
  useEffect(() => {
    logger.error('Resident portal route error boundary', error, { digest: error.digest, scope });
  }, [error, scope]);

  return (
    <main role="alert" className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8 text-center sm:px-6 lg:px-8">
      <section className="w-full max-w-lg rounded-md border border-border bg-card p-6 shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-md border border-destructive/20 bg-destructive/10">
          <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground sm:text-2xl">{en.common.error.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{en.common.error.description}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={reset} className="h-9">
            <RotateCw className="size-4" aria-hidden="true" />
            {en.common.error.retry}
          </Button>
          <Button asChild variant="outline" className="h-9">
            <Link href={ROUTES.home}>
              <Home className="size-4" aria-hidden="true" />
              {en.common.error.home}
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
