import { Schema } from 'mongoose';
import { COUNTRIES } from '../constants.js';

const AddressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, enum: COUNTRIES, default: 'India' }
  },
  { _id: false }
);

export default AddressSchema;
