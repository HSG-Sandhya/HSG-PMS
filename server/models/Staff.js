import mongoose from "mongoose";

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  position: { type: String, required: true, trim: true },
  department: { type: String, required: true, trim: true },

  role: {
    type: String,
    required: true,
    enum: [
      "Admin", "Manager", "Front Desk Executive", "Front Desk Manager",
      "Housekeeping Staff", "Housekeeping Supervisor",
      "Restaurant Manager", "Chef", "Waiter", "Kitchen Staff",
      "Maintenance Staff", "Security", "Accountant",
      "Sales Executive", "HR Executive"
    ]
  },

  permissions: [String],
  pageAccess: [String],
  accessLevel: { type: String, enum: ["Full", "Limited", "Read Only"], default: "Limited" },
  canLogin: { type: Boolean, default: true },

  // Contact Info
  contactNumber: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  address: String,

  // Employment
  dateOfBirth: Date,
  joiningDate: { type: Date, required: true },
  employeeId: { type: String, unique: true, sparse: true },
  salary: { type: Number, required: true },
  salaryType: { type: String, enum: ["Monthly", "Daily", "Hourly"], default: "Monthly" },

  workingHours: {
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "18:00" },
    weeklyHours: { type: Number, default: 40 }
  },
  shift: { type: String, enum: ["Morning", "Afternoon", "Night", "Flexible"], default: "Morning" },

  // Reporting structure
  reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
  subordinates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Staff" }],

  status: { type: String, enum: ["active", "inactive", "on_leave", "terminated"], default: "active" },
  performanceRating: { type: Number, min: 1, max: 5, default: 3 },

  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },

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

  documents: [{
    type: { type: String },
    fileName: String,
    filePath: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  skills: [String],
  certifications: [{
    name: String,
    issuedBy: String,
    issuedDate: Date,
    expiryDate: Date
  }],

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Auto-generate Employee ID
StaffSchema.pre("save", async function (next) {
  if (this.isNew && !this.employeeId) {
    const count = await this.constructor.countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Populate references
StaffSchema.pre(/^find/, function (next) {
  this.populate("reportsTo", "name position department")
      .populate("subordinates", "name position department");
  next();
});

// ── Role / permission catalog ────────────────────────────────────────────────

const ALL_PAGES = [
  "dashboard", "rooms", "bookings", "guests", "housekeeping",
  "restaurant", "pos", "banquet", "marriage-bookings",
  "staff", "attendance", "payroll", "banking", "reports",
  "channels", "maintenance", "invoices", "settings",
];

const ROLE_PERMISSIONS = {
  Admin: [
    "admin_access", "manage_roles", "manage_settings", "view_settings",
    "manage_bookings", "view_bookings", "manage_rooms", "view_rooms",
    "manage_guests", "view_guests", "manage_staff", "view_staff",
    "manage_housekeeping", "manage_restaurant", "manage_pos",
    "manage_payments", "view_financial_reports", "manage_events",
    "manage_channels", "manage_attendance", "manage_payroll",
    "manage_maintenance",
  ],
  Manager: [
    "view_dashboard", "manage_bookings", "view_bookings", "manage_rooms",
    "view_rooms", "manage_guests", "view_guests", "view_staff",
    "manage_housekeeping", "manage_restaurant", "manage_pos",
    "view_financial_reports", "manage_events", "view_attendance",
    "view_payroll",
  ],
  "Front Desk Executive": [
    "view_dashboard", "view_bookings", "create_bookings", "edit_bookings",
    "view_rooms", "edit_room_status", "view_guests", "create_guest_profiles",
    "edit_guest_profiles",
  ],
  "Front Desk Manager": [
    "view_dashboard", "manage_bookings", "view_bookings", "create_bookings",
    "edit_bookings", "cancel_bookings", "view_rooms", "edit_room_status",
    "assign_rooms", "manage_guests", "view_guests",
  ],
  "Housekeeping Staff": [
    "view_dashboard", "view_housekeeping_tasks", "update_room_status",
  ],
  "Housekeeping Supervisor": [
    "view_dashboard", "manage_housekeeping", "view_housekeeping_tasks",
    "assign_housekeeping", "update_room_status", "view_rooms",
  ],
  "Restaurant Manager": [
    "view_dashboard", "manage_restaurant", "view_restaurant_orders",
    "create_restaurant_orders", "manage_menu", "manage_pos",
    "process_payments", "view_transactions",
  ],
  Chef: [
    "view_dashboard", "view_restaurant_orders", "manage_menu",
  ],
  Waiter: [
    "view_dashboard", "view_restaurant_orders", "create_restaurant_orders",
    "manage_pos", "process_payments",
  ],
  "Kitchen Staff": [
    "view_dashboard", "view_restaurant_orders",
  ],
  "Maintenance Staff": [
    "view_dashboard", "view_rooms", "edit_room_status",
  ],
  Security: [
    "view_dashboard", "view_guests",
  ],
  Accountant: [
    "view_dashboard", "manage_payments", "view_financial_reports",
    "process_refunds", "manage_billing", "view_payroll",
    "view_payroll_reports",
  ],
  "Sales Executive": [
    "view_dashboard", "view_bookings", "create_bookings", "manage_events",
    "view_events",
  ],
  "HR Executive": [
    "view_dashboard", "view_staff", "manage_attendance", "view_attendance",
    "view_payroll", "view_attendance_reports",
  ],
};

const ROLE_PAGE_ACCESS = {
  Admin: ALL_PAGES,
  Manager: [
    "dashboard", "rooms", "bookings", "guests", "housekeeping",
    "restaurant", "pos", "banquet", "marriage-bookings", "reports",
    "channels", "attendance",
  ],
  "Front Desk Executive": ["dashboard", "rooms", "bookings", "guests"],
  "Front Desk Manager": ["dashboard", "rooms", "bookings", "guests", "reports"],
  "Housekeeping Staff": ["dashboard", "housekeeping"],
  "Housekeeping Supervisor": ["dashboard", "housekeeping", "rooms"],
  "Restaurant Manager": ["dashboard", "restaurant", "pos", "reports"],
  Chef: ["dashboard", "restaurant"],
  Waiter: ["dashboard", "pos", "restaurant"],
  "Kitchen Staff": ["dashboard", "restaurant"],
  "Maintenance Staff": ["dashboard", "rooms", "maintenance"],
  Security: ["dashboard"],
  Accountant: ["dashboard", "banking", "reports", "payroll", "invoices"],
  "Sales Executive": ["dashboard", "bookings", "banquet", "marriage-bookings"],
  "HR Executive": ["dashboard", "staff", "attendance", "payroll"],
};

StaffSchema.statics.getRolePermissions = function (role) {
  return ROLE_PERMISSIONS[role] || [];
};

StaffSchema.statics.getAvailablePages = function () {
  return ALL_PAGES;
};

StaffSchema.statics.getDefaultPageAccess = function (role) {
  return ROLE_PAGE_ACCESS[role] || [];
};

StaffSchema.methods.hasPermission = function (permission) {
  if (!permission) return false;
  if (this.role === "Admin") return true;
  return Array.isArray(this.permissions) && this.permissions.includes(permission);
};

export default mongoose.model("Staff", StaffSchema);
