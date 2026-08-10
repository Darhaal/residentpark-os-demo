// Title: Notifications Localization
// Path: src/localization/en/notifications.ts
// Functionality: English localization strings for application screens, actions, and empty states.

export const notificationBell = {
  ariaLabel: 'Notifications',
  title: 'Notifications',
  markAllRead: 'Mark all read',
  allClearTitle: 'All clear',
  allClearDescription: 'No pending notifications',
  viewAll: 'View all',
  sections: {
    incidents: 'Incidents',
    pendingAccounts: 'Pending Accounts',
    pendingVehicles: 'Pending Vehicles',
  },
  issueLabels: {
    unauthorizedVehicle: 'Unauthorized vehicle',
    wrongPlate: 'Wrong plate',
    blockedAccess: 'Blocked access',
    damaged: 'Damage reported',
    maintenance: 'Maintenance concern',
    safety: 'Safety concern',
    other: 'Issue reported',
  },
  unnamedResident: 'Unnamed resident',
  unitPrefix: 'Unit',
  time: {
    justNow: 'Just now',
    minuteSuffix: 'm ago',
    hourSuffix: 'h ago',
    daySuffix: 'd ago',
    yesterday: 'Yesterday',
  },
} as const;
