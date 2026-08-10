// Title: Profile Localization
// Path: src/localization/en/profile.ts
// Functionality: English localization strings for profile screens, actions, and empty states.

export const profile = {
  pageTitle: 'My Profile',
  pageDescription: 'Manage your contact details, password, and verified email settings.',
  signOut: 'Sign out',

  // ── Personal information ──────────────────────────────────────────────
  infoTitle: 'Personal Information',
  emailLabel: 'Email',
  emailReadOnlyHint: 'Email changes require identity verification — use the Security section below.',
  nameLabel: 'Full Name',
  namePlaceholder: 'Your full name',
  phoneLabel: 'Phone (optional)',
  phonePlaceholder: '+1 555 000 0000',
  saveChanges: 'Save changes',
  saveSuccess: 'Profile updated.',
  saveErrorFallback: 'Update failed.',

  // ── Password ──────────────────────────────────────────────────────────
  passwordTitle: 'Change Password',
  currentPasswordLabel: 'Current password',
  newPasswordLabel: 'New password (min. 8 characters)',
  confirmPasswordLabel: 'Confirm new password',
  updatePassword: 'Update password',
  passwordTooShort: 'New password must be at least 8 characters.',
  passwordMismatch: 'Passwords do not match.',
  passwordWrong: 'Current password is incorrect.',
  passwordSuccess: 'Password updated. You can now sign in with your new password.',

  // ── Email change ──────────────────────────────────────────────────────
  emailChangeTitle: 'Change Email',
  currentEmailPrefix: 'Current email:',
  newEmailLabel: 'New email address',
  newEmailPlaceholder: 'new@example.com',
  sendConfirmation: 'Send confirmation',
  invalidEmail: 'Enter a valid email address.',
  sameEmail: 'This is already your current email.',
  emailConfirmationSent: (email: string) =>
    `Confirmation sent to ${email}. Check both inboxes and click the link to complete the change.`,
} as const;
