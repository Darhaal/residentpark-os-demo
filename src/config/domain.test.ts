// Title: Domain Configuration
// Path: src/config/domain.test.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

import { describe, expect, it } from 'vitest';
import { isAdminRole, isSuperadminRole, USER_ROLES } from './domain';

describe('isAdminRole', () => {
  it('is true for admin and superadmin', () => {
    expect(isAdminRole(USER_ROLES.admin)).toBe(true);
    expect(isAdminRole(USER_ROLES.superadmin)).toBe(true);
  });

  it('is false for residents and unauthenticated roles', () => {
    expect(isAdminRole(USER_ROLES.resident)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe('isSuperadminRole', () => {
  it('is true only for superadmin', () => {
    expect(isSuperadminRole(USER_ROLES.superadmin)).toBe(true);
    expect(isSuperadminRole(USER_ROLES.admin)).toBe(false);
    expect(isSuperadminRole(USER_ROLES.resident)).toBe(false);
    expect(isSuperadminRole(null)).toBe(false);
  });
});
