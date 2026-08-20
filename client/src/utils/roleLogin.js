/**
 * Whether staff on a given role sign in to the PMS.
 *
 * MUST match `roleAllowsLogin()` in server/models/Role.js — the server is the
 * authority, and this copy exists only so the UI doesn't offer a credentials
 * switch for a role the server will refuse to issue credentials for.
 *
 * Junior staff (housekeeping, kitchen, room attendants) are personnel records
 * only: tracked for attendance and payroll, with no credentials to issue, leak
 * or reset. Roles at level 6 and above sign in by default; below that they
 * don't, unless the role explicitly overrides it — which is how front desk at
 * level 5 keeps the login it needs for check-in.
 */
export const LOGIN_HIERARCHY_THRESHOLD = 6;

export const roleAllowsLogin = (role) => {
  if (!role) return false;
  const explicit = role.userAccountSettings?.canHaveUserAccount;
  if (typeof explicit === 'boolean') return explicit;
  return (role.hierarchy || 1) >= LOGIN_HIERARCHY_THRESHOLD;
};

// Why a role does or doesn't sign in, for tooltips and helper text.
export const loginRuleReason = (role) => {
  if (!role) return '';
  const explicit = role.userAccountSettings?.canHaveUserAccount;
  const level = role.hierarchy || 1;
  if (typeof explicit === 'boolean') {
    return explicit
      ? `Login enabled for this role${level < LOGIN_HIERARCHY_THRESHOLD ? ` (overrides the level ${LOGIN_HIERARCHY_THRESHOLD} rule)` : ''}.`
      : `Login disabled for this role${level >= LOGIN_HIERARCHY_THRESHOLD ? ` (overrides the level ${LOGIN_HIERARCHY_THRESHOLD} rule)` : ''}.`;
  }
  return level >= LOGIN_HIERARCHY_THRESHOLD
    ? `Signs in by default — level ${level} is at or above ${LOGIN_HIERARCHY_THRESHOLD}.`
    : `No login by default — level ${level} is below ${LOGIN_HIERARCHY_THRESHOLD}.`;
};

export default roleAllowsLogin;
