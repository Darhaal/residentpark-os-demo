// Title: Auth Config Test
// Path: src/config/auth.test.ts
// Functionality: Locks the password strength meter to the actual submit policy so the
//   meter can never read above "Weak" for a password the register form would reject.

import { describe, expect, it } from 'vitest';
import {
  PASSWORD_POLICY,
  getPasswordStrengthLevel,
  isPasswordPolicySatisfied,
} from './auth';

describe('password strength meter alignment', () => {
  it('returns 0 for an empty password', () => {
    expect(getPasswordStrengthLevel('')).toBe(0);
  });

  it('ranks a policy-failing password as Weak even when it is character-rich', () => {
    // "Ab1!" has upper + number + special but is too short: submit rejects it, so the
    // meter must not read Strong.
    expect(isPasswordPolicySatisfied('Ab1!')).toBe(false);
    expect(getPasswordStrengthLevel('Ab1!')).toBe(1);
  });

  it('ranks a policy-meeting password without a special char as Fair', () => {
    expect(isPasswordPolicySatisfied('Password1')).toBe(true);
    expect(getPasswordStrengthLevel('Password1')).toBe(2);
  });

  it('ranks a policy-meeting password with a special char as Strong', () => {
    expect(isPasswordPolicySatisfied('Password1!')).toBe(true);
    expect(getPasswordStrengthLevel('Password1!')).toBe(3);
  });

  it('never ranks a rejected password at or above Fair (the alignment invariant)', () => {
    const samples = ['', 'a', 'abc', 'ABC', '12345678', 'abcdefgh', 'Ab1!', 'Short1A', 'nouppercase1', 'NoNumber'];
    for (const password of samples) {
      if (!isPasswordPolicySatisfied(password)) {
        expect(getPasswordStrengthLevel(password)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the meter within the configured segment count', () => {
    expect(getPasswordStrengthLevel('Password1!')).toBeLessThanOrEqual(PASSWORD_POLICY.strengthSegments);
  });
});
