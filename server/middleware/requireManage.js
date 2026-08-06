import User from '../models/User.js';

/**
 * Least-privilege guard for write routes. Requires the authenticated user to
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
 * Load the caller's User document from a decoded JWT payload, with the role
 * fields every permission/authority check needs.
 */
export const loadAuthUser = (decoded) =>
  User.findById(decoded.id || decoded.userId || decoded._id)
    .populate('role', 'name permissions hierarchy');

export default requireManage;
