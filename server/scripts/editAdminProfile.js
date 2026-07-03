#!/usr/bin/env node

/**
 * Edit System Admin Profile Script
 * Usage: node scripts/editAdminProfile.js [username]
 * This script allows you to modify system admin profiles
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import models
import User from '../models/User.js';
import Role from '../models/Role.js';
import Department from '../models/Department.js';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function listAdmins() {
  console.log('\n👥 System Administrators:');
  console.log('========================');
  
  const admins = await User.find({ isSystemAdmin: true })
    .populate('role', 'name')
    .populate('department', 'name')
    .select('username email firstName lastName phone isActive profile');
    
  if (admins.length === 0) {
    console.log('❌ No system administrators found!');
    return [];
  }
  
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. ${admin.username}`);
    console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Phone: ${admin.phone}`);
    console.log(`   Status: ${admin.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Employee ID: ${admin.profile?.employeeId || 'N/A'}`);
    console.log('');
  });
  
  return admins;
}

async function editAdminProfile(username) {
  console.log(`\n🔧 Editing Admin Profile: ${username}`);
  console.log('=====================================');
  
  try {
    // Find the admin user
    const admin = await User.findOne({ username }).populate('role department');
    
    if (!admin) {
      console.log(`❌ User '${username}' not found!`);
      return;
    }
    
    if (!admin.isSystemAdmin) {
      console.log(`⚠️  User '${username}' is not a system administrator!`);
      const makeAdmin = await askQuestion('Do you want to make this user a system admin? (y/n): ');
      if (makeAdmin.toLowerCase() !== 'y') {
        return;
      }
    }
    
    console.log('\n📋 Current Profile:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Phone: ${admin.phone}`);
    console.log(`   Status: ${admin.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   Employee ID: ${admin.profile?.employeeId || 'N/A'}`);
    
    console.log('\n✏️  What would you like to edit?');
    console.log('1. Password');
    console.log('2. Email');
    console.log('3. Phone');
    console.log('4. Name (First & Last)');
    console.log('5. Employee ID');
    console.log('6. Account Status (Active/Inactive)');
    console.log('7. Make System Admin');
    console.log('8. All Profile Fields');
    console.log('0. Cancel');
    
    const choice = await askQuestion('\nEnter your choice (0-8): ');
    
    switch (choice) {
      case '1':
        await updatePassword(admin);
        break;
      case '2':
        await updateEmail(admin);
        break;
      case '3':
        await updatePhone(admin);
        break;
      case '4':
        await updateName(admin);
        break;
      case '5':
        await updateEmployeeId(admin);
        break;
      case '6':
        await updateStatus(admin);
        break;
      case '7':
        await makeSystemAdmin(admin);
        break;
      case '8':
        await updateAllFields(admin);
        break;
      case '0':
        console.log('❌ Cancelled');
        return;
      default:
        console.log('❌ Invalid choice');
        return;
    }
    
    await admin.save();
    console.log('\n✅ Profile updated successfully!');
    
    // Show updated profile
    console.log('\n📋 Updated Profile:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Phone: ${admin.phone}`);
    console.log(`   Status: ${admin.isActive ? 'Active' : 'Inactive'}`);
    console.log(`   System Admin: ${admin.isSystemAdmin ? 'Yes' : 'No'}`);
    console.log(`   Employee ID: ${admin.profile?.employeeId || 'N/A'}`);
    
  } catch (error) {
    console.error('❌ Error editing profile:', error.message);
  }
}

async function updatePassword(admin) {
  const newPassword = await askQuestion('Enter new password: ');
  if (newPassword.length < 6) {
    console.log('❌ Password must be at least 6 characters');
    return;
  }
  
  const confirmPassword = await askQuestion('Confirm new password: ');
  if (newPassword !== confirmPassword) {
    console.log('❌ Passwords do not match');
    return;
  }
  
  admin.password = await bcrypt.hash(newPassword, 12);
  console.log('✅ Password updated');
}

async function updateEmail(admin) {
  const newEmail = await askQuestion('Enter new email: ');
  if (!newEmail.includes('@')) {
    console.log('❌ Invalid email format');
    return;
  }
  
  // Check if email already exists
  const existingUser = await User.findOne({ email: newEmail, _id: { $ne: admin._id } });
  if (existingUser) {
    console.log('❌ Email already exists');
    return;
  }
  
  admin.email = newEmail;
  console.log('✅ Email updated');
}

async function updatePhone(admin) {
  const newPhone = await askQuestion('Enter new phone number (10 digits): ');
  if (!/^\d{10}$/.test(newPhone)) {
    console.log('❌ Phone must be 10 digits');
    return;
  }
  
  admin.phone = newPhone;
  console.log('✅ Phone updated');
}

async function updateName(admin) {
  const firstName = await askQuestion('Enter first name: ');
  const lastName = await askQuestion('Enter last name: ');
  
  if (firstName.trim()) admin.firstName = firstName.trim();
  if (lastName.trim()) admin.lastName = lastName.trim();
  
  console.log('✅ Name updated');
}

async function updateEmployeeId(admin) {
  const employeeId = await askQuestion('Enter employee ID: ');
  
  if (!admin.profile) admin.profile = {};
  admin.profile.employeeId = employeeId;
  
  console.log('✅ Employee ID updated');
}

async function updateStatus(admin) {
  const status = await askQuestion('Set account status (active/inactive): ');
  admin.isActive = status.toLowerCase() === 'active';
  console.log(`✅ Status set to ${admin.isActive ? 'Active' : 'Inactive'}`);
}

async function makeSystemAdmin(admin) {
  const confirm = await askQuestion('Make this user a System Administrator? (y/n): ');
  if (confirm.toLowerCase() === 'y') {
    admin.isSystemAdmin = true;
    admin.permissions = ['*'];
    
    // Set System Administrator role
    const adminRole = await Role.findOne({ name: 'System Administrator' });
    if (adminRole) {
      admin.role = adminRole._id;
    }
    
    console.log('✅ User promoted to System Administrator');
  }
}

async function updateAllFields(admin) {
  console.log('\n📝 Updating All Fields (press Enter to skip):');
  
  const firstName = await askQuestion(`First Name (${admin.firstName}): `);
  const lastName = await askQuestion(`Last Name (${admin.lastName}): `);
  const email = await askQuestion(`Email (${admin.email}): `);
  const phone = await askQuestion(`Phone (${admin.phone}): `);
  const employeeId = await askQuestion(`Employee ID (${admin.profile?.employeeId || 'N/A'}): `);
  const newPassword = await askQuestion('New Password (leave empty to keep current): ');
  
  if (firstName.trim()) admin.firstName = firstName.trim();
  if (lastName.trim()) admin.lastName = lastName.trim();
  if (email.trim() && email.includes('@')) admin.email = email.trim();
  if (phone.trim() && /^\d{10}$/.test(phone)) admin.phone = phone.trim();
  
  if (employeeId.trim()) {
    if (!admin.profile) admin.profile = {};
    admin.profile.employeeId = employeeId.trim();
  }
  
  if (newPassword.trim() && newPassword.length >= 6) {
    admin.password = await bcrypt.hash(newPassword, 12);
  }
  
  console.log('✅ All fields updated');
}

async function main() {
  console.log('🔧 System Admin Profile Editor');
  console.log('==============================');
  
  await connectDB();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // No username provided - show list and ask for selection
    const admins = await listAdmins();
    
    if (admins.length === 0) {
      console.log('❌ No system administrators found!');
      process.exit(1);
    }
    
    const choice = await askQuestion('\nEnter username to edit (or press Enter to cancel): ');
    
    if (choice.trim()) {
      await editAdminProfile(choice.trim());
    } else {
      console.log('❌ Cancelled');
    }
  } else {
    // Username provided as argument
    await editAdminProfile(args[0]);
  }
  
  rl.close();
  process.exit(0);
}

// Handle cleanup
process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

// Run the script
main().catch(console.error);
