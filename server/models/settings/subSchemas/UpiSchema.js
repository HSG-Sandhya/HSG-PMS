import { Schema } from 'mongoose';

const UpiSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    upiId: { type: String, trim: true },
    qrCodeUrl: { type: String, trim: true }
  },
  { _id: false }
);

export default UpiSchema;
