// Title: Global Error Boundary
// Path: src/app/global-error.tsx
// Functionality: Last-resort boundary that catches errors in the root layout itself.
//   It must render its own <html>/<body>, so it stays intentionally self-contained.

'use client';

import { useEffect } from 'react';
import { en } from '@/localization/en';
import { logger } from '@/lib/logger';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('Global error boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-muted/30 font-sans text-foreground antialiased">
        <main role="alert" className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-3xl font-semibold text-foreground">{en.common.error.title}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{en.common.error.description}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {en.common.error.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
