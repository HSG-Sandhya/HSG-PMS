import Razorpay from 'razorpay';
import crypto from 'crypto';
import Settings from '../models/Settings.js';

class PaymentService {
  constructor() {
    this.razorpayInstance = null;
    this.keySecret = null;
    this.environment = 'test';
    this.enabled = false;
    this.isDemo = true;
    this.demoSettings = {
      keyId: 'rzp_test_demo_key',
      environment: 'test',
      enabled: true,
    };
    this.initializeRazorpay();
  }

  /**
   * Re-read Razorpay credentials from the Settings doc and rebuild the
   * client. Called once at boot and again whenever the back-office
   * Settings → Payments section is saved so live keys take effect
   * without a server restart.
   */
  async initializeRazorpay() {
    try {
      const settings = await Settings.findOne();
      const razor = settings?.payment?.razorpay;

      if (razor?.enabled) {
        const keyId = (razor.keyId || '').trim();
        const keySecret = (razor.keySecret || '').trim();
        const isPlaceholder =
          !keyId || !keySecret ||
          keyId.includes('YOUR_KEY_ID') || keySecret.includes('YOUR_KEY_SECRET');

        if (!isPlaceholder) {
          this.razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
          this.keySecret = keySecret;
          this.environment = razor.environment || 'test';
          this.enabled = true;
          this.isDemo = false;
          console.log(`✅ Payment Service: Razorpay initialised in ${this.environment.toUpperCase()} mode`);
          return;
        }
      }

      // Either gateway disabled or credentials still placeholder → demo mode.
      this.razorpayInstance = null;
      this.keySecret = null;
      this.environment = 'test';
      this.enabled = !!razor?.enabled;
      this.isDemo = true;
      console.log('💡 Payment Service: Running in DEMO mode (no real Razorpay credentials)');
    } catch (error) {
      console.error('Error initializing Razorpay:', error);
      this.razorpayInstance = null;
      this.keySecret = null;
      this.isDemo = true;
    }
  }

  /** Public alias used by the settings controller after a save. */
  async reload() {
    return this.initializeRazorpay();
  }

  async createOrder(amount, currency = 'INR', receipt = null) {
    if (!this.razorpayInstance && !this.isDemo) {
      await this.initializeRazorpay();
    }

    // Demo mode - return mock order
    if (this.isDemo) {
      const mockOrder = {
        id: `order_demo_${Date.now()}`,
        entity: 'order',
        amount: Math.round(amount * 100),
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency,
        receipt: receipt || `order_${Date.now()}`,
        status: 'created',
        attempts: 0,
        created_at: Math.floor(Date.now() / 1000)
      };
      console.log('💡 Demo Mode: Created mock order:', mockOrder.id);
      return mockOrder;
    }

    if (!this.razorpayInstance) {
      throw new Error('Razorpay not configured. Please check payment settings.');
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
      payment_capture: 1,
    };

    try {
      const order = await this.razorpayInstance.orders.create(options);
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  verifyPaymentSignature(orderId, paymentId, signature) {
    // Demo mode - always return true for demo orders
    if (this.isDemo || orderId.includes('demo')) {
      console.log('💡 Demo Mode: Payment verification (always successful)');
      return true;
    }

    if (!this.razorpayInstance) {
      throw new Error('Razorpay not configured');
    }

    // Use the cached key secret loaded by initializeRazorpay(); fall back
    // to the env var as a last resort so legacy deployments still work.
    const keySecret = this.keySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('Razorpay key secret not configured');
    }

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
  }

  async getPaymentDetails(paymentId) {
    if (!this.razorpayInstance) {
      await this.initializeRazorpay();
    }

    try {
      const payment = await this.razorpayInstance.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Error fetching payment details:', error);
      throw new Error('Failed to fetch payment details');
    }
  }

  async refundPayment(paymentId, amount = null, reason = 'Customer request') {
    if (!this.razorpayInstance) {
      await this.initializeRazorpay();
    }

    try {
      const refundOptions = {
        payment_id: paymentId,
        reason: reason
      };

      if (amount) {
        refundOptions.amount = Math.round(amount * 100); // Convert to paise
      }

      const refund = await this.razorpayInstance.payments.refund(paymentId, refundOptions);
      return refund;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw new Error('Failed to process refund');
    }
  }

  async getSettings() {
    try {
      // Return demo settings if in demo mode
      if (this.isDemo) {
        return this.demoSettings;
      }

      const settings = await Settings.findOne();
      if (!settings?.payment?.razorpay?.enabled) {
        return null;
      }

      return {
        keyId: settings.payment.razorpay.keyId,
        environment: settings.payment.razorpay.environment,
        enabled: settings.payment.razorpay.enabled
      };
    } catch (error) {
      console.error('Error fetching payment settings:', error);
      return null;
    }
  }

  formatAmount(amount) {
    return Math.round(amount * 100); // Convert to paise
  }

  parseAmount(amountInPaise) {
    return amountInPaise / 100; // Convert from paise to rupees
  }
}

const paymentService = new PaymentService();
export default paymentService;