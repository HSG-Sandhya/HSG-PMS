import { Schema } from 'mongoose';

const BrandingSchema = new Schema(
  {
    logoUrl: { type: String, trim: true },
    secondaryLogoUrl: { type: String, trim: true },
    theme: {
      primary: { type: String, trim: true, default: '#0F172A' },
      secondary: { type: String, trim: true, default: '#2563EB' },
      accent: { type: String, trim: true, default: '#22C55E' },
      darkMode: { type: Boolean, default: false }
    }
  },
  { _id: false }
);

export default BrandingSchema;
