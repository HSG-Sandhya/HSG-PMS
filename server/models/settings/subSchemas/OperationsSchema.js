import { Schema } from 'mongoose';
import { OPERATIONS_DEFAULTS } from '../../../config/operationalDefaults.js';

const { housekeeping, payroll, accounting, banquet, frontDesk } = OPERATIONS_DEFAULTS;

// Operations settings — module workflow defaults (housekeeping task creation,
// payroll fallbacks, accounting pre-selections) that were previously hardcoded
// in their respective controllers/models. Defaults sourced from operationalDefaults.
const OperationsSchema = new Schema(
  {
    housekeeping: {
      defaultTaskType: { type: String, trim: true, default: housekeeping.defaultTaskType },
      defaultPriority: { type: String, trim: true, default: housekeeping.defaultPriority },
      checkoutCleaningPriority: { type: String, trim: true, default: housekeeping.checkoutCleaningPriority },
      autoCreateOnCheckout: { type: Boolean, default: housekeeping.autoCreateOnCheckout },
      requireInspection: { type: Boolean, default: housekeeping.requireInspection },
      expectedCleaningMinutes: { type: Number, min: 0, default: housekeeping.expectedCleaningMinutes },
    },
    payroll: {
      defaultSalary: { type: Number, min: 0, default: payroll.defaultSalary },
      minWalletRecharge: { type: Number, min: 0, default: payroll.minWalletRecharge },
      payDay: { type: Number, min: 1, max: 31, default: payroll.payDay },
      overtimeMultiplier: { type: Number, min: 1, default: payroll.overtimeMultiplier },
    },
    accounting: {
      defaultAccountType: { type: String, trim: true, default: accounting.defaultAccountType },
      defaultPaymentMethod: { type: String, trim: true, default: accounting.defaultPaymentMethod },
      autoPostIncome: { type: Boolean, default: accounting.autoPostIncome },
      financialYearStartMonth: { type: Number, min: 1, max: 12, default: accounting.financialYearStartMonth },
    },
    banquet: {
      advancePercent: { type: Number, min: 0, max: 100, default: banquet.advancePercent },
      quotationValidityDays: { type: Number, min: 1, default: banquet.quotationValidityDays },
      defaultEventHours: { type: Number, min: 0, default: banquet.defaultEventHours },
      minAdvanceAmount: { type: Number, min: 0, default: banquet.minAdvanceAmount },
    },
    frontDesk: {
      requireIdProof: { type: Boolean, default: frontDesk.requireIdProof },
      allowOverbooking: { type: Boolean, default: frontDesk.allowOverbooking },
      holdExpiryHours: { type: Number, min: 0, default: frontDesk.holdExpiryHours },
      lateCheckoutGraceMinutes: { type: Number, min: 0, default: frontDesk.lateCheckoutGraceMinutes },
      lateCheckoutFullDayAfter: { type: String, trim: true, default: frontDesk.lateCheckoutFullDayAfter },
    },
  },
  { _id: false }
);

export default OperationsSchema;
