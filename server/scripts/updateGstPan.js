import mongoose from 'mongoose';
import Settings from '../models/Settings.js';
import '../config/db.js';

const updateGstPan = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    // Find existing settings
    const settings = await Settings.findOne();
    
    if (!settings) {
      console.log('❌ No settings found in database');
      return;
    }
    
    console.log('✅ Settings found, updating GST and PAN...');
    
    // Update the tax section with correct values
    const updatedSettings = await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          'tax.gstin': '10ASQPM7914B3ZW',
          'tax.pan': 'ASQPM7914B'
        }
      },
      { returnDocument: 'after', upsert: false }
    );
    
    console.log('✅ GST and PAN updated successfully!');
    console.log('New GST:', updatedSettings.tax.gstin);
    console.log('New PAN:', updatedSettings.tax.pan);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating GST and PAN:', error);
    process.exit(1);
  }
};

updateGstPan();
