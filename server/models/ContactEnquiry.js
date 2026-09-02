import mongoose from "mongoose";

import { registerModel } from "../db/modelRegistry.js";

/**
 * An enquiry from the public contact form.
 *
 * The endpoint used to console.log the request body and answer "we will get
 * back to you soon" — a promise nobody could keep, because the message reached
 * server stdout and nothing else. Worse, the body is a member of the public
 * giving their name, email and phone, so the one thing it did do was copy
 * personal data into the log files.
 *
 * Fields mirror the website form (firstName, lastName, email, phone, subject,
 * message). `status` exists so reception can work through them rather than
 * re-reading the whole list.
 */
const contactEnquirySchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, default: "", maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, default: "", maxlength: 30 },
    subject: { type: String, trim: true, default: "", maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },

    status: {
      type: String,
      enum: ["new", "in_progress", "closed"],
      default: "new",
    },
    // Whether reception was successfully emailed. A false here means the
    // enquiry is stored but nobody was told, which is what to look for when
    // someone says they never heard back.
    notified: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },

    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, trim: true, default: "", maxlength: 2000 },

    // Kept for abuse investigation only, and never returned to the public.
    sourceIp: { type: String, trim: true, default: "", select: false },
  },
  { timestamps: true }
);

contactEnquirySchema.index({ status: 1, createdAt: -1 });
contactEnquirySchema.index({ createdAt: -1 });
contactEnquirySchema.index({ email: 1 });

export default registerModel("ContactEnquiry", contactEnquirySchema);
