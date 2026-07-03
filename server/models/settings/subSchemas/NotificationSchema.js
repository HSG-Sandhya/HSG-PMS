import { Schema } from 'mongoose';

const NotificationSchema = new Schema(
  {
    // Legacy fields for backward compatibility
    emailFromName: { type: String, trim: true, default: '' },
    emailFromAddress: { type: String, trim: true },
    smsSenderId: { type: String, trim: true },
    templates: {
      bookingCreatedEmail: { type: String, trim: true },
      bookingCreatedSms: { type: String, trim: true },
      invoiceEmail: { type: String, trim: true },
      userCreatedEmail: { type: String, trim: true },
      userCreatedSms: { type: String, trim: true }
    },
    enableEmail: { type: Boolean, default: false },
    enableSms: { type: Boolean, default: false },
    
    // New comprehensive notification structure
    email: {
      enabled: { type: Boolean, default: false },
      bookingConfirmation: { type: Boolean, default: false },
      checkInReminder: { type: Boolean, default: false },
      paymentReminder: { type: Boolean, default: false },
      promotionalEmails: { type: Boolean, default: false },
      dailyReports: { type: Boolean, default: false }
    },
    sms: {
      enabled: { type: Boolean, default: false },
      bookingConfirmation: { type: Boolean, default: false },
      checkInReminder: { type: Boolean, default: false },
      paymentReminder: { type: Boolean, default: false }
    },
    desktop: {
      enabled: { type: Boolean, default: false },
      newBookings: { type: Boolean, default: false },
      checkIns: { type: Boolean, default: false },
      emergencyAlerts: { type: Boolean, default: false },
      systemUpdates: { type: Boolean, default: false }
    },
    sound: {
      enabled: { type: Boolean, default: false },
      volume: { type: Number, default: 70, min: 0, max: 100 }
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '22:00' },
      endTime: { type: String, default: '08:00' }
    }
  },
  { _id: false }
);

export default NotificationSchema;
