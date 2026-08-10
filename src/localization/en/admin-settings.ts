// Title: Admin Settings Localization
// Path: src/localization/en/admin-settings.ts
// Functionality: English localization strings for application screens, actions, and empty states.

// The admin "Settings" slot now hosts account settings (see src/app/admin/settings).
// Only the portal-banner action-error strings used by src/actions/settings.ts remain here.
export const adminSettings = {
  actionErrors: {
    loadSettings: 'Failed to load resident portal banner.',
    updateSettings: 'Failed to update resident portal banner.',
  },
} as const;
