import Razorpay from 'razorpay';
import crypto from 'crypto';
import Settings from '../models/Settings.js';
import { getCurrentTenant } from '../db/tenantContext.js';

// Multi-tenant payments: every hotel has its own Razorpay credentials in its own
// Settings doc, so the gateway client must be resolved per hotel — never a single
// shared singleton. We cache one resolved config per tenant slug and rebuild it
// on demand (and when that hotel saves its Payments settings, via reload()).
//
// The current tenant comes from the request's tenant context (AsyncLocalStorage),
// so `Settings.findOne()` here reads the right hotel's document automatically.

class PaymentService {
  constructor() {
    this.demoSettings = {
      keyId: 'rzp_test_demo_key',
      environment: 'test',
      enabled: true,
    };
    // tenant slug → { razorpayInstance, keySecret, environment, enabled, isDemo }
    this.byTenant = new Map();
    // NOTE: do NOT read Settings in the constructor. This singleton is built at
    // import time — before connectDB() — so a query here would buffer and time
    // out. Configs are built lazily on first use per tenant.
  }

  // Build a fresh config for `slug` by reading the current tenant's Settings.
  async buildConfig(slug) {
    const demo = {
      razorpayInstance: null,
      keySecret: null,
      environment: 'test',
      enabled: false,
      isDemo: true,
    };
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
          return {
            razorpayInstance: new Razorpay({ key_id: keyId, key_secret: keySecret }),
            keySecret,
            environment: razor.environment || 'test',
            enabled: true,
            isDemo: false,
          };
        }
        // Enabled but still on placeholder keys → treat as demo (but "enabled").
        return { ...demo, enabled: true };
      }

      return demo;
    } catch (error) {
      console.error(`Error initializing Razorpay for tenant "${slug}":`, error);
      return demo;
    }
  }

  // Resolve (and cache) the current tenant's Razorpay config.
  async getConfig() {
    const slug = getCurrentTenant().slug;
    const cached = this.byTenant.get(slug);
    if (cached) return cached;
    const cfg = await this.buildConfig(slug);
    this.byTenant.set(slug, cfg);
    return cfg;
  }

  /**
   * Drop and rebuild the CURRENT tenant's cached config. Called from the settings
   * controller after that hotel saves its Payments section, so new keys take
   * effect immediately without a restart and without touching other hotels.
   */
  async reload() {
    this.byTenant.delete(getCurrentTenant().slug);
    return this.getConfig();
  }

  /** Pre-warm the current tenant's config (server.js calls this at boot for the
   *  base hotel). Kept for compatibility; getConfig() is otherwise lazy. */
  async initializeRazorpay() {
    const slug = getCurrentTenant().slug;
    this.byTenant.delete(slug);
    const cfg = await this.getConfig();
    if (cfg.isDemo) {
      console.log(`💡 Payment Service [${slug}]: DEMO mode (no real Razorpay credentials)`);
    } else {
      console.log(`✅ Payment Service [${slug}]: Razorpay initialised in ${cfg.environment.toUpperCase()} mode`);
    }
    return cfg;
  }

  async createOrder(amount, currency = 'INR', receipt = null) {
    const cfg = await this.getConfig();

    // Demo mode - return mock order
    if (cfg.isDemo) {
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
        created_at: Math.floor(Date.now() / 1000),
      };
      console.log('💡 Demo Mode: Created mock order:', mockOrder.id);
      return mockOrder;
    }

    if (!cfg.razorpayInstance) {
      throw new Error('Razorpay not configured. Please check payment settings.');
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
      payment_capture: 1,
    };

    try {
      return await cfg.razorpayInstance.orders.create(options);
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw new Error('Failed to create payment order');
    }
  }

  /** Whether the current tenant is running without real gateway credentials. */
  async isDemoMode() {
    return (await this.getConfig()).isDemo;
  }

  async verifyPaymentSignature(orderId, paymentId, signature) {
    const cfg = await this.getConfig();

    // Demo mode (no real gateway keys) always verifies. We must NOT treat a
    // client-supplied "demo" order id as demo here: in live mode that would let a
    // forged `order_demo_*` id skip the real HMAC check entirely.
    if (cfg.isDemo) {
      console.log('💡 Demo Mode: Payment verification (always successful)');
      return true;
    }

    if (!cfg.razorpayInstance) {
      throw new Error('Razorpay not configured');
    }

    // Use the tenant's key secret; fall back to the env var as a last resort so
    // legacy single-tenant deployments still work.
    const keySecret = cfg.keySecret || process.env.RAZORPAY_KEY_SECRET;
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
    const cfg = await this.getConfig();
    if (!cfg.razorpayInstance) {
      throw new Error('Razorpay not configured');
    }

    try {
      return await cfg.razorpayInstance.payments.fetch(paymentId);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      throw new Error('Failed to fetch payment details');
    }
  }

  async refundPayment(paymentId, amount = null, reason = 'Customer request') {
    const cfg = await this.getConfig();
    if (!cfg.razorpayInstance) {
      throw new Error('Razorpay not configured');
    }

    try {
      const refundOptions = { payment_id: paymentId, reason };
      if (amount) {
        refundOptions.amount = Math.round(amount * 100); // Convert to paise
      }
      return await cfg.razorpayInstance.payments.refund(paymentId, refundOptions);
    } catch (error) {
      console.error('Error processing refund:', error);
      throw new Error('Failed to process refund');
    }
  }

  async getSettings() {
    try {
      const cfg = await this.getConfig();
      if (cfg.isDemo) {
        return this.demoSettings;
      }

      const settings = await Settings.findOne();
      if (!settings?.payment?.razorpay?.enabled) {
        return null;
      }

      return {
        keyId: settings.payment.razorpay.keyId,
        environment: settings.payment.razorpay.environment,
        enabled: settings.payment.razorpay.enabled,
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
