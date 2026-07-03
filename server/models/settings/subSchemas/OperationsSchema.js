import { Schema } from 'mongoose';
import { OPERATIONS_DEFAULTS } from '../../../config/operationalDefaults.js';

const { housekeeping, payroll, accounting } = OPERATIONS_DEFAULTS;

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
    },
    payroll: {
      defaultSalary: { type: Number, min: 0, default: payroll.defaultSalary },
      minWalletRecharge: { type: Number, min: 0, default: payroll.minWalletRecharge },
    },
    accounting: {
      defaultAccountType: { type: String, trim: true, default: accounting.defaultAccountType },
      defaultPaymentMethod: { type: String, trim: true, default: accounting.defaultPaymentMethod },
    },
  },
  { _id: false }
);

export default OperationsSchema;
