import mongoose from "mongoose";
import crypto from "crypto";

// Character sets for auto-generated passwords. Ambiguous glyphs (I, O, l, 0, 1)
// are excluded so an admin can read the credential aloud / off a screen without
// mix-ups. Each set is sampled at least once to guarantee complexity.
const PWD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PWD_LOWER = "abcdefghijkmnpqrstuvwxyz";
const PWD_DIGIT = "23456789";
const PWD_SPECIAL = "@#$%&*?";

// Generate a cryptographically-random, unique password that is NOT derived from
// the staff member's name. Length 14, with at least one upper/lower/digit/special.
const secureRandomPassword = () => {
  const all = PWD_UPPER + PWD_LOWER + PWD_DIGIT + PWD_SPECIAL;
  const pick = (set) => set.charAt(crypto.randomInt(set.length));

  // Seed one of each class for guaranteed complexity, then fill the rest.
  const chars = [pick(PWD_UPPER), pick(PWD_LOWER), pick(PWD_DIGIT), pick(PWD_SPECIAL)];
  while (chars.length < 14) {
    chars.push(pick(all));
  }

  // Fisher–Yates shuffle with crypto randomness so the seeded classes aren't
  // always in the first four positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
};

// Generate a unique, name-independent login username, e.g. `staff7k3mp`.
// Lowercase + unambiguous digits only (no special chars — usernames are typed),
// always letter-first. Callers still de-dupe against existing usernames.
const USERNAME_CHARS = PWD_LOWER + PWD_DIGIT;
const secureRandomUsername = () => {
  let token = PWD_LOWER.charAt(crypto.randomInt(PWD_LOWER.length)); // letter-first
  for (let i = 0; i < 5; i++) {
    token += USERNAME_CHARS.charAt(crypto.randomInt(USERNAME_CHARS.length));
  }
  return `staff${token}`;
};

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },

  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },

  permissions: [{ type: String, trim: true }],
  hierarchy: { type: Number, default: 1, min: 1, max: 10 },
  isActive: { type: Boolean, default: true },

  accessLevel: {
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    rooms: { type: String, enum: ["all", "department", "assigned", "limited"], default: "limited" },
    reports: { type: String, enum: ["all", "department", "own", "limited"], default: "limited" },
    pages: [{
      page: { type: String, required: true },
      canView: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false }
    }]
  },

  settings: {
    canManageStaff: { type: Boolean, default: false },
    canViewReports: { type: Boolean, default: false },
    canManageBookings: { type: Boolean, default: false },
    maxApprovalAmount: { type: Number, default: 0 },
    canCreateUsers: { type: Boolean, default: false },
    canAssignRoles: { type: Boolean, default: false },
    canManageSettings: { type: Boolean, default: false },
    canAccessSettings: { type: Boolean, default: false },
    canManageRoles: { type: Boolean, default: false },
    canViewAllStaff: { type: Boolean, default: false },
    canEditStaffProfiles: { type: Boolean, default: false },
    canDeactivateStaff: { type: Boolean, default: false }
  },

  // User account settings
  userAccountSettings: {
    canHaveUserAccount: { type: Boolean, default: true },
    defaultPasswordPattern: { type: String, default: "[firstName][0-3][random4]" },
    forcePasswordChange: { type: Boolean, default: true },
    passwordExpiryDays: { type: Number, default: 90 },
    usernamePattern: { type: String, default: "[firstName].[lastName]" }
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Methods
roleSchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

roleSchema.methods.canAccessPage = function (pageName, action = "view") {
  const pagePermission = this.accessLevel.pages.find(p => p.page === pageName);
  if (!pagePermission) return false;

  switch (action) {
    case "view": return pagePermission.canView;
    case "edit": return pagePermission.canEdit;
    case "delete": return pagePermission.canDelete;
    default: return false;
  }
};

// Generate an auto-assigned login username for a new staff account.
//
// Deliberately ignores firstName/lastName: usernames are a random unique token
// (e.g. `staff7k3mp`), never the staff member's name. The name params are kept
// only for backward-compatible call signatures. Callers de-dupe against
// existing usernames before saving.
roleSchema.methods.generateUsername = function(/* firstName, lastName */) {
  return secureRandomUsername();
};

// Generate an auto-assigned password for a new/reset staff account.
//
// Deliberately ignores firstName/lastName: passwords are a cryptographically
// random unique combination, never the staff member's name plus a number. The
// name params are kept only for backward-compatible call signatures.
roleSchema.methods.generatePassword = function(/* firstName, lastName */) {
  return secureRandomPassword();
};

roleSchema.methods.toPublic = function () {
  const role = this.toObject();
  return {
    id: role._id,
    name: role.name,
    description: role.description,
    permissions: role.permissions,
    hierarchy: role.hierarchy,
    isActive: role.isActive,
    accessLevel: role.accessLevel,
    settings: role.settings,
    userAccountSettings: role.userAccountSettings
  };
};

export default mongoose.model("Role", roleSchema);
