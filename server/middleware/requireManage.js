import User from '../models/User.js';

/**
 * Least-privilege guard for write routes. Requires the authenticated user to
 * hold a given permission (e.g. 'manage_rooms'). Works regardless of which auth
 * middleware ran first:
 *   - System admins always pass.
 *   - If req.user is a hydrated User doc (DB-backed auth), its permissions are
 *     read directly.
 *   - If req.user is a decoded JWT (stateless auth), the user is loaded once to
 *     read its role permissions.
 * Must run AFTER an authentication middleware (which sets req.user).
 */
export const requireManage = (permission) => async (req, res, next) => {
  try {
    const u = req.user;
    if (!u) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (u.isSystemAdmin) return next();

    // Already-hydrated user document (has the model method).
    if (typeof u.hasPermission === 'function') {
      return u.hasPermission(permission)
        ? next()
        : res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.', required: [permission] });
    }

    // Stateless token — load the user to read its role permissions.
    const userId = u.id || u.userId || u._id;
    const dbUser = await User.findById(userId).populate('role', 'permissions');
    if (!dbUser || dbUser.isActive === false) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive account.' });
    }
    if (dbUser.isSystemAdmin) return next();

    const rolePerms = dbUser.role?.permissions || [];
    const directPerms = dbUser.permissions || [];
    const allowed = rolePerms.includes(permission) || directPerms.includes(permission);
    return allowed
      ? next()
      : res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.', required: [permission] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Permission check failed', error: error.message });
  }
};

export default requireManage;
