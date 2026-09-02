import User from '../models/User.js';

/**
 * Least-privilege guard. Requires the authenticated user to
 * hold a given permission (e.g. 'manage_rooms'), or ANY ONE of several
 * (e.g. ['manage_staff', 'edit_staff'] — the granular grant OR the umbrella one).
 * Works regardless of which auth middleware ran first:
 *   - System admins always pass.
 *   - If req.user is a hydrated User doc (DB-backed auth), its permissions are
 *     read directly.
 *   - If req.user is a decoded JWT (stateless auth), the user is loaded once to
 *     read its role permissions.
 * Must run AFTER an authentication middleware (which sets req.user).
 *
 * The loaded document is cached on `req.authUser` so later guards on the same
 * request (e.g. staffAuthority) don't re-query it.
 */
export const requireManage = (permission) => async (req, res, next) => {
  const required = Array.isArray(permission) ? permission : [permission];
  const denied = () => res.status(403).json({
    success: false,
    message: 'Access denied. Insufficient permissions.',
    required,
  });

  try {
    const u = req.user;
    if (!u) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (u.isSystemAdmin) return next();

    // Already-hydrated user document (has the model method).
    if (typeof u.hasPermission === 'function') {
      return required.some((p) => u.hasPermission(p)) ? next() : denied();
    }

    // Stateless token — load the user to read its role permissions.
    const dbUser = req.authUser || await loadAuthUser(u);
    if (!dbUser || dbUser.isActive === false) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive account.' });
    }
    req.authUser = dbUser;
    if (dbUser.isSystemAdmin) return next();

    const rolePerms = dbUser.role?.permissions || [];
    const directPerms = dbUser.permissions || [];
    const allowed = required.some((p) => rolePerms.includes(p) || directPerms.includes(p));
    return allowed ? next() : denied();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Permission check failed', error: error.message });
  }
};

/**
 * The same permission resolution as `requireManage`, but as a predicate rather
 * than a guard — for routes that stay open to everyone and instead vary WHAT
 * they return. Resolves to true if the caller holds any of `permissions`.
 *
 * Shares requireManage's `req.authUser` cache, so calling both on one request
 * costs a single lookup.
 */
export const callerHasAnyPermission = async (req, permissions) => {
  const required = Array.isArray(permissions) ? permissions : [permissions];
  try {
    const u = req.user;
    if (!u) return false;
    if (u.isSystemAdmin) return true;

    if (typeof u.hasPermission === 'function') {
      return required.some((p) => u.hasPermission(p));
    }

    const dbUser = req.authUser || await loadAuthUser(u);
    if (!dbUser || dbUser.isActive === false) return false;
    req.authUser = dbUser;
    if (dbUser.isSystemAdmin) return true;

    const rolePerms = dbUser.role?.permissions || [];
    const directPerms = dbUser.permissions || [];
    return required.some((p) => rolePerms.includes(p) || directPerms.includes(p));
  } catch {
    // Fail closed — an unresolvable caller gets the reduced view.
    return false;
  }
};

/**
 * Load the caller's User document from a decoded JWT payload, with the role
 * fields every permission/authority check needs.
 */
export const loadAuthUser = (decoded) =>
  User.findById(decoded.id || decoded.userId || decoded._id)
    .populate('role', 'name permissions hierarchy');

/**
 * The same guard, named for reads.
 *
 * Authorization was applied almost exclusively to mutations: reading every
 * guest, every staff record (salary, date of birth, home address, emergency
 * contact, Aadhaar number and its scan URLs), the accounting ledger or the
 * banking transactions needed nothing but a valid login. The UI hid those pages
 * from staff who lacked the permission, but the UI is not the security
 * boundary — a logged-in account could call the endpoint directly.
 *
 * `requireManage` reads oddly on a GET, so read routes use this alias. Same
 * implementation, same semantics: hold ANY ONE of the listed permissions. The
 * convention is to pass both the view and the manage grant —
 * `requirePermission(['view_guests', 'manage_guests'])` — so a role that can
 * edit a thing can always read it.
 */
export const requirePermission = requireManage;

export default requireManage;
