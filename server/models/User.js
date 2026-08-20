import mongoose from "mongoose";
import { registerModel } from "../db/modelRegistry.js";
import bcrypt from "bcryptjs";
import mongoosePaginate from "mongoose-paginate-v2";

const userSchema = new mongoose.Schema({
  // Whether this staff member signs in to the app at all.
  //
  // Junior staff (housekeeping, kitchen, room attendants) are tracked for
  // attendance and payroll but never open the PMS, so issuing them a username
  // and password is pure attack surface. Their role decides this — see
  // `Role.allowsLogin()`, which defaults off below hierarchy 6.
  //
  // A record with `hasLoginAccess: false` is a personnel record only: it still
  // appears in the staff roster, attendance and payroll, but has no credentials
  // and cannot authenticate.
  hasLoginAccess: { type: Boolean, default: true },

  // Credentials are required only for staff who actually log in. `sparse` on
  // the unique index so any number of credential-less records can coexist —
  // they store no username at all rather than an empty string, which would
  // collide on the second insert.
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    required: [function () { return this.hasLoginAccess !== false; }, 'Username is required'],
  },
  // Email is optional. `sparse` so the unique index skips users who have none
  // (multiple email-less staff are allowed); the controller stores it as unset
  // rather than '' so those documents fall outside the index entirely.
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: {
    type: String,
    minlength: 6,
    select: false,
    required: [function () { return this.hasLoginAccess !== false; }, 'Password is required'],
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
    trim: true
  },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true, default: '' },

  // Role-based access
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },

  // Legacy support (fallback role string)
  legacyRole: {
    type: String,
    enum: ["admin", "frontdesk", "housekeeping", "manager", "restaurant"],
    default: "frontdesk"
  },

  permissions: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true },
  isSystemAdmin: { type: Boolean, default: false },

  profile: {
    avatar: String,
    address: String,
    dateOfBirth: Date,
    joiningDate: { type: Date, default: Date.now },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    },
    employeeId: { type: String, unique: true, sparse: true },
    salary: { type: Number, default: 0 },
    // Aadhar verification fields
    aadharNumber: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^\d{12}$/.test(v);
        },
        message: 'Aadhar number must be 12 digits'
      }
    },
    aadharFrontUrl: {
      type: String
    },
    aadharBackUrl: {
      type: String
    },
    aadharImageUrl: {
      type: String // Keep for backward compatibility
    },
    aadharVerified: {
      type: Boolean,
      default: false
    },
    aadharVerifiedAt: {
      type: Date
    },
  },

  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    preferences: {
      theme: { type: String, enum: ["light", "dark", "auto"], default: "light" },
      language: { type: String, default: "en" }
    }
  },

  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Hash password before save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare passwords
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!enteredPassword) {
    throw new Error('Password is required');
  }
  // A personnel-only record has no credentials. Fail closed rather than letting
  // bcrypt.compare run against an undefined hash — belt-and-braces, since such
  // a record also has no username to look up in the first place.
  if (this.hasLoginAccess === false || !this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name (lastName is optional, so guard against a trailing "undefined")
userSchema.methods.getFullName = function () {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
};

// Check if user has specific permission
userSchema.methods.hasPermission = function (permission) {
  // System admin has all permissions
  if (this.isSystemAdmin) return true;
  
  // Check role permissions
  if (this.role && this.role.permissions) {
    return this.role.permissions.includes(permission);
  }
  
  // Check user-specific permissions
  return this.permissions && this.permissions.includes(permission);
};

// Check if user can access specific page
userSchema.methods.canAccessPage = function (pageName, action = 'view') {
  // System admin has access to all pages
  if (this.isSystemAdmin) return true;
  
  // Check role page access
  if (this.role && this.role.accessLevel && this.role.accessLevel.pages) {
    const pagePermission = this.role.accessLevel.pages.find(p => p.page === pageName);
    if (pagePermission) {
      switch (action) {
        case 'view': return pagePermission.canView;
        case 'edit': return pagePermission.canEdit;
        case 'delete': return pagePermission.canDelete;
        default: return false;
      }
    }
  }
  
  return false;
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Hide sensitive fields in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

// Add pagination plugin
userSchema.plugin(mongoosePaginate);

// Indexes for performance
userSchema.index({ department: 1, role: 1 });
userSchema.index({ role: 1, isActive: 1 });

export default registerModel("User", userSchema);
