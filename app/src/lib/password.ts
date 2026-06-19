/**
 * Password policy for email sign-up. Keep this in sync with the Firebase
 * console password policy (Authentication → Settings → Password policy):
 *   - Minimum length 8, maximum 4096
 *   - Require uppercase, numeric, and special characters
 *   - (Lowercase is NOT required)
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 4096;

export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN} characters`,
    test: (p) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX,
  },
  { id: "uppercase", label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "number", label: "One number (0–9)", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character (!@#$…)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

export interface RuleStatus extends PasswordRule {
  met: boolean;
}

/** Evaluate every rule against the password (for the live checklist). */
export function checkPassword(pw: string): RuleStatus[] {
  return PASSWORD_RULES.map((r) => ({ ...r, met: r.test(pw) }));
}

/** True only when every rule is satisfied. */
export function passwordValid(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw));
}

/** Labels of the rules not yet satisfied (the "missing criteria"). */
export function missingCriteria(pw: string): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label);
}
