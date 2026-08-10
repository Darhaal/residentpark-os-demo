// Title: Legal Localization
// Path: src/localization/en/legal.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const legal = {
  terms: {
    metadataTitle: 'Terms of Service | ResidentPark OS',
    title: 'Terms of Service',
    description: 'Demo terms for access requests, resident parking tools, and administrative review.',
    paragraphs: [
      'ResidentPark OS is an internal management system. Account access may require administrator approval, assigned apartment context, and building parking rules.',
      'Users should submit accurate account and vehicle information. Administrators may review, approve, suspend, archive, or audit records according to property policy.',
      'Production deployments should replace these demo terms with approved legal terms before launch.',
    ],
  },
  privacy: {
    metadataTitle: 'Privacy Policy | ResidentPark OS',
    title: 'Privacy Policy',
    description: 'Demo policy for ResidentPark OS account requests and resident parking workflows.',
    paragraphs: [
      'ResidentPark OS stores the minimum account, apartment, vehicle, parking, notice, and audit information needed to operate the property management demo.',
      'Access is role-based. Residents can see their own account and assigned parking context, while administrators can review operational records required for approvals, parking operations, and support.',
      'Production deployments should replace this demo policy with an approved legal privacy policy before launch.',
    ],
  },
  backToRegistration: 'Back to registration',
} as const;
