import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCardIcon, 
  ShieldCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';

const PaymentGateway = ({ 
  amount, 
  currency = 'INR', 
  bookingData, 
  onSuccess, 
  onFailure, 
  onCancel,
  customerInfo,
  description = 'Hotel Booking Payment'
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [error, setError] = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    loadRazorpayScript();
    // Get payment configuration
    fetchPaymentConfig();
  }, []);

  const loadRazorpayScript = () => {
    if (window.Razorpay) {
      setRazorpayLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      setRazorpayLoaded(true);
    };
    script.onerror = () => {
      setError('Failed to load payment gateway. Please try again.');
    };
    document.body.appendChild(script);
  };

  const fetchPaymentConfig = async () => {
    try {
      const response = await axios.get('/api/website/payment/config');
      setPaymentConfig(response.data);
      
      if (!response.data.enabled) {
        setError('Online payments are currently unavailable. Please try paying at the hotel.');
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
      setError('Payment gateway configuration error. Please contact support.');
    }
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const processPayment = async () => {
    if (!paymentConfig?.enabled) {
      toast.error('Online payments are currently unavailable.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create Razorpay order
      const orderResponse = await axios.post('/api/website/create-razorpay-order', {
        amount: amount,
        currency: currency,
        receipt: `booking_${Date.now()}`
      });

      const order = orderResponse.data;

      // Check if this is demo mode (mock order)
      if (order.id && order.id.includes('demo')) {
        // Demo mode - simulate payment success after a delay
        toast.info('🎭 Demo Mode: Simulating payment process...');
        
        setTimeout(() => {
          // Simulate successful payment
          const mockPaymentInfo = {
            paymentId: `pay_demo_${Date.now()}`,
            orderId: order.id,
            signature: `demo_signature_${Date.now()}`,
            amount: order.amount / 100,
            currency: order.currency,
            status: 'paid',
            gateway: 'razorpay',
            paymentDate: new Date().toISOString()
          };
          
          setLoading(false);
          onSuccess(mockPaymentInfo);
          toast.success('🎭 Demo payment successful! Your booking has been confirmed.');
        }, 2000);
        
        return;
      }

      // Real Razorpay mode - check if script is loaded
      if (!razorpayLoaded) {
        toast.error('Payment gateway not loaded. Please refresh and try again.');
        setLoading(false);
        return;
      }

      // Step 2: Open Razorpay checkout
      const options = {
        key: paymentConfig.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Hotel Sandhya Grand',
        description: description,
        order_id: order.id,
        
        handler: async function (response) {
          // Step 3: Verify payment
          try {
            const verifyResponse = await axios.post('/api/website/verify-razorpay-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyResponse.data.success) {
              // Payment successful
              const paymentInfo = {
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                amount: order.amount / 100, // Convert from paise
                currency: order.currency,
                status: 'paid',
                gateway: 'razorpay',
                paymentDate: new Date().toISOString()
              };

              onSuccess(paymentInfo);
              toast.success('Payment successful! Your booking has been confirmed.');
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (verifyError) {
            console.error('Payment verification error:', verifyError);
            onFailure(verifyError);
            toast.error('Payment verification failed. Please contact support.');
          }
          setLoading(false);
        },

        modal: {
          ondismiss: function() {
            setLoading(false);
            onCancel && onCancel();
            toast.info('Payment cancelled by user.');
          }
        },

        prefill: {
          name: customerInfo?.name || '',
          email: customerInfo?.email || '',
          contact: customerInfo?.phone || ''
        },

        theme: {
          color: '#6366F1'
        },

        notes: {
          booking_type: 'hotel_room',
          customer_id: customerInfo?.customerId || ''
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response) {
        setLoading(false);
        const error = {
          code: response.error.code,
          description: response.error.description,
          source: response.error.source,
          step: response.error.step,
          reason: response.error.reason
        };
        onFailure(error);
        toast.error(`Payment failed: ${response.error.description}`);
      });

      rzp.open();

    } catch (error) {
      setLoading(false);
      console.error('Payment initiation error:', error);
      setError(error.response?.data?.message || 'Failed to initiate payment');
      toast.error('Failed to initiate payment. Please try again.');
    }
  };

  const PaymentSummary = () => (
    <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Payment Summary</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Amount</span>
          <span className="font-medium">{formatAmount(amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Payment Gateway</span>
          <span className="font-medium">Razorpay</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Security</span>
          <span className="font-medium text-green-600">SSL Encrypted</span>
        </div>
      </div>
      
      <div className="border-t pt-4">
        <div className="flex justify-between text-lg font-semibold">
          <span>Total Amount</span>
          <span className="text-indigo-600">{formatAmount(amount)}</span>
        </div>
      </div>
    </div>
  );

  const SecurityFeatures = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <ShieldCheckIcon className="h-5 w-5 text-green-500" />
        <span>SSL Encrypted</span>
      </div>
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <CreditCardIcon className="h-5 w-5 text-blue-500" />
        <span>PCI Compliant</span>
      </div>
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <ClockIcon className="h-5 w-5 text-purple-500" />
        <span>Instant Processing</span>
      </div>
    </div>
  );

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3">
          <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-red-800">Payment Error</h3>
            <p className="text-red-600 mt-1">{error}</p>
          </div>
        </div>
        
        <div className="mt-4 space-y-2">
          <button
            onClick={() => {
              setError(null);
              fetchPaymentConfig();
            }}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-full press-3d hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-full press-3d hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Secure Payment</h2>
        <p className="text-gray-600">Complete your booking with our secure payment gateway</p>
      </div>

      <PaymentSummary />

      <div className="space-y-4">
        <button
          onClick={processPayment}
          disabled={loading || !razorpayLoaded || !paymentConfig?.enabled}
          className={`w-full py-4 px-6 rounded-full font-semibold text-white transition-all duration-200 ${
            loading || !razorpayLoaded || !paymentConfig?.enabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-[0_10px_24px_-10px_rgba(79,70,229,0.6)]'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                  fill="none"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <CreditCardIcon className="h-5 w-5" />
              <span>Pay {formatAmount(amount)}</span>
            </div>
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-3 px-6 rounded-full press-3d font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <SecurityFeatures />

      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>🔒 Your payment information is encrypted and secure</p>
        <p>We accept all major credit cards, debit cards, UPI, and net banking</p>
        {paymentConfig?.keyId === 'rzp_test_demo_key' && (
          <p className="text-blue-600 font-medium">🎭 Demo Mode: Payment simulation for testing</p>
        )}
      </div>
    </motion.div>
  );
};

export default PaymentGateway;