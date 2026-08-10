// Title: Privacy Page
// Path: src/app/privacy/page.tsx
// Functionality: Next.js route page for application workflows and screen composition.

import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { en } from '@/localization/en';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = {
  title: en.legal.privacy.metadataTitle,
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
      <Card className="mx-auto max-w-3xl border-zinc-200/70 bg-white/90 shadow-xl">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl font-bold tracking-tight">{en.legal.privacy.title}</CardTitle>
          <CardDescription>
            {en.legal.privacy.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-6 text-zinc-600">
          {en.legal.privacy.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <Link href={ROUTES.register} className="inline-flex font-semibold text-zinc-900 underline-offset-4 hover:underline">
            {en.legal.backToRegistration}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
