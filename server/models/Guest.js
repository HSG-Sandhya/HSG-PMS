import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.js";

const guestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  // Country-code-agnostic form of `phone`, used to keep the same person a single
  // directory record regardless of how the number was typed (see utils/phone.js).
  phoneKey: { type: String, index: true },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  age: Number,
  address: String,
  identityType: { type: String, enum: ["Aadhar", "Passport", "DrivingLicense", "VoterID"], default: "Aadhar" },
  identityNumber: String,
  nationality: { type: String, default: "Indian" },
  specialNotes: String
}, { timestamps: true });

// Keep phoneKey derived from phone on every write path. Mongoose 9 hooks are
// promise/sync-based — do NOT call next() (the first arg is not a callback).
guestSchema.pre("save", function () {
  this.phoneKey = normalizePhone(this.phone);
});

function applyPhoneKeyToUpdate() {
  const update = this.getUpdate();
  if (update) {
    const target = update.$set || update;
    if (target.phone != null) {
      if (update.$set) update.$set.phoneKey = normalizePhone(target.phone);
      else update.phoneKey = normalizePhone(target.phone);
    }
  }
}
guestSchema.pre("findOneAndUpdate", applyPhoneKeyToUpdate);
guestSchema.pre("updateOne", applyPhoneKeyToUpdate);

export default mongoose.model("Guest", guestSchema);
