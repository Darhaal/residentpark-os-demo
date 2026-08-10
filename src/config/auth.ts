// Title: Auth Configuration
// Path: src/config/auth.ts
// Functionality: Centralized configuration values and UI metadata for authentication workflows.

export const PASSWORD_POLICY = {
  minLength: 8,
  strengthSegments: 3,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialForStrong: true,
} as const;

export type PasswordStrengthLevel = 0 | 1 | 2 | 3;

export function isPasswordPolicySatisfied(password: string) {
  const hasLength = password.length >= PASSWORD_POLICY.minLength;
  const hasUpper = !PASSWORD_POLICY.requireUppercase || /[A-Z]/.test(password);
  const hasNumber = !PASSWORD_POLICY.requireNumber || /[0-9]/.test(password);
  return hasLength && hasUpper && hasNumber;
}

export function getPasswordStrengthLevel(password: string): PasswordStrengthLevel {
  if (!password) return 0;
  // Keep the meter aligned with the actual submit policy: a password the form would
  // reject must never rank above "Weak". Previously the meter scored raw character
  // variety, so a short password like "Ab1!" read "Strong" while submit rejected it
  // for length. Fair = meets the policy (length + uppercase + number); Strong = also
  // has a special character (per requireSpecialForStrong).
  if (!isPasswordPolicySatisfied(password)) return 1;
  if (PASSWORD_POLICY.requireSpecialForStrong && !/[^A-Za-z0-9]/.test(password)) return 2;
  return 3;
}
