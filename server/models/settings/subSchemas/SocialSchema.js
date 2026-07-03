import { Schema } from 'mongoose';
import { SOCIAL_PLATFORMS, urlRegex } from '../constants.js';

const SocialSchema = new Schema(
  {
    facebook: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    instagram: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    twitter: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    linkedin: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    youtube: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    whatsapp: { type: String, trim: true },
    threads: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    },
    tiktok: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          return !v || urlRegex.test(v);
        },
        message: 'Invalid URL format'
      }
    }
  },
  { _id: false }
);

export default SocialSchema;
