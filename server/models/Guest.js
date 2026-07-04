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
  // Free String (not an enum): the value is copied from Booking.idCardType — the
  // authoritative enum the client dropdown matches (e.g. "Aadhaar Card", "PAN
  // Card", "Other") — whose spellings differ from the short list this once used,
  // so an enum here only caused validation failures on otherwise-valid records.
  identityType: { type: String, default: "Aadhaar Card" },
  identityNumber: String,
  nationality: { type: String, default: "Indian" },
  specialNotes: String
}, { timestamps: true });

// Keep phoneKey derived from phone on every write path. Mongoose 9 hooks are
// promise/sync-based — do NOT call next() (the first arg is not a callback).
// pre("validate") — runs BEFORE validation (pre "save" runs after it), so this is
// where we must normalize values the validators would otherwise reject.
guestSchema.pre("validate", function () {
  this.phoneKey = normalizePhone(this.phone);
  // An unselected dropdown submits "" — store it as unset so the enum (which has
  // no "" member) doesn't reject an otherwise-valid record on save/edit.
  if (this.gender === "") this.gender = undefined;
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
