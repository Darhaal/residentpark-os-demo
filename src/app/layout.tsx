// Title: Application Root Layout
// Path: src/app/layout.tsx
// Functionality: Root Next.js layout — global HTML structure, fonts, and SEO metadata.

import type { Metadata } from 'next';
import { APP_CONFIG } from '@/config/app';
import './globals.css';

export const metadata: Metadata = {
  title: APP_CONFIG.metadata.title,
  description: APP_CONFIG.metadata.description,
  robots: APP_CONFIG.metadata.robots,
  icons: {
    icon: APP_CONFIG.metadata.icon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={APP_CONFIG.locale}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
