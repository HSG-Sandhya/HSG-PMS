#!/usr/bin/env node

/**
 * Delete System Admin Profile Script
 * Usage: node scripts/deleteAdminProfile.js [username]
 * 
 * SAFETY FEATURES:
 * - Prevents deletion of the last system admin
 * - Requires confirmation
 * - Shows impact before deletion
 * - Option to deactivate instead of delete
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
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
    .select('username email firstName lastName isActive createdAt');
    
  if (admins.length === 0) {
    console.log('❌ No system administrators found!');
    return [];
  }
  
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. ${admin.username}`);
    console.log(`   Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Status: ${admin.isActive ? '🟢 Active' : '🔴 Inactive'}`);
    console.log(`   Created: ${admin.createdAt.toLocaleDateString()}`);
    console.log('');
  });
  
  return admins;
}

async function checkDeletionSafety(username) {
  console.log('\n🔒 Safety Check...');
  
  // Count total system admins
  const totalAdmins = await User.countDocuments({ isSystemAdmin: true });
  const activeAdmins = await User.countDocuments({ isSystemAdmin: true, isActive: true });
  
  console.log(`📊 Total System Admins: ${totalAdmins}`);
  console.log(`📊 Active System Admins: ${activeAdmins}`);
  
  // Prevent deletion of last admin
  if (totalAdmins <= 1) {
    console.log('🚨 CRITICAL WARNING: This is the last system administrator!');
    console.log('❌ Cannot delete - this would lock you out of the system!');
    console.log('💡 Create another system admin first, then delete this one.');
    return false;
  }
  
  // Warn if deleting last active admin
  if (activeAdmins <= 1) {
    const targetUser = await User.findOne({ username });
    if (targetUser && targetUser.isActive) {
      console.log('⚠️  WARNING: This is the last ACTIVE system administrator!');
      console.log('💡 Consider creating another active admin first.');
      
      const proceed = await askQuestion('Do you still want to proceed? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        return false;
      }
    }
  }
  
  return true;
}

async function showDeletionImpact(username) {
  console.log(`\n📋 Deletion Impact Analysis for: ${username}`);
  console.log('===========================================');
  
  const user = await User.findOne({ username }).populate('role department');
  
  if (!user) {
    console.log('❌ User not found!');
    return null;
  }
  
  console.log(`👤 User Details:`);
  console.log(`   Name: ${user.firstName} ${user.lastName}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role: ${user.role?.name || 'N/A'}`);
  console.log(`   Department: ${user.department?.name || 'N/A'}`);
  console.log(`   System Admin: ${user.isSystemAdmin ? 'Yes' : 'No'}`);
  console.log(`   Status: ${user.isActive ? 'Active' : 'Inactive'}`);
  
  // Check for related data (you can extend this)
  console.log(`\n📊 Related Data:`);
  console.log(`   User ID: ${user._id}`);
  console.log(`   Created: ${user.createdAt}`);
  console.log(`   Last Updated: ${user.updatedAt}`);
  
  // TODO: Add checks for:
  // - Bookings created by this user
  // - Staff managed by this user
  // - Settings changed by this user
  // - etc.
  
  return user;
}

async function deleteAdminProfile(username) {
  console.log(`\n🗑️  Deleting Admin Profile: ${username}`);
  console.log('=====================================');
  
  try {
    // Safety check
    const isSafe = await checkDeletionSafety(username);
    if (!isSafe) {
      return;
    }
    
    // Show impact
    const user = await showDeletionImpact(username);
    if (!user) {
      return;
    }
    
    // Offer alternatives
    console.log('\n🎯 Deletion Options:');
    console.log('1. Permanently DELETE the user account');
    console.log('2. DEACTIVATE the user (safer - can be reactivated)');
    console.log('3. REMOVE admin privileges only (keep as regular user)');
    console.log('0. Cancel');
    
    const choice = await askQuestion('\nChoose an option (0-3): ');
    
    switch (choice) {
      case '1':
        await permanentDelete(user);
        break;
      case '2':
        await deactivateUser(user);
        break;
      case '3':
        await removeAdminPrivileges(user);
        break;
      case '0':
        console.log('❌ Cancelled');
        return;
      default:
        console.log('❌ Invalid choice');
        return;
    }
    
  } catch (error) {
    console.error('❌ Error during deletion:', error.message);
  }
}

async function permanentDelete(user) {
  console.log('\n🚨 PERMANENT DELETION');
  console.log('This action CANNOT be undone!');
  
  const confirm1 = await askQuestion(`Type "${user.username}" to confirm deletion: `);
  if (confirm1 !== user.username) {
    console.log('❌ Username mismatch. Deletion cancelled.');
    return;
  }
  
  const confirm2 = await askQuestion('Type "DELETE" to confirm permanent deletion: ');
  if (confirm2 !== 'DELETE') {
    console.log('❌ Confirmation failed. Deletion cancelled.');
    return;
  }
  
  // Perform deletion
  await User.findByIdAndDelete(user._id);
  
  console.log('✅ User permanently deleted!');
  console.log(`📧 Deleted: ${user.username} (${user.email})`);
}

async function deactivateUser(user) {
  console.log('\n🔒 DEACTIVATING USER');
  console.log('User will be disabled but data preserved.');
  
  const confirm = await askQuestion('Confirm deactivation? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    return;
  }
  
  user.isActive = false;
  await user.save();
  
  console.log('✅ User deactivated!');
  console.log(`🔒 ${user.username} is now inactive`);
  console.log('💡 Can be reactivated later if needed');
}

async function removeAdminPrivileges(user) {
  console.log('\n👤 REMOVING ADMIN PRIVILEGES');
  console.log('User will become a regular user.');
  
  const confirm = await askQuestion('Remove admin privileges? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    return;
  }
  
  user.isSystemAdmin = false;
  user.permissions = []; // Remove all permissions
  
  // You might want to assign a default role here
  // const defaultRole = await Role.findOne({ name: 'Front Desk' });
  // if (defaultRole) user.role = defaultRole._id;
  
  await user.save();
  
  console.log('✅ Admin privileges removed!');
  console.log(`👤 ${user.username} is now a regular user`);
  console.log('💡 Admin privileges can be restored later if needed');
}

async function main() {
  console.log('🗑️  System Admin Profile Deletion Tool');
  console.log('======================================');
  console.log('⚠️  WARNING: This tool can permanently delete admin accounts!');
  console.log('💡 Always ensure you have backup admin access before deletion.');
  
  await connectDB();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // No username provided - show list and ask for selection
    const admins = await listAdmins();
    
    if (admins.length === 0) {
      console.log('❌ No system administrators found!');
      process.exit(1);
    }
    
    const choice = await askQuestion('\nEnter username to delete (or press Enter to cancel): ');
    
    if (choice.trim()) {
      await deleteAdminProfile(choice.trim());
    } else {
      console.log('❌ Cancelled');
    }
  } else {
    // Username provided as argument
    await deleteAdminProfile(args[0]);
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
