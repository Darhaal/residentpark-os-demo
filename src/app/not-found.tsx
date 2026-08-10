// Title: Not Found Boundary
// Path: src/app/not-found.tsx
// Functionality: Styled 404 shown for unmatched routes and notFound() calls.

import Link from 'next/link';
import { Compass } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6 text-center text-foreground">
      <div className="grid size-12 place-items-center rounded-md border border-border bg-card shadow-sm">
        <Compass className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-5 font-mono text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">{en.common.notFound.title}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{en.common.notFound.description}</p>
      <Link
        href={ROUTES.home}
        className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {en.common.notFound.home}
      </Link>
    </main>
  );
}
