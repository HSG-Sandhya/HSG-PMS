import mongoose from "mongoose";

import { registerModel } from "../db/modelRegistry.js";
const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true, trim: true },

  // Category name (free-form so it tracks the dynamic room categories defined in
  // Settings, not a fixed enum).
  type: {
    type: String,
    trim: true,
    default: "Standard AC"
  },

  // Reference to the room category in Settings.categories (sub-document id).
  categoryId: { type: String, trim: true, default: '' },

  capacity: {
    adults: { type: Number, required: true, min: 1, default: 2 },
    children: { type: Number, min: 0, default: 0 }
  },

  pricePerNight: { type: Number, required: true, min: 0 },

  // Denormalised tariff figures, seeded from the CONFIGURED room GST rate by
  // roomController.applyGstDefaults() on create and update.
  //
  // These used to carry schema defaults of `pricePerNight * 0.05` and
  // `* 1.05`. A schema default cannot await Settings, so it could only ever
  // hardcode a rate -- and it silently overrode the configured one for any
  // document that reached the field without going through the controller.
  // Left unset, a legacy room falls back to a rate-aware calculation at the
  // point of display instead.
  gstAmount: {
    type: Number
  },

  totalPrice: {
    type: Number
  },

  // Amenities are driven by the selected category, so any string is allowed.
  amenities: {
    type: [String],
    default: []
  },

  status: {
    type: String,
    enum: ["available", "occupied", "maintenance", "cleaning"],
    default: "available"
  },
  isAvailable: { type: Boolean, default: true },

  floor: { type: Number, required: true, min: 1, default: 1 },
  description: { type: String, trim: true },
  images: { type: [String], default: [] },

  lastCleaned: { type: Date, default: null },

  maintenanceHistory: [
    {
      date: { type: Date, default: Date.now },
      description: String,
      cost: Number,
      resolvedBy: String
    }
  ],

  features: { 
    type: [String], 
    default: [],
    validate: {
      validator: function(features) {
        const validFeatures = [
          'Sea View', 'Garden View', 'City View', 'Mountain View',
          'Pool Access', 'Beach Access', 'Smoking Allowed', 'Pet Friendly',
          'Wheelchair Accessible', 'Soundproof', 'Connecting Rooms'
        ];
        return features.every(feature => validFeatures.includes(feature));
      },
      message: 'Invalid feature selected'
    }
  }
}, { timestamps: true });

const Room = registerModel("Room", roomSchema);
export default Room;
