import { Schema } from 'mongoose';

const PolicySchema = new Schema(
  {
    checkInTime: { type: String, default: '12:00' },
    checkOutTime: { type: String, default: '11:00' },
    cancellationPolicy: { type: String, trim: true },
    refundPolicy: { type: String, trim: true },
    privacyPolicy: { type: String, trim: true },
    termsAndConditions: { type: String, trim: true },
    childPolicy: { type: String, trim: true },
    petPolicy: { type: String, trim: true },
    smokingPolicy: { type: String, trim: true, default: 'No Smoking' }
  },
  { _id: false }
);

export default PolicySchema;
