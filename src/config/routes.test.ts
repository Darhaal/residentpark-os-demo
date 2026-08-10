// Title: Routes Configuration Test
// Path: src/config/routes.test.ts
// Functionality: Unit coverage for route matching and safe redirect helpers.

import { describe, expect, it } from 'vitest';
import {
  getSafeRedirectPath,
  isAdminRoutePath,
  isAuthEntryRoutePath,
  isPublicRoutePath,
  pathMatchesRoute,
  ROUTES,
} from './routes';

describe('pathMatchesRoute', () => {
  it('matches exact routes and nested route segments', () => {
    expect(pathMatchesRoute('/admin', ROUTES.admin.root)).toBe(true);
    expect(pathMatchesRoute('/admin/reports', ROUTES.admin.root)).toBe(true);
  });

  it('does not match prefix lookalikes', () => {
    expect(pathMatchesRoute('/administer', ROUTES.admin.root)).toBe(false);
    expect(pathMatchesRoute('/login-anything', ROUTES.login)).toBe(false);
  });

  it('keeps the home route exact', () => {
    expect(pathMatchesRoute('/', ROUTES.home)).toBe(true);
    expect(pathMatchesRoute('/parking', ROUTES.home)).toBe(false);
  });
});

describe('route groups', () => {
  it('matches public routes only on path boundaries', () => {
    expect(isPublicRoutePath('/login')).toBe(true);
    expect(isPublicRoutePath('/login/help')).toBe(true);
    expect(isPublicRoutePath('/login-anything')).toBe(false);
  });

  it('keeps auth entry routes narrower than all public routes', () => {
    expect(isAuthEntryRoutePath('/register')).toBe(true);
    expect(isAuthEntryRoutePath('/reset-password')).toBe(false);
  });

  it('matches admin routes only on path boundaries', () => {
    expect(isAdminRoutePath('/admin')).toBe(true);
    expect(isAdminRoutePath('/admin/users')).toBe(true);
    expect(isAdminRoutePath('/administrator')).toBe(false);
  });
});

describe('getSafeRedirectPath', () => {
  it('allows same-origin absolute paths', () => {
    expect(getSafeRedirectPath('/parking')).toBe('/parking');
    expect(getSafeRedirectPath('  /admin/reports?tab=vehicles#summary  ')).toBe('/admin/reports?tab=vehicles#summary');
  });

  it('rejects external and protocol-relative targets', () => {
    expect(getSafeRedirectPath('https://example.com')).toBe(ROUTES.home);
    expect(getSafeRedirectPath('//example.com')).toBe(ROUTES.home);
    expect(getSafeRedirectPath('/%2Fexample.com')).toBe(ROUTES.home);
  });

  it('rejects backslash redirect tricks', () => {
    expect(getSafeRedirectPath('/\\example.com')).toBe(ROUTES.home);
    expect(getSafeRedirectPath('/%5Cexample.com')).toBe(ROUTES.home);
  });

  it('rejects missing and malformed targets', () => {
    expect(getSafeRedirectPath(null)).toBe(ROUTES.home);
    expect(getSafeRedirectPath('')).toBe(ROUTES.home);
    expect(getSafeRedirectPath('%E0%A4%A')).toBe(ROUTES.home);
  });
});
