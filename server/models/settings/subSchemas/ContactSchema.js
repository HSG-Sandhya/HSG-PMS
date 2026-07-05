import { Schema } from 'mongoose';
import { phoneRegex, emailRegex } from '../constants.js';

const ContactSchema = new Schema(
  {
    phone: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || phoneRegex.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    mobile: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || phoneRegex.test(v);
        },
        message: 'Invalid mobile number format'
      }
    },
    altPhone: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || phoneRegex.test(v);
        },
        message: 'Invalid alternate phone number format'
      }
    },
    whatsappBusinessNumber: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || phoneRegex.test(v);
        },
        message: 'Invalid WhatsApp business number format'
      }
    },
    email: { 
      type: String, 
      trim: true, 
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || emailRegex.test(v);
        },
        message: 'Invalid email format'
      }
    },
    website: { type: String, trim: true },
    fax: { type: String, trim: true },
    // Set true once the contact email passes OTP verification; recomputed on
    // save so it survives while the email is unchanged and clears if edited.
    emailVerified: { type: Boolean, default: false }
  },
  { _id: false }
);

export default ContactSchema;
