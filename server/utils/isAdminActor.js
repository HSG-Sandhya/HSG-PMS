/**
 * "Is this caller an administrator?" — decided by identity and grants, never by
 * the role's display name.
 *
 * The previous checks were substring matches on `role.name`:
 *
 *     name.includes('admin') || name.includes('system')
 *
 * which quietly promotes anything a hotel happens to call "System Auditor",
 * "System Operator" or "Assistant Administrator" to full administrator. A role
 * name is a label an admin can type into a form; it is not a security identity.
 *
 * The substring existed for a real reason — an exact `=== 'admin'` test locked
 * out the genuine "Super Admin" / "System Administrator" roles — but the fix for
 * that is to read the grants, not to widen the string match.
 *
 * Equivalent on current data: "Super Admin" is the only role holding these
 * permissions and also the only one the substring matched, so no existing
 * account changes access.
 */

const ADMIN_PERMISSIONS = ['admin_access', 'system_administration'];

/**
 * @param {object} actor  req.user — either a decoded JWT (permissions array in
 *                        the token) or a hydrated User document (role populated).
 */
export const isAdminActor = (actor) => {
  if (!actor) return false;

  // The only immutable identity marker.
  if (actor.isSystemAdmin === true) return true;

  // Hydrated document: ask the model.
  if (typeof actor.hasPermission === 'function') {
    return ADMIN_PERMISSIONS.some((p) => actor.hasPermission(p));
  }

  // Stateless token, or a lean object: role grants plus user-specific extras.
  const granted = [
    ...(actor.role?.permissions || []),
    ...(actor.permissions || []),
  ];
  return ADMIN_PERMISSIONS.some((p) => granted.includes(p));
};

/**
 * Whether a ROLE document confers administrator status. Used where the subject
 * is a role rather than a person — e.g. refusing to hand out an admin role, or
 * protecting an admin account from being edited by a lesser one.
 *
 * Requires `permissions` to be selected on the document; a projection that
 * omits it would silently answer "not an admin".
 */
export const isAdminRole = (role) =>
  Array.isArray(role?.permissions) && ADMIN_PERMISSIONS.some((p) => role.permissions.includes(p));

export default isAdminActor;
