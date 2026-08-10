// Title: App Configuration
// Path: src/config/app.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

export const APP_CONFIG = {
  name: 'ResidentPark OS',
  shortName: 'ResidentPark',
  locale: 'en',
  metadata: {
    title: 'ResidentPark OS | Enterprise Management',
    description: 'Secure, scalable parking and resident management system. Built for modern property administration.',
    robots: 'noindex, nofollow',
    icon: '/favicon.svg',
  },
} as const;
