/**
 * The canonical vocabulary for Staff records.
 *
 * The schema and the controller had drifted into disagreeing about both of the
 * fields below, and neither disagreement was visible until something failed:
 *
 *   status       schema: 'active' | 'inactive' | 'on_leave' | 'terminated'
 *                controller: wrote 'Active' on create, and queried for 'Active'
 *                in getStaffByRole / getStaffByDepartment. The write failed
 *                validation; the query silently matched nothing.
 *
 *   accessLevel  schema: a String enum, 'Full' | 'Limited' | 'Read Only'
 *                controller: assigned { departments, rooms, reports } — the
 *                shape Role.accessLevel uses — which is a CastError on a String
 *                path. The same property name carried two different concepts.
 *
 * Both now live here, so a literal typed in a controller cannot drift from the
 * enum the schema validates against. The two concepts are separated: the STRING
 * stays `accessLevel`, the OBJECT moves to `accessScope`.
 */

// ── Status ───────────────────────────────────────────────────────────────────
export const STAFF_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_LEAVE: 'on_leave',
  TERMINATED: 'terminated',
});

export const STAFF_STATUSES = Object.freeze(Object.values(STAFF_STATUS));

/**
 * Accept what callers actually send — 'Active', 'ACTIVE', 'On Leave',
 * 'on leave', 'on-leave' — and return the canonical value, or undefined when
 * it is not a status at all (so the enum validator still rejects nonsense
 * rather than this quietly inventing a default).
 */
export const normalizeStaffStatus = (value) => {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STAFF_STATUSES.includes(key) ? key : value;
};

// ── Access level (the STRING concept) ────────────────────────────────────────
export const ACCESS_LEVEL = Object.freeze({
  FULL: 'Full',
  LIMITED: 'Limited',
  READ_ONLY: 'Read Only',
});

export const ACCESS_LEVELS = Object.freeze(Object.values(ACCESS_LEVEL));

// ── Access scope (the OBJECT concept) ────────────────────────────────────────
export const SCOPE = Object.freeze({ ALL: 'all', DEPARTMENT: 'department', LIMITED: 'limited' });

/** The scope an administrator gets: everything. */
export const adminScope = () => ({
  departments: [SCOPE.ALL],
  rooms: SCOPE.ALL,
  reports: SCOPE.ALL,
});

/** The scope everyone else gets: their own department. */
export const departmentScope = (department) => ({
  departments: department ? [department] : [],
  rooms: SCOPE.LIMITED,
  reports: SCOPE.LIMITED,
});

export const scopeForRole = (role, department) =>
  role === 'Admin' ? adminScope() : departmentScope(department);

/**
 * The one-word summary of a scope, for the `accessLevel` string.
 * Also the rescue path for callers still sending the object shape to
 * `accessLevel` — see the setter in models/Staff.js.
 */
export const levelForScope = (scope) => {
  if (!scope || typeof scope !== 'object') return scope;
  const all = scope.rooms === SCOPE.ALL && scope.reports === SCOPE.ALL;
  return all ? ACCESS_LEVEL.FULL : ACCESS_LEVEL.LIMITED;
};

export const levelForRole = (role) =>
  role === 'Admin' ? ACCESS_LEVEL.FULL : ACCESS_LEVEL.LIMITED;
