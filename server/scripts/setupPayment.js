import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Settings from '../models/Settings.js';

dotenv.config();

const setupPaymentConfiguration = async () => {
  try {
    // Connect to MongoDB using environment variable
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pms_web';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    console.log('Using MongoDB URI:', mongoUri.replace(/\/\/.*@/, '//*****@')); // Hide credentials

    // Find or create settings
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create new settings with basic structure
      settings = new Settings({
        hotelName: 'Hotel Sandhya Grand',
        legalName: 'Hotel Sandhya Grand & Marriage Hall',
        starRating: 4,
        yearEstablished: 2020,
        description: 'Luxury hotel and marriage hall',
        address: {
          street: '123 Luxury Avenue',
          city: 'City Name',
          state: 'State Name',
          country: 'India',
          postalCode: '123456'
        },
        contact: {
          phone: '+91 98765 43210',
          email: 'info@sandhyagrand.com',
          website: 'https://sandhyagrand.com'
        }
      });
    }

    // Update payment settings
    settings.payment = {
      upi: {
        upiId: 'sandhyagrand@upi',
        accountName: 'Hotel Sandhya Grand',
        qrCodeUrl: ''
      },
      razorpay: {
        enabled: true,
        environment: 'test', // Change to 'live' for production
        keyId: 'rzp_test_YOUR_KEY_ID', // Replace with your actual test key
        keySecret: 'YOUR_KEY_SECRET' // Replace with your actual test secret
      }
    };

    await settings.save();
    
    console.log('✅ Payment configuration updated successfully!');
    console.log('📝 Please update the following in your .env file or directly in the database:');
    console.log('   - RAZORPAY_KEY_ID: Your actual Razorpay Key ID');
    console.log('   - RAZORPAY_KEY_SECRET: Your actual Razorpay Key Secret');
    console.log('   - RAZORPAY_WEBHOOK_SECRET: Your webhook secret (optional)');
    console.log('');
    console.log('🔐 Current test configuration:');
    console.log(`   - Enabled: ${settings.payment.razorpay.enabled}`);
    console.log(`   - Environment: ${settings.payment.razorpay.environment}`);
    console.log(`   - Key ID: ${settings.payment.razorpay.keyId}`);
    console.log('');
    console.log('🚀 Payment gateway is now ready for testing!');
    
  } catch (error) {
    console.error('❌ Error setting up payment configuration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the setup
setupPaymentConfiguration();