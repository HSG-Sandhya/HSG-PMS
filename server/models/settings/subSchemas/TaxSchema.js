import { Schema } from 'mongoose';
import { GST_TAX_RATES, gstRegex } from '../constants.js';

const TaxSchema = new Schema(
  {
    gstin: { 
      type: String, 
      uppercase: true, 
      trim: true, 
      validate: {
        validator: function(v) {
          return !v || gstRegex.test(v);
        },
        message: 'Invalid GSTIN format'
      }
    },
    pan: { type: String, uppercase: true, trim: true },
    cin: { type: String, uppercase: true, trim: true },
    defaultGstRate: { type: Number, enum: GST_TAX_RATES, default: 12 },
    enableIGST: { type: Boolean, default: false },
    enableServiceCharge: { type: Boolean, default: false },
    serviceChargeRate: { type: Number, min: 0, max: 30, default: 0 }
  },
  { _id: false }
);

export default TaxSchema;
