import mongoose from 'mongoose';

import { registerModel } from "../db/modelRegistry.js";
const ImageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    filename: { type: String },
    size: { type: Number },
    category: { type: String, enum: ['menu', 'room', 'logo', 'background', 'other'], default: 'other' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ImageSchema.index({ category: 1, createdAt: -1 });

export default registerModel('Image', ImageSchema);
