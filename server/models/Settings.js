import mongoose from 'mongoose';
const { Schema, model } = mongoose;
import {
  LANGUAGES,
  AMENITIES,
  PAYMENT_ENVIRONMENTS,
  BACKUP_FREQUENCIES,
  BACKUP_TYPES,
  BACKUP_STATUSES
} from './settings/constants.js';
import AddressSchema from './settings/subSchemas/AddressSchema.js';
import ContactSchema from './settings/subSchemas/ContactSchema.js';
import SocialSchema from './settings/subSchemas/SocialSchema.js';
import CertificateSchema from './settings/subSchemas/CertificateSchema.js';
import BrandingSchema from './settings/subSchemas/BrandingSchema.js';
import TaxSchema from './settings/subSchemas/TaxSchema.js';
import UpiSchema from './settings/subSchemas/UpiSchema.js';
import NotificationSchema from './settings/subSchemas/NotificationSchema.js';
import PolicySchema from './settings/subSchemas/PolicySchema.js';
import BillingSchema from './settings/subSchemas/BillingSchema.js';
import OperationsSchema from './settings/subSchemas/OperationsSchema.js';

// ---- Main Settings Schema -------------------------------------------------
const SettingsSchema = new Schema(
  {
    // Basic Profile
    hotelName: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    starRating: { type: Number, min: 0, max: 5, default: 0 },
    yearEstablished: { type: Number, min: 1800, max: new Date().getFullYear() },
    description: { type: String, trim: true },

    // Localization
    language: { type: String, enum: LANGUAGES, default: 'English' },
    secondaryLanguage: { 
      type: String, 
      validate: {
        validator: function(v) {
          return !v || v.trim() === '' || LANGUAGES.includes(v);
        },
        message: 'Invalid secondary language'
      }
    },
    baseCurrency: { type: String, trim: true, default: 'INR' },
    baseTimezone: { type: String, trim: true, default: 'Asia/Kolkata' },

    // Contact & Address
    address: AddressSchema,
    contact: ContactSchema,
    social: SocialSchema,

    // Regulatory
    tax: TaxSchema,
    certificates: CertificateSchema,

    // Billing & Tariff — room/POS GST, breakfast charge, default check-in/out
    // times, invoice prefix, currency and discount rules. Single home for the
    // money constants the booking & restaurant flows used to hardcode.
    billing: { type: BillingSchema, default: () => ({}) },

    // Operations — housekeeping / payroll / accounting workflow defaults.
    operations: { type: OperationsSchema, default: () => ({}) },

    // Branding & Theme
    branding: BrandingSchema,

    // Amenities (unique strings from AMENITIES)
    amenities: {
      type: [{ type: String, enum: AMENITIES }],
      default: []
    },

    // Policies
    policies: PolicySchema,

    // Guest messaging — WiFi + food-menu link sent to guests on check-in
    guestMessaging: {
      enabled: { type: Boolean, default: true },
      // Legacy single network (kept for backward compatibility / fallback)
      wifiSsid: { type: String, trim: true, default: '' },
      wifiPassword: { type: String, trim: true, default: '' },
      // Multiple access points — each mapped to the rooms it covers, so a
      // checked-in guest is sent the SSID nearest their room (strongest signal).
      // `rooms` is a comma list of room numbers and/or ranges, e.g. "101-110, 201".
      wifiNetworks: [{
        ssid: { type: String, trim: true, default: '' },
        password: { type: String, trim: true, default: '' },
        rooms: { type: String, trim: true, default: '' },
        isDefault: { type: Boolean, default: false }
      }],
      // Public website base URL used to build the room-service link
      // (e.g. https://sandhyagrand.com -> https://sandhyagrand.com/room-service/<roomNumber>)
      websiteBaseUrl: { type: String, trim: true, default: '' },
      countryCode: { type: String, trim: true, default: '91' },
      // Optional override; supports {guestName} {hotelName} {roomNumber}
      // {wifiSsid} {wifiPassword} {menuUrl} placeholders. Blank = built-in default.
      messageTemplate: { type: String, default: '' }
    },

    // Payments
    payment: {
      upi: UpiSchema,
      razorpay: {
        enabled: { type: Boolean, default: false },
        environment: { type: String, enum: PAYMENT_ENVIRONMENTS, default: 'test' },
        keyId: { type: String, trim: true, default: '' },
        keySecret: { type: String, trim: true, default: '' }
      },
      payu: {
        enabled: { type: Boolean, default: false },
        environment: { type: String, enum: PAYMENT_ENVIRONMENTS, default: 'test' },
        merchantId: { type: String, trim: true, default: '' },
        merchantKey: { type: String, trim: true, default: '' }
      },
      paytm: {
        enabled: { type: Boolean, default: false },
        environment: { type: String, enum: PAYMENT_ENVIRONMENTS, default: 'test' },
        merchantId: { type: String, trim: true, default: '' },
        merchantKey: { type: String, trim: true, default: '' }
      },
      stripe: {
        enabled: { type: Boolean, default: false },
        environment: { type: String, enum: PAYMENT_ENVIRONMENTS, default: 'test' },
        publicKey: { type: String, trim: true, default: '' },
        secretKey: { type: String, trim: true, default: '' }
      }
    },

    // Invoicing. `template` drives room/hotel invoices; `banquetTemplate`
    // independently drives banquet hall quotations AND invoices.
    invoice: {
      template: { type: String, default: 'standard' },
      banquetTemplate: { type: String, default: 'aurora' },
      logo: { type: String, default: '' },
      footer: { type: String, default: '' },
      terms: { type: String, default: '' }
    },

    // Notifications
    notifications: NotificationSchema,

    // Backup Settings
    backup: {
      autoBackup: { type: Boolean, default: false },
      backupFrequency: { type: String, enum: BACKUP_FREQUENCIES, default: 'weekly' },
      backupTime: { type: String, default: '02:00' },
      retentionPeriod: { type: Number, default: 30 },
      cloudStorage: { type: Boolean, default: true },
      encryptBackups: { type: Boolean, default: true },
      lastBackup: { type: Date },
      backupSize: { type: Number, default: 0 },
      backupHistory: [{
        id: { type: String, required: true },
        filename: { type: String, required: true },
        timestamp: { type: Date, required: true },
        size: { type: String, required: true },
        type: { type: String, enum: BACKUP_TYPES, default: 'manual' },
        status: { type: String, enum: BACKUP_STATUSES, default: 'completed' },
        metadata: {
          hotelName: { type: String },
          createdBy: { type: String },
          description: { type: String }
        },
        createdAt: { type: Date, default: Date.now }
      }]
    },

    // Security Settings
    security: {
      minPasswordLength: { type: Number, default: 8, min: 6, max: 20 },
      maxLoginAttempts: { type: Number, default: 5, min: 1, max: 10 },
      sessionTimeout: { type: Number, default: 43200, min: 15, max: 43200 }, // 30 days in minutes for persistent login
      enableTwoFactor: { type: Boolean, default: false },
      enableAuditLog: { type: Boolean, default: true },
      passwordExpiry: { type: Number, default: 90 },
      lockoutDuration: { type: Number, default: 30 }
    },

    // Staff Management Settings
    staff: {
      autoScheduling: { type: Boolean, default: false },
      shiftNotifications: { type: Boolean, default: true },
      overtimeAlerts: { type: Boolean, default: true },
      maxWeeklyHours: { type: Number, default: 40, min: 20, max: 60 },
      breakDuration: { type: Number, default: 30, min: 15, max: 60 },
      
      // Enhanced Features
      enableAttendanceTracking: { type: Boolean, default: false },
      enablePayrollIntegration: { type: Boolean, default: false },
      enablePerformanceTracking: { type: Boolean, default: false },
      
      // Working Hours
      workingHours: {
        standardShift: { type: Number, default: 8, min: 4, max: 12 },
        shiftsPerDay: { type: Number, default: 3, min: 1, max: 5 },
        shiftTiming: {
          morning: {
            start: { type: String, default: '06:00' },
            end: { type: String, default: '14:00' }
          },
          afternoon: {
            start: { type: String, default: '14:00' },
            end: { type: String, default: '22:00' }
          },
          night: {
            start: { type: String, default: '22:00' },
            end: { type: String, default: '06:00' }
          }
        },
        overtime: {
          enabled: { type: Boolean, default: false },
          rate: { type: Number, default: 1.5, min: 1, max: 3 },
          maxHoursPerDay: { type: Number, default: 4, min: 1, max: 8 }
        }
      },
      
      roles: [{
        name: { type: String, required: true, trim: true },
        permissions: [{ type: String, trim: true }],
        createdAt: { type: Date, default: Date.now }
      }],
      departments: [{
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }]
    },

    // Theme Settings
    theme: {
      darkMode: { type: Boolean, default: false },
      mode: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
      autoTheme: { type: Boolean, default: false },
      primaryColor: { type: String, default: '#6366F1' },
      secondaryColor: { type: String, default: '#EC4899' },
      accentColor: { type: String, default: '#F59E0B' },
      // Text colour used in dark mode (applied across the whole app). Light
      // mode keeps the standard slate regardless of this value.
      darkTextColor: { type: String, default: '#f3f4f6' },
      fontFamily: { type: String, default: 'Nunito' },
      fontSize: { type: Number, default: 16, min: 12, max: 24 },
      borderRadius: { type: Number, default: 8, min: 0, max: 20 },
      backgroundPattern: { type: String, default: 'none' },
      // Appearance: page background style + chosen image + solid fill
      backgroundStyle: { type: String, default: 'none' }, // none | image | gradient | solid
      backgroundImage: { type: String, default: '' },
      solidColor: { type: String, default: '#f8fafc' },
      solidColorOpacity: { type: Number, default: 1, min: 0, max: 1 },
      // Glassmorphism — surface opacity + blur strength
      surfaceOpacity: { type: Number, default: 0.05, min: 0, max: 1 },
      blurStrength: { type: Number, default: 8, min: 0, max: 40 },
      // Motion & ambience
      nightTorch: { type: Boolean, default: true },   // mouse-follow spotlight in dark mode
      reduceMotion: { type: Boolean, default: false }, // disables decorative animations
      // How deep dark mode goes (0 = soft charcoal, 100 = near black).
      // Also scales the night-torch intensity proportionally.
      darknessLevel: { type: Number, default: 60, min: 0, max: 100 }
    },

    // Integration Settings
    integrations: {
      channelManager: {
        enabled: { type: Boolean, default: false },
        provider: { type: String, trim: true },
        apiKey: { type: String, trim: true },
        apiSecret: { type: String, trim: true }
      },
      emailService: {
        provider: { type: String, enum: ['smtp', 'sendgrid', 'mailgun'], default: 'smtp' },
        smtp: {
          host: { type: String, trim: true },
          port: { type: Number, default: 587 },
          username: { type: String, trim: true },
          password: { type: String, trim: true },
          secure: { type: Boolean, default: false }
        },
        sendgrid: {
          apiKey: { type: String, trim: true }
        },
        mailgun: {
          apiKey: { type: String, trim: true },
          domain: { type: String, trim: true }
        }
      },
      smsService: {
        provider: { type: String, enum: ['twilio', 'messagebird', 'textlocal'], default: 'twilio' },
        twilio: {
          accountSid: { type: String, trim: true },
          authToken: { type: String, trim: true },
          phoneNumber: { type: String, trim: true }
        },
        messagebird: {
          apiKey: { type: String, trim: true },
          originator: { type: String, trim: true }
        }
      },
      analytics: {
        googleAnalytics: {
          enabled: { type: Boolean, default: false },
          trackingId: { type: String, trim: true }
        }
      }
    },

    // Banquet / marriage-hall booking preferences (advance rules, etc.).
    // Mixed so the front-office can evolve the shape without schema churn.
    banquet: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Catering menu configuration — staff-managed meal/side/extra/combo/
    // beverage items and their prices, consumed by the booking form's
    // cost calculators. Mixed for the same flexibility.
    catering: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Hotel Profile Section (for frontend compatibility)
    hotelProfile: {
      hotelName: { type: String, trim: true },
      legalName: { type: String, trim: true },
      description: { type: String, trim: true },
      starRating: { type: Number, min: 0, max: 5 },
      yearEstablished: { type: Number, min: 1800, max: new Date().getFullYear() },
      logo: { type: String, trim: true },
      address: AddressSchema,
      contact: ContactSchema,
      social: SocialSchema,
      businessRegistration: {
        type: {
          gstNumber: { type: String, uppercase: true, trim: true },
          panNumber: { type: String, uppercase: true, trim: true },
          fssaiNumber: { type: String, trim: true },
          cin: { type: String, uppercase: true, trim: true }
        },
        default: {}
      },
      // Restaurant operates as a distinct GST registration in many properties —
      // keep its name + tax IDs separate so the food bill prints them correctly.
      restaurant: {
        type: {
          name: { type: String, trim: true },
          gstNumber: { type: String, uppercase: true, trim: true },
          fssaiNumber: { type: String, trim: true },
        },
        default: {}
      },
      classification: {
        type: {
          hotelType: { type: String, trim: true },
          starRating: { type: Number, min: 0, max: 5 },
          establishedYear: { type: Number, min: 1800, max: new Date().getFullYear() },
          totalRooms: { type: Number, min: 0 },
          isACProperty: { type: Boolean, default: false },
          hasElevator: { type: Boolean, default: false },
          hasPowerBackup: { type: Boolean, default: false }
        },
        default: {}
      }
    },

    // Room Categories
    categories: [{
      name: { type: String, required: true, trim: true },
      code: { type: String, trim: true },
      description: { type: String, trim: true },
      basePrice: { type: Number, min: 0, default: 0 },
      maxOccupancy: { type: Number, min: 1, max: 20, default: 2 },
      amenities: [{ type: String, trim: true }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],

    // Operational toggles
    features: {
      housekeeping: { type: Boolean, default: true },
      restaurantPOS: { type: Boolean, default: true },
      channelManager: { type: Boolean, default: false },
      analytics: { type: Boolean, default: true }
    },

    // Audit
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// ---- Indexes --------------------------------------------------------------
SettingsSchema.index({ hotelName: 1 }, { unique: true });
SettingsSchema.index({ 'address.city': 1 });

// ---- Sanitizers / Hooks ---------------------------------------------------
SettingsSchema.pre('save', function() {
  if (this.hotelName) this.hotelName = this.hotelName.trim();
  if (this.legalName) this.legalName = this.legalName.trim();
  
  // Ensure amenities are unique
  if (Array.isArray(this.amenities)) {
    this.amenities = [...new Set(this.amenities)];
  }
  
  // Ensure payment gateways have proper default structure
  if (this.payment) {
    const defaultGateway = {
      enabled: false,
      environment: 'test'
    };
    
    // Initialize payment gateways with defaults if they don't exist
    if (!this.payment.razorpay) {
      this.payment.razorpay = { ...defaultGateway, keyId: '', keySecret: '' };
    }
    if (!this.payment.payu) {
      this.payment.payu = { ...defaultGateway, merchantId: '', merchantKey: '' };
    }
    if (!this.payment.paytm) {
      this.payment.paytm = { ...defaultGateway, merchantId: '', merchantKey: '' };
    }
    if (!this.payment.stripe) {
      this.payment.stripe = { ...defaultGateway, publicKey: '', secretKey: '' };
    }
    
    // Ensure required fields exist for each gateway
    ['razorpay', 'payu', 'paytm', 'stripe'].forEach(gateway => {
      if (this.payment[gateway]) {
        this.payment[gateway].enabled = this.payment[gateway].enabled || false;
        this.payment[gateway].environment = this.payment[gateway].environment || 'test';
        
        if (gateway === 'razorpay') {
          this.payment[gateway].keyId = this.payment[gateway].keyId || '';
          this.payment[gateway].keySecret = this.payment[gateway].keySecret || '';
        } else if (gateway === 'stripe') {
          this.payment[gateway].publicKey = this.payment[gateway].publicKey || '';
          this.payment[gateway].secretKey = this.payment[gateway].secretKey || '';
        } else {
          this.payment[gateway].merchantId = this.payment[gateway].merchantId || '';
          this.payment[gateway].merchantKey = this.payment[gateway].merchantKey || '';
        }
      }
    });
  }
});

// ---- Static helpers (optional) -------------------------------------------
SettingsSchema.statics.getOrCreate = async function(match = {}) {
  const existing = await this.findOne(match);
  if (existing) return existing;
  return this.create({ hotelName: '' });
};

/**
 * Get the entire settings document organized by sections
 * @returns {Promise<Object>} The settings document organized by sections
 */
SettingsSchema.statics.getSettings = async function() {
  try {
    let settings = await this.findOne({});

    // Create default settings if none exist
    if (!settings) {
      settings = new this({
        hotelName: 'Hotel Sandhya Grand',
        // Other default values will be set by the schema
      });
      await settings.save();
    }

    // Self-heal: if the stored logo is an inline base64 data URL (legacy
    // upload path baked them into the document and they bloat the response
    // to hundreds of KB), move the bytes into the Image collection and replace
    // the field with a small URL on the fly.
    try {
      const existingLogo = settings.hotelProfile?.logo;
      if (typeof existingLogo === 'string' && existingLogo.startsWith('data:')) {
        const match = existingLogo.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const [, contentType, b64] = match;
          const buffer = Buffer.from(b64, 'base64');
          const ImageModel = mongoose.model('Image');
          const created = await ImageModel.create({
            data: buffer,
            contentType,
            filename: 'hotel-logo.migrated',
            size: buffer.length,
            category: 'logo',
          });
          const newUrl = `/api/images/${created._id}`;
          await this.updateOne(
            { _id: settings._id },
            { $set: { 'hotelProfile.logo': newUrl } },
            { runValidators: false },
          );
          settings.hotelProfile = settings.hotelProfile || {};
          settings.hotelProfile.logo = newUrl;
        }
      }
    } catch (_migErr) {
      // If migration fails, fall through and serve the existing logo as-is.
    }

    // Prefer the nested hotelProfile values (single source of truth), fall back
    // to the top-level fields for backward compatibility with older documents.
    const hp = settings.hotelProfile || {};
    const pick = (nestedVal, topVal, fallback) => {
      if (nestedVal !== undefined && nestedVal !== null && nestedVal !== '') return nestedVal;
      if (topVal !== undefined && topVal !== null && topVal !== '') return topVal;
      return fallback;
    };
    const pickObj = (nestedObj, topObj, fallback) => {
      const nested = nestedObj && typeof nestedObj.toObject === 'function' ? nestedObj.toObject() : nestedObj;
      const top = topObj && typeof topObj.toObject === 'function' ? topObj.toObject() : topObj;
      if (nested && Object.keys(nested).length) return nested;
      if (top && Object.keys(top).length) return top;
      return fallback;
    };

    // Organize data into sections that match frontend expectations
    const organizedSettings = {
      hotelProfile: {
        hotelName: pick(hp.hotelName, settings.hotelName, ''),
        legalName: pick(hp.legalName, settings.legalName, ''),
        starRating: pick(hp.starRating, settings.starRating, 0),
        yearEstablished: pick(hp.yearEstablished, settings.yearEstablished, new Date().getFullYear()),
        description: pick(hp.description, settings.description, ''),
        language: settings.language || 'English',
        secondaryLanguage: settings.secondaryLanguage || '',
        baseCurrency: settings.baseCurrency || 'INR',
        baseTimezone: settings.baseTimezone || 'Asia/Kolkata',
        address: pickObj(hp.address, settings.address, {}),
        contact: pickObj(hp.contact, settings.contact, {}),
        social: pickObj(hp.social, settings.social, {}),
        certificates: settings.certificates || {},
        amenities: settings.amenities || [],
        policies: settings.policies || {},
        logo: hp.logo || '',
        businessRegistration: hp.businessRegistration || {
          gstNumber: '',
          panNumber: '',
          fssaiNumber: '',
          cin: ''
        },
        restaurant: hp.restaurant || {
          name: '',
          gstNumber: '',
          fssaiNumber: ''
        },
        classification: {
          hotelType: hp.classification?.hotelType || '',
          starRating: pick(hp.classification?.starRating, hp.starRating ?? settings.starRating, 0),
          establishedYear: pick(hp.classification?.establishedYear, hp.yearEstablished ?? settings.yearEstablished, new Date().getFullYear()),
          totalRooms: hp.classification?.totalRooms || 0,
          isACProperty: hp.classification?.isACProperty || false,
          hasElevator: hp.classification?.hasElevator || false,
          hasPowerBackup: hp.classification?.hasPowerBackup || false
        }
      },
      payment: settings.payment || {
        upi: {},
        razorpay: { enabled: false, environment: 'test', keyId: '', keySecret: '' },
        payu: { enabled: false, environment: 'test', merchantId: '', merchantKey: '' },
        paytm: { enabled: false, environment: 'test', merchantId: '', merchantKey: '' },
        stripe: { enabled: false, environment: 'test', publicKey: '', secretKey: '' }
      },
      tax: settings.tax || {},
      billing: settings.billing || {},
      operations: settings.operations || {},
      invoice: settings.invoice || {},
      notifications: settings.notifications || {},
      guestMessaging: settings.guestMessaging || {},
      backup: settings.backup || {
        autoBackup: false,
        backupFrequency: 'weekly',
        backupTime: '02:00',
        retentionPeriod: 30,
        cloudStorage: true,
        encryptBackups: true,
        backupHistory: []
      },
      security: settings.security || {
        rateLimiting: { enabled: true, maxRequests: 100, windowMs: 900000 },
        cors: { enabled: true, origins: ['http://localhost:3000'] },
        session: { maxAge: 86400000, secure: false },
        passwordPolicy: { minLength: 8, requireUppercase: true, requireNumbers: true, requireSymbols: false },
        twoFactorAuth: { enabled: false, method: 'email' }
      },
      integrations: settings.integrations || {
        email: { provider: 'smtp', enabled: false },
        sms: { provider: 'twilio', enabled: false },
        channelManager: { enabled: false },
        analytics: { enabled: false }
      },
      theme: settings.theme || {
        mode: 'light',
        primaryColor: '#1976d2',
        secondaryColor: '#dc004e',
        fontFamily: 'Roboto',
        fontSize: 'medium',
        backgroundPattern: 'none'
      },
      staff: settings.staff || {
        departments: [],
        roles: [],
        shiftManagement: { enabled: false },
        attendanceTracking: { enabled: false }
      },
      system: settings.system || {
        maintenanceMode: false,
        debugMode: false,
        logLevel: 'info',
        cacheEnabled: true
      },
      // Add categories to the organized settings
      categories: settings.categories || []
    };
    
    return organizedSettings;
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

/**
 * Get a specific section of the settings
 * @param {string} section - The section name to retrieve
 * @returns {Promise<Object>} The requested section
 */
SettingsSchema.statics.getSection = async function(section) {
  try {
    const settings = await this.getSettings();
    
    // Handle appearance alias for theme section
    if (section === 'appearance') {
      return settings.theme || {};
    }
    
    return settings[section] || {};
  } catch (error) {
    console.error(`Error getting ${section} settings:`, error);
    throw error;
  }
};

/**
 * Update a specific section of the settings
 * @param {string} section - The section name to update
 * @param {Object} data - The data to update with
 * @returns {Promise<Object>} The updated settings organized by sections
 */
SettingsSchema.statics.updateSection = async function(section, data) {
  try {
    let settings = await this.findOne({});
    
    // Create default settings if none exist
    if (!settings) {
      settings = new this({
        hotelName: 'Hotel Sandhya Grand',
      });
    }
    
    // Map section data back to the database schema structure
    if (section === 'hotelProfile') {
      // Update hotel profile fields
      if (data.hotelName !== undefined) settings.hotelName = data.hotelName;
      if (data.legalName !== undefined) settings.legalName = data.legalName;
      if (data.starRating !== undefined) settings.starRating = data.starRating;
      if (data.yearEstablished !== undefined) settings.yearEstablished = data.yearEstablished;
      if (data.description !== undefined) settings.description = data.description;
      if (data.language !== undefined) settings.language = data.language;
      if (data.secondaryLanguage !== undefined) settings.secondaryLanguage = data.secondaryLanguage;
      if (data.baseCurrency !== undefined) settings.baseCurrency = data.baseCurrency;
      if (data.baseTimezone !== undefined) settings.baseTimezone = data.baseTimezone;
      
      // Update nested objects
      if (data.address) {
        settings.address = { ...settings.address, ...data.address };
        settings.markModified('address');
      }
      if (data.contact) {
        settings.contact = { ...settings.contact, ...data.contact };
        settings.markModified('contact');
      }
      if (data.social) {
        settings.social = { ...settings.social, ...data.social };
        settings.markModified('social');
      }
      if (data.certificates) {
        settings.certificates = { ...settings.certificates, ...data.certificates };
        settings.markModified('certificates');
      }
      if (data.amenities) settings.amenities = data.amenities;
      if (data.policies) {
        settings.policies = { ...settings.policies, ...data.policies };
        settings.markModified('policies');
      }
      
      // Handle logo
      if (data.logo !== undefined) {
        if (!settings.hotelProfile) settings.hotelProfile = {};
        settings.hotelProfile.logo = data.logo;
        settings.markModified('hotelProfile');
      }
      
      // Handle classification data
      if (data.classification) {
        if (!settings.hotelProfile) settings.hotelProfile = {};
        if (!settings.hotelProfile.classification) settings.hotelProfile.classification = {};
        
        // Update all classification fields in hotelProfile
        if (data.classification.hotelType !== undefined) {
          settings.hotelProfile.classification.hotelType = data.classification.hotelType;
        }
        if (data.classification.totalRooms !== undefined) {
          settings.hotelProfile.classification.totalRooms = data.classification.totalRooms;
        }
        if (data.classification.isACProperty !== undefined) {
          settings.hotelProfile.classification.isACProperty = data.classification.isACProperty;
        }
        if (data.classification.hasElevator !== undefined) {
          settings.hotelProfile.classification.hasElevator = data.classification.hasElevator;
        }
        if (data.classification.hasPowerBackup !== undefined) {
          settings.hotelProfile.classification.hasPowerBackup = data.classification.hasPowerBackup;
        }
        if (data.classification.starRating !== undefined) {
          settings.hotelProfile.classification.starRating = data.classification.starRating;
        }
        if (data.classification.establishedYear !== undefined) {
          settings.hotelProfile.classification.establishedYear = data.classification.establishedYear;
        }
        
        // Also update root level fields for compatibility
        if (data.classification.starRating !== undefined) {
          settings.starRating = data.classification.starRating;
        }
        if (data.classification.establishedYear !== undefined) {
          settings.yearEstablished = data.classification.establishedYear;
        }
        settings.markModified('hotelProfile');
      }
      
      // Handle business registration data
      if (data.businessRegistration) {
        if (!settings.hotelProfile) settings.hotelProfile = {};
        settings.hotelProfile.businessRegistration = data.businessRegistration;
        settings.markModified('hotelProfile');
      }

      // Restaurant identity (separate GST registration / name for the F&B side)
      if (data.restaurant) {
        if (!settings.hotelProfile) settings.hotelProfile = {};
        settings.hotelProfile.restaurant = data.restaurant;
        settings.markModified('hotelProfile');
      }
    } else if (section === 'payment') {
      // Handle payment section with proper gateway preservation
      if (!settings.payment) settings.payment = {};
      
      // Preserve existing gateways and merge with new data
      const existingPayment = settings.payment.toObject ? settings.payment.toObject() : settings.payment;
      
      // Ensure all gateways exist with defaults
      const defaultGateways = {
        upi: { enabled: false, upiId: '' },
        razorpay: { enabled: false, environment: 'test', keyId: '', keySecret: '' },
        payu: { enabled: false, environment: 'test', merchantId: '', merchantKey: '' },
        paytm: { enabled: false, environment: 'test', merchantId: '', merchantKey: '' },
        stripe: { enabled: false, environment: 'test', publicKey: '', secretKey: '' }
      };
      
      // Merge existing with defaults, then with new data
      settings.payment = {
        ...defaultGateways,
        ...existingPayment,
        ...data
      };
      
      settings.markModified('payment');
    } else if (section === 'tax') {
      // Handle tax section updates
      if (!settings.tax) settings.tax = {};
      settings.tax = { ...settings.tax, ...data };
      settings.markModified('tax');
    } else {
      // Handle appearance alias for theme section
      const targetSection = section === 'appearance' ? 'theme' : section;
      
      // Validate section exists in schema
      const validSections = ['invoice', 'notifications', 'backup', 'security', 'integrations', 'theme', 'staff', 'banquet', 'catering', 'guestMessaging', 'billing', 'operations'];
      if (!validSections.includes(targetSection)) {
        throw new Error(`Invalid section: ${targetSection}`);
      }
      
      // For other sections, update directly
      if (!settings[targetSection]) settings[targetSection] = {};
      settings[targetSection] = { ...settings[targetSection], ...data };
      settings.markModified(targetSection);
    }

    await settings.save({ validateModifiedOnly: true });

    // Return organized settings
    return await this.getSettings();
  } catch (error) {
    console.error(`Error updating ${section} settings:`, error);
    throw error;
  }
};

/**
 * Reset settings to defaults
 * @returns {Promise<Object>} The reset settings
 */
SettingsSchema.statics.resetSettings = async function() {
  try {
    const settings = await this.getSettings();
    
    // Reset to schema defaults by removing and recreating
    await this.deleteOne({ _id: settings._id });
    
    const newSettings = new this({
      hotelName: 'Hotel Sandhya Grand',
      // Other default values will be set by the schema
    });
    
    await newSettings.save();
    return newSettings;
  } catch (error) {
    console.error('Error resetting settings:', error);
    throw error;
  }
};

// ---- Export ---------------------------------------------------------------
const Settings = mongoose.models.Settings || model('Settings', SettingsSchema);

// Export both default and named exports for compatibility
export default Settings;
export {
  Settings
};