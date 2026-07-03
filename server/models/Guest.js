import mongoose from "mongoose";

const guestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  gender: { type: String, enum: ["Male", "Female", "Other"] },
  age: Number,
  address: String,
  identityType: { type: String, enum: ["Aadhar", "Passport", "DrivingLicense", "VoterID"], default: "Aadhar" },
  identityNumber: String,
  nationality: { type: String, default: "Indian" },
  specialNotes: String
}, { timestamps: true });

export default mongoose.model("Guest", guestSchema);
