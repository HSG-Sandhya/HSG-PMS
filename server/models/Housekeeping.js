import mongoose from "mongoose";
import { OPERATIONS_DEFAULTS } from "../config/operationalDefaults.js";

const HK = OPERATIONS_DEFAULTS.housekeeping;

const housekeepingSchema = new mongoose.Schema({
  // A task targets either a guest room or a banquet hall (one is required).
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  hallId: { type: mongoose.Schema.Types.ObjectId, ref: "BanquetHall" },

  taskType: {
    // Keep in sync with TASK_TYPES in client/src/pages/operations/Housekeepings.js.
    type: String,
    enum: [
      "Regular Cleaning", "Deep Cleaning", "Checkout Cleaning", "Turndown Service",
      "Linen Change", "Restocking", "Laundry", "Inspection", "Sanitization",
      "Maintenance", "Other",
    ],
    default: HK.defaultTaskType
  },

  priority: {
    type: String,
    enum: ["Low", "Medium", "High", "Urgent"],
    default: HK.defaultPriority
  },

  status: {
    type: String,
    enum: ["Pending", "In Progress", "Completed", "Cancelled"],
    default: "Pending"
  },

  scheduledFor: { type: Date, default: Date.now },
  completedAt: { type: Date },

  // Expected time to complete (minutes). Default from Operations settings.
  estimatedMinutes: { type: Number, min: 0, default: HK.expectedCleaningMinutes },

  notes: { type: String, trim: true },

  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  // Notifications & source
  source: {
    type: String,
    enum: ["manual", "room_notification", "system", "checkout_booking", "room_status_update", "banquet_checkout"],
    default: "manual"
  },
  notificationData: mongoose.Schema.Types.Mixed,

  // Audit fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// A task must reference either a room or a banquet hall
housekeepingSchema.pre("validate", function () {
  if (!this.roomId && !this.hallId) {
    throw new Error("A housekeeping task must reference a room or a banquet hall");
  }
});

// Auto update completedAt if status is completed
housekeepingSchema.pre("save", function () {
  if (this.isModified("status") && this.status === "Completed" && !this.completedAt) {
    this.completedAt = Date.now();
  }
});

// Create a cleaning task for a room or hall, skipping if an open one already exists.
// Returns the existing or newly created task (or null when no target is given).
housekeepingSchema.statics.ensureCleaningTask = async function ({ roomId, hallId, source, notes, priority = HK.checkoutCleaningPriority, estimatedMinutes } = {}) {
  if (!roomId && !hallId) return null;

  const query = {
    taskType: HK.defaultTaskType,
    status: { $in: ["Pending", "In Progress"] },
    ...(roomId ? { roomId } : {}),
    ...(hallId ? { hallId } : {}),
  };

  const existing = await this.findOne(query);
  if (existing) return existing;

  return this.create({
    ...(roomId ? { roomId } : {}),
    ...(hallId ? { hallId } : {}),
    taskType: HK.defaultTaskType,
    notes: notes || "Cleaning required.",
    priority,
    ...(estimatedMinutes != null ? { estimatedMinutes } : {}),
    status: "Pending",
    source: source || "manual",
    scheduledFor: new Date(),
  });
};

export default mongoose.models.Housekeeping || mongoose.model("Housekeeping", housekeepingSchema);
