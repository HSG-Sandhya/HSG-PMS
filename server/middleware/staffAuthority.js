import User from '../models/User.js';
import Role from '../models/Role.js';
import { loadAuthUser } from './requireManage.js';

/**
 * Privilege ceiling for staff management.
 *
 * The staff endpoints can assign roles and reset passwords, so once they are
 * open to non-admins (a Hotel Manager with `manage_staff`/`edit_staff`) they
 * become an escalation path: without this guard a manager could grant
 * themselves the Administrator role or reset the owner's password.
 *
 * Rule for non-admin callers: you may not touch staff ABOVE your own role
 * hierarchy, and may not assign a role above your own hierarchy — peers are
 * allowed (lateral, not an escalation), administrators never are. Admins and
 * system admins bypass entirely.
 *
 * Must run AFTER authentication and after requireManage (which caches the
 * caller's document on `req.authUser`).
 */
const isAdminLike = (roleName = '') => {
  const n = roleName.toLowerCase();
  return n.includes('admin') || n.includes('system');
};

const forbid = (res, message) => res.status(403).json({ success: false, message });

export const enforceStaffAuthority = async (req, res, next) => {
  try {
    const u = req.user;
    if (!u) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (u.isSystemAdmin) return next();

    // Resolve the caller's role once (reusing requireManage's lookup if it ran).
    const actor = typeof u.hasPermission === 'function'
      ? u
      : (req.authUser || await loadAuthUser(u));
    if (!actor) {
      return res.status(401).json({ success: false, message: 'Invalid or inactive account.' });
    }
    req.authUser = actor;
    if (actor.isSystemAdmin || isAdminLike(actor.role?.name)) return next();

    const actorLevel = actor.role?.hierarchy || 1;

    // 1. The staff member being acted on must not outrank the caller.
    const targetId = req.params.id;
    if (targetId) {
      const target = await User.findById(targetId)
        .select('isSystemAdmin role')
        .populate('role', 'name hierarchy');
      if (!target) {
        return res.status(404).json({ success: false, message: 'Staff member not found' });
      }
      if (target.isSystemAdmin || isAdminLike(target.role?.name)) {
        return forbid(res, 'Access denied. Only an administrator can manage administrator accounts.');
      }
      if ((target.role?.hierarchy || 1) > actorLevel) {
        return forbid(res, 'Access denied. You cannot manage staff at a level above your own.');
      }
    }

    // 2. The role being granted must not outrank the caller either — otherwise
    //    the caller could promote anyone (including themselves) past their own
    //    level. An admin-named role is always off limits, whatever its level:
    //    the admin guards grant access by role name, so handing one out is a
    //    full escalation.
    const requestedRoleId = req.body?.roleId || req.body?.role;
    if (requestedRoleId) {
      const role = await Role.findById(requestedRoleId).select('name hierarchy');
      if (!role) {
        return res.status(400).json({ success: false, message: 'Invalid role specified' });
      }
      if (isAdminLike(role.name) || (role.hierarchy || 1) > actorLevel) {
        return forbid(res, `Access denied. You cannot assign the "${role.name}" role — it ranks above your own.`);
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Staff authority check failed', error: error.message });
  }
};

export default enforceStaffAuthority;
