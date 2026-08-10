// Title: Routes Configuration
// Path: src/config/routes.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  authCallback: '/auth/callback',
  privacy: '/privacy',
  terms: '/terms',
  dashboard: '/dashboard',
  notices: '/notices',
  parking: '/parking',
  profile: '/profile',
  guestParking: '/guest-parking',
  resident: {
    root: '/resident',
    parking: '/resident/parking',
  },
  admin: {
    root: '/admin',
    approvals: '/admin/approvals',
    apartments: '/admin/apartments',
    vehicles: '/admin/vehicles',
    parking: '/admin/parking',
    disruptions: '/admin/disruptions',
    issues: '/admin/issues',
    notices: '/admin/notices',
    settings: '/admin/settings',
    reports: '/admin/reports',
    users: '/admin/users',
    invites: '/admin/invites',
    logs: '/admin/logs',
    dashboard: '/admin/dashboard',
    audit: '/admin/audit',
    activity: '/admin/activity',
    parkingIssues: '/admin/parking-issues',
    guestParking: '/admin/guest-parking',
    guests: '/admin/guests',
    compliance: '/admin/compliance',
    residents: '/admin/residents',
  },
} as const;

export const AUTH_ENTRY_ROUTES = [
  ROUTES.login,
  ROUTES.register,
] as const;

export const PUBLIC_ROUTES = [
  ...AUTH_ENTRY_ROUTES,
  ROUTES.resetPassword,
  ROUTES.forgotPassword,
  ROUTES.authCallback,
  ROUTES.privacy,
  ROUTES.terms,
] as const;

export const LEGACY_REDIRECTS = {
  dashboard: ROUTES.home,
  residentRoot: ROUTES.home,
  residentParking: ROUTES.parking,
  guestParking: ROUTES.home,
  adminDashboard: ROUTES.admin.reports,
  adminAudit: ROUTES.admin.logs,
  adminActivity: ROUTES.admin.logs,
  adminParkingIssues: ROUTES.admin.issues,
  adminGuests: ROUTES.admin.parking,
  adminGuestParking: ROUTES.admin.parking,
  adminCompliance: ROUTES.admin.reports,
  adminResidents: ROUTES.admin.users,
} as const;

export const pathMatchesRoute = (pathname: string, route: string) => {
  if (route === ROUTES.home) return pathname === ROUTES.home;
  return pathname === route || pathname.startsWith(`${route}/`);
};

export const pathMatchesAnyRoute = (pathname: string, routes: readonly string[]) =>
  routes.some(route => pathMatchesRoute(pathname, route));

export const isPublicRoutePath = (pathname: string) => pathMatchesAnyRoute(pathname, PUBLIC_ROUTES);

export const isAuthEntryRoutePath = (pathname: string) => pathMatchesAnyRoute(pathname, AUTH_ENTRY_ROUTES);

export const isAdminRoutePath = (pathname: string) => pathMatchesRoute(pathname, ROUTES.admin.root);

export const getSafeRedirectPath = (target: string | null | undefined) => {
  if (!target) return ROUTES.home;

  const trimmed = target.trim();
  if (!trimmed.startsWith('/')) return ROUTES.home;
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return ROUTES.home;
  if (trimmed.includes('\\')) return ROUTES.home;

  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) return ROUTES.home;
    if (decoded.includes('\\')) return ROUTES.home;
  } catch {
    return ROUTES.home;
  }

  return trimmed;
};
