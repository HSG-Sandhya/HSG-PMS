import { Schema } from 'mongoose';

const CertificateSchema = new Schema(
  {
    gstNumber: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
        },
        message: 'Invalid GST number format'
      }
    },
    panNumber: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: 'Invalid PAN number format'
      }
    },
    cinNumber: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(v);
        },
        message: 'Invalid CIN number format'
      }
    },
    fssaiNumber: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || /^[0-9]{14}$/.test(v);
        },
        message: 'Invalid FSSAI number format (14 digits required)'
      }
    },
    tradeLicense: { 
      type: String, 
      trim: true 
    },
    fireNoC: { 
      type: String, 
      trim: true 
    },
    pollutionClearance: { 
      type: String, 
      trim: true 
    }
  },
  { _id: false }
);

export default CertificateSchema;
