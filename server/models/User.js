import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import mongoosePaginate from "mongoose-paginate-v2";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{10}$/, "Phone number must be 10 digits"],
    trim: true
  },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },

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
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get full name
userSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName}`.trim();
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

export default mongoose.model("User", userSchema);
