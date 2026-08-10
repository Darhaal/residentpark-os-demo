// Title: Common Localization
// Path: src/localization/en/common.ts
// Functionality: Shared UI strings reused across multiple screens and primitives.

export const common = {
  closeDialog: 'Close dialog',
  loading: 'Loading...',
  apartmentCombobox: {
    unitPrefix: 'Unit',
    selectUnit: 'Select unit...',
    searchPlaceholder: 'Unit #...',
    noResults: 'No units match search',
  },
  error: {
    title: 'Something went wrong',
    description: 'An unexpected error interrupted this page. You can try again, or head back to safety.',
    retry: 'Try again',
    home: 'Back to home',
  },
  adminError: {
    title: 'This section failed to load',
    description: 'An unexpected error occurred while loading this admin section. Retry, or return to the dashboard.',
    retry: 'Retry',
    dashboard: 'Back to dashboard',
  },
  notFound: {
    title: 'Page not found',
    description: 'The page you are looking for does not exist or may have been moved.',
    home: 'Back to home',
  },
} as const;
