import Settings from '../models/Settings.js';
import Staff from '../models/Staff.js';
import Department from '../models/Department.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import Image from '../models/Image.js';
import { modelFor } from '../db/modelRegistry.js';
import { optimizeImage } from '../utils/imageOptimizer.js';
import { PERMISSION_CATALOG } from '../config/permissions.js';
import { sendOtp, verifyOtp, isVerified } from '../services/otpService.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import {
  getTemplateList as listInvoiceTemplates,
  getTemplate as getInvoiceTemplate,
  DEFAULT_TEMPLATE_ID,
  renderInvoice,
  normalizeInvoiceContext,
} from '../services/invoiceTemplates/index.js';
import {
  getBanquetTemplateList as listBanquetTemplates,
  getBanquetTemplate,
  DEFAULT_BANQUET_TEMPLATE_ID,
  renderBanquetDocument,
} from '../services/invoiceTemplates/banquetIndex.js';
import { resolveLogo } from '../utils/resolveLogo.js';
import paymentService from '../services/paymentService.js';
import { invalidateOperationalConfig } from '../config/operationalConfig.js';
import { callerHasAnyPermission } from '../middleware/requireManage.js';
import {
  serializeSettings,
  preserveSecrets,
  preserveSectionSecrets,
  sectionIsPrivileged,
  VIEW_SETTINGS_PERMISSIONS,
} from '../services/settingsRedaction.js';

// Every GET on this router is reachable by any authenticated account — the
// router only gates mutations. So the read side has to answer "who is asking?"
// itself rather than assume the caller is an administrator.
const canViewAllSettings = (req) => callerHasAnyPermission(req, VIEW_SETTINGS_PERMISSIONS);

// Import models to ensure they're registered
import '../models/Room.js';
import '../models/Guest.js';
import '../models/Booking.js';
import '../models/BanquetBooking.js';
import '../models/BanquetHall.js';
import '../models/Housekeeping.js';

// Helper function to get or create settings
const getOrCreateSettings = async () => {
  return await Settings.getSettings();
};

// Helper function to get settings
const getSettings = async () => {
  return await Settings.getSettings();
};

// --- Utility Functions ---
/**
 * Validate a string is a non-empty trimmed value.
 */
function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Normalize category object from payload.
 * Supports either a string ("Deluxe") or an object ({ _id?, name, code?, description? }).
 */
function normalizeCategory(payload) {
  if (typeof payload === "string") {
    return { name: payload.trim() };
  }
  if (payload && typeof payload === "object") {
    const obj = {
      name: isNonEmptyString(payload.name) ? payload.name.trim() : undefined,
      code: isNonEmptyString(payload.code) ? payload.code.trim() : undefined,
      description: isNonEmptyString(payload.description)
        ? payload.description.trim()
        : undefined,
      // Handle additional fields from frontend
      basePrice: typeof payload.basePrice === "number" ? payload.basePrice : undefined,
      maxOccupancy: typeof payload.maxOccupancy === "number" ? payload.maxOccupancy : undefined,
      amenities: Array.isArray(payload.amenities) ? payload.amenities : undefined,
      // preserve id if provided (useful for update)
      _id: payload._id && String(payload._id),
    };
    // Remove undefined fields
    Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
    return obj;
  }
  return {};
}

// === CORE SETTINGS OPERATIONS ===

// GET /api/settings/public/branding - Hotel identity for the login screen, NO
// auth required. Multi-tenant: resolves to the hotel of the request's subdomain,
// so each hotel's login shows its own name, tagline and logo. Nothing sensitive.
export const getPublicBranding = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const hp = settings?.hotelProfile || {};
    return res.status(200).json({
      success: true,
      data: {
        hotelName: hp.hotelName || settings?.hotelName || '',
        tagline: hp.description || settings?.description || '',
        // A stored "/api/images/<id>" ref resolves same-origin on the login page
        // (it hits this hotel's DB), so pass it through as-is.
        logo: hp.logo || '',
      },
      message: 'Branding retrieved successfully',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch branding',
      error: err.message,
    });
  }
};

// GET /api/settings/public/theme - Theme section only, NO auth required.
// The login screen renders before any user is signed in but must still follow
// the appearance settings; nothing in `theme` is sensitive.
export const getPublicTheme = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    return res.status(200).json({
      success: true,
      data: settings?.theme || {},
      message: 'Theme retrieved successfully'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch theme',
      error: err.message
    });
  }
};

// GET /api/settings - Get all settings
export const getAllSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    // Secrets are stripped for everyone; the administrator-only sections are
    // stripped for callers without view_settings. The app's own screens read
    // branding, billing, invoice, room categories and guest messaging, so an
    // ordinary staff account still gets a working document rather than a 403.
    const data = serializeSettings(settings, { canViewAll: await canViewAllSettings(req) });

    return res.status(200).json({
      success: true,
      data,
      message: "Settings retrieved successfully"
    });
  } catch (err) {
    // Error fetching settings
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch settings", 
      error: err.message 
    });
  }
};

// GET /api/settings/section/:section - Get specific section
export const getSettingsSection = async (req, res) => {
  try {
    const { section } = req.params;

    // A named section is the same data by another door: /section/payment and the
    // legacy /payment alias both land here, so the check belongs here too.
    const canViewAll = await canViewAllSettings(req);
    if (sectionIsPrivileged(section) && !canViewAll) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
        required: VIEW_SETTINGS_PERMISSIONS,
      });
    }

    const settings = await Settings.getSection(section);

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: `Settings section '${section}' not found`
      });
    }

    // Re-root the redaction at the whole document so the dotted secret paths
    // still line up, then hand back just the section.
    const data = serializeSettings({ [section]: settings }, { canViewAll })[section];

    return res.status(200).json({
      success: true,
      data,
      message: `${section} settings retrieved successfully`
    });
  } catch (err) {
    // Error fetching settings
    return res.status(500).json({ 
      success: false, 
      message: `Failed to fetch ${req.params.section} settings`, 
      error: err.message 
    });
  }
};

// PUT /api/settings/section/:section - Update specific section
export const updateSettingsSection = async (req, res) => {
  try {
    const { section } = req.params;
    const updateData = req.body;
    
    // Validate section parameter
    if (!section || typeof section !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid section parameter'
      });
    }
    
    // Validate request body
    if (!updateData || typeof updateData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data'
      });
    }
    
    // Validate invoice section data structure
    if (section === 'invoice') {
      const validFields = ['templateCustomization', 'prefix', 'nextNumber', 'footerNote', 'footerText', 'showQrOnInvoice', 'showGstBreakup', 'selectedTemplate', 'template', 'includeGST', 'autoGenerate', 'signatureUrl'];
      const hasValidField = Object.keys(updateData).some(key => validFields.includes(key));
      
      if (!hasValidField) {
        return res.status(400).json({
          success: false,
          message: 'Invalid invoice data structure. Valid fields: ' + validFields.join(', ')
        });
      }
    }
    
    // The client was never sent the stored secrets, so it cannot send them back.
    // Without this, saving the Payments form would write the blank fields it
    // rendered over a live gateway key.
    const stored = await Settings.getSettings();
    const safeData = preserveSectionSecrets(section, updateData, stored);

    const updatedSettings = await Settings.updateSection(section, safeData);

    // Drop the operational config cache so billing/operations edits (GST rate,
    // breakfast charge, invoice prefix, default times, housekeeping rules) take
    // effect on the very next booking/POS request rather than after the TTL.
    if (section === 'billing' || section === 'operations') {
      invalidateOperationalConfig();
    }

    // When the payment section is updated, refresh the Razorpay client so
    // new keys take effect immediately without a server restart.
    if (section === 'payment') {
      try { await paymentService.reload(); }
      catch (e) { console.error('paymentService.reload failed after settings save:', e); }
    }

    return res.status(200).json({
      success: true,
      data: serializeSettings({ [section]: updatedSettings }, { canViewAll: true })[section],
      message: `${section} settings updated successfully`
    });
  } catch (err) {
    // Error updating settings
    return res.status(500).json({ 
      success: false, 
      message: `Failed to update ${req.params.section} settings`, 
      error: err.message 
    });
  }
};

// PUT /api/settings - Update all settings
export const updateAllSettings = async (req, res) => {
  try {
    const updateData = req.body;

    const settings = await Settings.getSettings();
    // Same reasoning as the section update: a blank secret means "unchanged".
    Object.assign(settings, preserveSecrets(updateData, settings));
    await settings.save();

    return res.status(200).json({
      success: true,
      data: serializeSettings(settings, { canViewAll: true }),
      message: "Settings updated successfully"
    });
  } catch (err) {
    // Error updating settings
    return res.status(500).json({ 
      success: false, 
      message: "Failed to update settings", 
      error: err.message 
    });
  }
};

// Reset settings to defaults
const resetSettings = async (req, res) => {
  try {
    // Delete existing settings and let getSettings create new defaults
    await Settings.deleteMany({});
    const defaultSettings = await Settings.getSettings();
    
    res.status(200).json({
      success: true,
      data: defaultSettings,
      message: 'Settings reset to defaults successfully'
    });
  } catch (error) {
    // Error resetting settings
    res.status(500).json({
      success: false,
      message: 'Failed to reset settings',
      error: error.message
    });
  }
};

// Upload logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Compress before storing — logos are shown small, so cap at 800px and use a
    // high-quality WebP (near-lossless for graphics/text) to keep the served
    // /api/images payload tiny. Falls back to the raw bytes on any sharp failure.
    const isImage = req.file.mimetype?.startsWith('image/');
    const optimized = isImage
      ? await optimizeImage(req.file.buffer, {
          maxWidth: 800,
          quality: 90,
          contentType: req.file.mimetype,
        })
      : { buffer: req.file.buffer, contentType: req.file.mimetype, size: req.file.size };

    // Store the binary in the Image collection (NOT inline as base64) and
    // persist a small URL reference on the Settings document.
    const image = await Image.create({
      data: optimized.buffer,
      contentType: optimized.contentType,
      filename: req.file.originalname,
      size: optimized.size,
      category: 'logo',
      uploadedBy: req.user?.id || null,
    });

    const logoUrl = `/api/images/${image._id}`;
    const existing = await Settings.findOne({});
    if (existing) {
      await Settings.updateOne(
        { _id: existing._id },
        { $set: { 'hotelProfile.logo': logoUrl } },
        { runValidators: false },
      );
    } else {
      await Settings.create({
        hotelName: 'Hotel Sandhya Grand',
        hotelProfile: { logo: logoUrl },
      });
    }

    res.status(200).json({
      success: true,
      data: { logo: logoUrl, logoUrl },
      message: 'Logo uploaded successfully',
    });
  } catch (error) {
    console.error('uploadLogo failed:', error);
    res.status(500).json({ success: false, message: 'Failed to upload logo' });
  }
};

// Upload background image
const uploadBackgroundImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Convert to base64
    const base64Image = req.file.buffer.toString('base64');
    const imageDataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

    // Update theme with background image
    const settings = await Settings.updateSection('theme', {
      backgroundImage: imageDataUrl
    });

    res.status(200).json({
      success: true,
      data: { backgroundImage: imageDataUrl },
      message: 'Background image uploaded successfully'
    });
  } catch (error) {
    // Error uploading background image
    res.status(500).json({
      success: false,
      message: 'Failed to upload background image',
      error: error.message
    });
  }
};

// Get room categories from settings
const getRoomCategories = async (req, res) => {
  try {
    // Get raw settings document to access categories directly
    let settingsDoc = await Settings.findOne({});
    if (!settingsDoc) {
      settingsDoc = new Settings({
        hotelName: 'Hotel Sandhya Grand',
      });
      await settingsDoc.save();
    }
    const categories = settingsDoc.categories || [];
    
    // Transform categories to include proper structure
    const formattedCategories = categories.map(category => ({
      id: category._id || category.id,
      _id: category._id || category.id,
      name: category.name,
      description: category.description || '',
      basePrice: category.basePrice || 0,
      maxOccupancy: category.maxOccupancy || 2,
      amenities: category.amenities || [],
      isActive: category.isActive !== false
    }));
    
    res.status(200).json({ 
      success: true, 
      data: { categories: formattedCategories }, 
      message: `Retrieved ${formattedCategories.length} room categories` 
    });
  } catch (error) {
    // Error fetching room categories
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch room categories',
      error: error.message 
    });
  }
};

const initializeRoomCategories = async (req, res) => {
  try {
    // Get the raw settings document to check for existing categories
    let settingsDoc = await Settings.findOne({});
    
    // Check if force reset is requested or if categories need updating
    const forceReset = req.body?.forceReset || req.query?.forceReset;
    
    // Check if categories already exist and don't need reset
    if (!forceReset && settingsDoc && settingsDoc.categories && settingsDoc.categories.length > 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'Room categories already initialized',
        data: { categories: settingsDoc.categories }
      });
    }
    
    // If force reset is requested, clear existing categories
    if (forceReset && settingsDoc) {
      settingsDoc.categories = [];
    }
    
    // Create settings document if it doesn't exist
    if (!settingsDoc) {
      settingsDoc = new Settings({
        hotelName: 'Hotel Sandhya Grand',
      });
    }
    
    // Default room categories based on common hotel room types
    const defaultCategories = [
      {
        name: 'Standard AC',
        description: 'Standard with air conditioning',
        basePrice: 2000,
        maxOccupancy: 2,
        amenities: ['Air Conditioning', 'TV', 'WiFi']
      },
      {
        name: 'Deluxe AC',
        description: 'Deluxe with premium amenities',
        basePrice: 3000,
        maxOccupancy: 3,
        amenities: ['Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed']
      },
      {
        name: 'Premium',
        description: 'Premium with luxury features',
        basePrice: 4500,
        maxOccupancy: 4,
        amenities: ['Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed', 'Balcony']
      },
      {
        name: 'Premium Plus',
        description: 'Premium Plus with enhanced luxury features',
        basePrice: 5500,
        maxOccupancy: 4,
        amenities: ['Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed', 'Balcony', 'City View']
      },
      {
        name: 'Executive',
        description: 'Executive with business amenities',
        basePrice: 6000,
        maxOccupancy: 4,
        amenities: ['Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed', 'Balcony', 'City View']
      },
      {
        name: 'Super Deluxe',
        description: 'Super Deluxe with top-tier amenities',
        basePrice: 6500,
        maxOccupancy: 5,
        amenities: ['Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed', 'Balcony', 'City View']
      },
      {
        name: 'Suite',
        description: 'Luxury suite with separate living area',
        basePrice: 7000,
        maxOccupancy: 6,
        amenities: ['Air Conditioning', 'TV', 'WiFi', 'Room Service', 'King Bed', 'Balcony', 'City View', 'Bathtub']
      },
      {
        name: 'Economic Non AC',
        description: 'Budget-friendly without air conditioning',
        basePrice: 1200,
        maxOccupancy: 2,
        amenities: ['TV', 'WiFi']
      },
      {
        name: 'Standard Non AC',
        description: 'Standard without air conditioning',
        basePrice: 1500,
        maxOccupancy: 2,
        amenities: ['TV', 'WiFi']
      }
    ];
    
    // Add categories to settings document
    settingsDoc.categories = defaultCategories;
    await settingsDoc.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Room categories initialized successfully',
      data: { categories: settingsDoc.categories }
    });
  } catch (error) {
    // Error initializing room categories
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initialize room categories',
      error: error.message 
    });
  }
};

const addRoomCategory = async (req, res) => {
  try {
    const { name, description, basePrice, maxOccupancy, amenities } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    let settingsDoc = await Settings.findOne({});
    if (!settingsDoc) {
      settingsDoc = new Settings({ hotelName: 'Hotel Sandhya Grand' });
    }
    if (!Array.isArray(settingsDoc.categories)) settingsDoc.categories = [];

    settingsDoc.categories.push({
      name: name.trim(),
      description: (description || '').trim(),
      basePrice: Number(basePrice) || 0,
      maxOccupancy: Number(maxOccupancy) || 2,
      amenities: Array.isArray(amenities)
        ? amenities
        : String(amenities || '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    settingsDoc.markModified('categories');
    await settingsDoc.save({ validateModifiedOnly: true });

    const created = settingsDoc.categories[settingsDoc.categories.length - 1];
    res.status(201).json({ success: true, message: 'Room category added', data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add room category', error: error.message });
  }
};

const findCategory = (doc, id) => {
  if (!doc || !Array.isArray(doc.categories)) return null;
  try {
    const byId = typeof doc.categories.id === 'function' ? doc.categories.id(id) : null;
    if (byId) return byId;
  } catch {
    // invalid ObjectId — fall back to manual match
  }
  return doc.categories.find((c) => String(c._id) === String(id) || c.id === id) || null;
};

const updateRoomCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, basePrice, maxOccupancy, amenities } = req.body || {};

    const settingsDoc = await Settings.findOne({});
    const category = findCategory(settingsDoc, id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
    }

    if (name !== undefined) category.name = name.trim();
    if (description !== undefined) category.description = (description || '').trim();
    if (basePrice !== undefined) category.basePrice = Number(basePrice) || 0;
    if (maxOccupancy !== undefined) category.maxOccupancy = Number(maxOccupancy) || 2;
    if (amenities !== undefined) {
      category.amenities = Array.isArray(amenities)
        ? amenities
        : String(amenities || '').split(',').map((s) => s.trim()).filter(Boolean);
    }
    category.updatedAt = new Date();
    settingsDoc.markModified('categories');
    await settingsDoc.save({ validateModifiedOnly: true });

    res.status(200).json({ success: true, message: 'Room category updated', data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update room category', error: error.message });
  }
};

const deleteRoomCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const settingsDoc = await Settings.findOne({});
    if (!settingsDoc || !Array.isArray(settingsDoc.categories)) {
      return res.status(404).json({ success: false, message: 'No room categories found' });
    }

    const before = settingsDoc.categories.length;
    settingsDoc.categories = settingsDoc.categories.filter(
      (c) => String(c._id) !== String(id) && c.id !== id,
    );
    if (settingsDoc.categories.length === before) {
      return res.status(404).json({ success: false, message: 'Room category not found' });
    }
    settingsDoc.markModified('categories');
    await settingsDoc.save({ validateModifiedOnly: true });

    res.status(200).json({ success: true, message: 'Room category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete room category', error: error.message });
  }
};

const updateRoomCategoryNames = async (req, res) => {
  try {
    let settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc || !settingsDoc.categories || settingsDoc.categories.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No room categories found to update'
      });
    }

    // Update category names to remove "Room" suffix
    settingsDoc.categories = settingsDoc.categories.map(category => {
      let updatedName = category.name;
      
      // Remove "Room" suffix from category names
      if (updatedName.endsWith(' Room')) {
        updatedName = updatedName.replace(' Room', '');
      }
      
      // Update description to remove "room" references
      let updatedDescription = category.description;
      if (updatedDescription && updatedDescription.toLowerCase().includes('room')) {
        updatedDescription = updatedDescription.replace(/room with /gi, 'with ');
        updatedDescription = updatedDescription.replace(/room without /gi, 'without ');
        updatedDescription = updatedDescription.replace(/\s+room$/gi, '');
      }
      
      return {
        ...category,
        name: updatedName,
        description: updatedDescription
      };
    });

    await settingsDoc.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Room category names updated successfully',
      data: { categories: settingsDoc.categories }
    });
  } catch (error) {
    // Error updating room category names
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update room category names',
      error: error.message 
    });
  }
};




const validateGST = async (req, res) => {
  const gstNumber = (req.body?.gstNumber || '').trim().toUpperCase();
  const valid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber);
  res.status(200).json({
    success: true,
    data: { gstNumber, valid },
    message: valid ? 'Valid GST number' : 'Invalid GST number format',
  });
};

const validatePAN = async (req, res) => {
  const panNumber = (req.body?.panNumber || '').trim().toUpperCase();
  const valid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber);
  res.status(200).json({
    success: true,
    data: { panNumber, valid },
    message: valid ? 'Valid PAN number' : 'Invalid PAN number format',
  });
};

const getShiftTemplates = async (_req, res) => {
  try {
    const settings = await getSettings();
    const saved = settings?.staff?.shiftTemplates;
    const data = Array.isArray(saved) && saved.length
      ? saved
      : [
          { name: 'Morning', startTime: '06:00', endTime: '14:00' },
          { name: 'Evening', startTime: '14:00', endTime: '22:00' },
          { name: 'Night', startTime: '22:00', endTime: '06:00' },
          { name: 'General', startTime: '09:00', endTime: '18:00' },
        ];
    res.status(200).json({ success: true, data, message: 'Shift templates retrieved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const testSecuritySettings = async (_req, res) => {
  try {
    const settings = await getSettings();
    const security = settings?.security || {};
    const checks = {
      twoFactorEnabled: Boolean(security.twoFactorAuth ?? security.twoFactorEnabled),
      passwordPolicyConfigured: Boolean(security.passwordPolicy),
      sessionTimeoutConfigured: Boolean(security.sessionTimeout),
    };
    res.status(200).json({
      success: true,
      data: { checks, passed: Object.values(checks).every(Boolean) },
      message: 'Security settings tested',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getHotelProfile = async (req, res) => {
  try {
    const settings = await getSettings();
    res.status(200).json({
      success: true,
      data: settings.hotelProfile || {},
      message: 'Hotel profile retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const persistHotelProfile = async (body) => {
  const $set = {};

  // Mirror every overlapping field to BOTH top-level and nested `hotelProfile.X`
  // so neither read path returns empty data.
  const mirror = (key, value) => {
    if (value === undefined) return;
    $set[key] = value;
    $set[`hotelProfile.${key}`] = value;
  };

  // Load the current doc up-front so email-verification survives correctly.
  const existing = await Settings.findOne({});

  // Persisted email-verified flag: true if the email was just OTP-verified, or
  // it's unchanged from a previously-verified email. Any edit clears it.
  let contact = body.contact;
  if (contact && typeof contact === 'object') {
    const storedContact = existing?.hotelProfile?.contact || existing?.contact || {};
    const newEmail = String(contact.email || '').trim().toLowerCase();
    const storedEmail = String(storedContact.email || '').trim().toLowerCase();
    let emailVerified = false;
    if (newEmail) {
      if (isVerified('email', newEmail)) emailVerified = true;
      else if (newEmail === storedEmail && storedContact.emailVerified) emailVerified = true;
    }
    contact = { ...contact, emailVerified };
  }

  mirror('hotelName', body.hotelName);
  mirror('legalName', body.legalName);
  mirror('description', body.description);
  mirror('starRating', body.starRating);
  mirror('yearEstablished', body.yearEstablished);
  mirror('address', body.address);
  mirror('contact', contact);
  mirror('social', body.social);

  // Top-level-only fields.
  if (body.language !== undefined) $set.language = body.language;
  if (body.secondaryLanguage !== undefined) $set.secondaryLanguage = body.secondaryLanguage;
  if (body.baseCurrency !== undefined) $set.baseCurrency = body.baseCurrency;
  if (body.baseTimezone !== undefined) $set.baseTimezone = body.baseTimezone;
  if (body.amenities) $set.amenities = body.amenities;
  if (body.policies) $set.policies = body.policies;

  // Nested-only fields.
  if (body.logo !== undefined) $set['hotelProfile.logo'] = body.logo;
  if (body.businessRegistration) $set['hotelProfile.businessRegistration'] = body.businessRegistration;
  if (body.restaurant) $set['hotelProfile.restaurant'] = body.restaurant;
  if (body.classification) {
    $set['hotelProfile.classification'] = body.classification;
    if (body.classification.starRating !== undefined) mirror('starRating', body.classification.starRating);
    if (body.classification.establishedYear !== undefined) mirror('yearEstablished', body.classification.establishedYear);
  }

  // De-collapse dotted-path keys for the create() path (Mongoose treats them as
  // literal field names with dots in insert documents).
  const buildNestedDoc = (flat) => {
    const out = {};
    for (const [key, value] of Object.entries(flat)) {
      if (!key.includes('.')) {
        out[key] = value;
        continue;
      }
      const parts = key.split('.');
      let cursor = out;
      for (let i = 0; i < parts.length - 1; i += 1) {
        if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
          cursor[parts[i]] = {};
        }
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
    }
    return out;
  };

  if (!existing) {
    const initialDoc = buildNestedDoc($set);
    if (!initialDoc.hotelName) initialDoc.hotelName = 'Hotel Sandhya Grand';
    await Settings.create(initialDoc);
  } else {
    await Settings.updateOne(
      { _id: existing._id },
      { $set },
      { runValidators: false },
    );
  }

  return Settings.getSettings();
};

const updateHotelProfile = async (req, res) => {
  try {
    const settings = await persistHotelProfile(req.body || {});
    res.status(200).json({
      success: true,
      data: settings.hotelProfile,
      message: 'Hotel profile updated successfully',
    });
  } catch (error) {
    console.error('updateHotelProfile failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const saveHotelProfile = async (req, res) => {
  try {
    const settings = await persistHotelProfile(req.body || {});
    res.status(200).json({
      success: true,
      data: settings.hotelProfile,
      message: 'Hotel profile saved successfully',
    });
  } catch (error) {
    console.error('saveHotelProfile failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send an OTP to verify the hotel's contact email (authenticated — Settings page).
const sendHotelEmailOtp = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Enter a valid email first.' });
  }
  try {
    const result = await sendOtp('email', email);
    if (!result.sent) {
      return res.status(429).json({ success: false, message: `Please wait ${result.cooldown}s before requesting another code.`, cooldown: result.cooldown });
    }
    return res.json({ success: true, message: 'A verification code was sent to that email.', devCode: result.devCode });
  } catch (error) {
    console.error('sendHotelEmailOtp failed:', error.message);
    return res.status(502).json({ success: false, message: 'Could not send the code. Check the email provider settings.' });
  }
};

// Verify the OTP for the hotel's contact email.
const verifyHotelEmailOtp = async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const result = verifyOtp('email', email, code);
  if (!result.ok) return res.status(400).json({ success: false, message: result.message });
  return res.json({ success: true, message: 'Email verified.' });
};

// Add more placeholder functions for other missing endpoints


const getAvailableInvoiceTemplates = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: listInvoiceTemplates(),
      message: 'Invoice templates retrieved',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getInvoiceTemplateSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const selected = settings?.invoice?.template
      || settings?.invoice?.selectedTemplate
      || DEFAULT_TEMPLATE_ID;
    res.status(200).json({
      success: true,
      data: { selectedTemplate: selected },
      message: 'Invoice template settings retrieved',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSelectedInvoiceTemplate = async (req, res) => {
  try {
    const { templateId } = req.body || {};
    if (!templateId) {
      return res.status(400).json({ success: false, message: 'templateId is required' });
    }
    const template = getInvoiceTemplate(templateId);
    if (!template || template.id !== templateId) {
      return res.status(400).json({ success: false, message: `Unknown template: ${templateId}` });
    }
    await Settings.updateSection('invoice', { template: templateId });
    res.status(200).json({
      success: true,
      data: { selectedTemplate: templateId },
      message: 'Invoice template updated',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Banquet quotation/invoice templates (separate selection) ─────────────────

const getAvailableBanquetTemplates = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: listBanquetTemplates(),
      message: 'Banquet templates retrieved',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBanquetTemplateSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const selected = settings?.invoice?.banquetTemplate || DEFAULT_BANQUET_TEMPLATE_ID;
    res.status(200).json({
      success: true,
      data: { selectedTemplate: selected },
      message: 'Banquet template settings retrieved',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSelectedBanquetTemplate = async (req, res) => {
  try {
    const { templateId } = req.body || {};
    if (!templateId) {
      return res.status(400).json({ success: false, message: 'templateId is required' });
    }
    const template = getBanquetTemplate(templateId);
    if (!template || template.id !== templateId) {
      return res.status(400).json({ success: false, message: `Unknown banquet template: ${templateId}` });
    }
    await Settings.updateSection('invoice', { banquetTemplate: templateId });
    res.status(200).json({
      success: true,
      data: { selectedTemplate: templateId },
      message: 'Banquet template updated',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Render a banquet template with sample data. Body: { templateId, docType }.
const previewBanquetTemplate = async (req, res) => {
  try {
    const { templateId, docType = 'invoice' } = req.body || {};
    const hotelSection = await Settings.getSection('hotelProfile');
    const hotel = {
      name: hotelSection?.hotelName || 'Hotel Sandhya Grand & Marriage Hall',
      logo: await resolveLogo(hotelSection?.logo || ''),
      address: [
        hotelSection?.address?.line1,
        hotelSection?.address?.line2,
        hotelSection?.address?.city,
        hotelSection?.address?.state,
        hotelSection?.address?.postalCode,
      ].filter(Boolean).join(', '),
      contact: {
        phone: hotelSection?.contact?.phone || '',
        email: hotelSection?.contact?.email || '',
        website: hotelSection?.contact?.website || '',
      },
      gstin: hotelSection?.businessRegistration?.gstNumber || '',
    };

    const sampleBooking = {
      _id: 'SAMPLE-BQT',
      customerName: 'Aarav & Diya Sharma',
      phone: '9876543210',
      email: 'aarav@example.com',
      address: '12 Rosewood Lane, Munger, Bihar',
      customerGstin: '10ABCDE1234F1Z5',
      hallId: { name: 'Grand Banquet Hall' },
      hallName: 'Grand Banquet Hall',
      eventDate: new Date(),
      eventType: 'Wedding Reception',
      startTime: '18:00',
      endTime: '23:00',
      guestCount: 250,
      floorCost: 60000,
      decorationCost: 45000,
      decorationType: 'Floral Stage & Entrance',
      cateringItems: [
        { name: 'Royal Veg Thali', category: 'Vegetarian', perPlate: 650, plates: 250, days: 1, amount: 162500 },
        { name: 'Live Chaat Counter', category: 'Snacks', perPlate: 120, plates: 250, days: 1, amount: 30000 },
      ],
      photographyAmount: 35000,
      photographyVendor: 'Lens & Light Studio',
      totalAmount: 332500,
      paidAmount: 150000,
      paymentMethod: 'UPI',
      paymentReference: 'AXIS123456',
    };

    const html = await renderBanquetDocument({
      booking: sampleBooking,
      hotel,
      templateId,
      docType: docType === 'quotation' ? 'quotation' : 'invoice',
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};










const getAvailablePermissions = async (_req, res) => {
  res.status(200).json({ success: true, data: PERMISSION_CATALOG, message: 'Permission catalog' });
};










const createManualBackup = async (req, res) => {
  try {
    // Check if mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    
    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-data-${timestamp}.json`;
    const filePath = path.join(backupDir, filename);
    
    // Use mongoose models to get data instead of raw collections
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {}
    };
    
    // Backup specific collections using mongoose models
    try {
      backupData.data.settings = await Settings.find({}).lean();
      backupData.data.users = await User.find({}).lean();
      backupData.data.staff = await Staff.find({}).lean();
      backupData.data.departments = await Department.find({}).lean();
      backupData.data.roles = await Role.find({}).lean();
      
      // Import and backup other models if they exist
      try {
        const Room = modelFor('Room');
        backupData.data.rooms = await Room.find({}).lean();
      } catch (e) { /* Room model not registered */ }
      
      try {
        const Guest = modelFor('Guest');
        backupData.data.guests = await Guest.find({}).lean();
      } catch (e) { /* Guest model not registered */ }
      
      try {
        const Booking = modelFor('Booking');
        backupData.data.bookings = await Booking.find({}).lean();
      } catch (e) { /* Booking model not registered */ }
      
      try {
        const BanquetBooking = modelFor('BanquetBooking');
        backupData.data.banquetBookings = await BanquetBooking.find({}).lean();
      } catch (e) { /* BanquetBooking model not registered */ }
      
      try {
        const BanquetHall = modelFor('BanquetHall');
        backupData.data.banquetHalls = await BanquetHall.find({}).lean();
      } catch (e) { /* BanquetHall model not registered */ }
      
      try {
        const Housekeeping = modelFor('Housekeeping');
        backupData.data.housekeeping = await Housekeeping.find({}).lean();
      } catch (e) { /* Housekeeping model not registered */ }
      
    } catch (modelError) {
      console.error('Error backing up model data:', modelError);
    }
    
    // Write backup to file
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    res.status(200).json({ 
      success: true, 
      message: 'Manual backup created successfully',
      data: {
        filename,
        size: stats.size,
        createdAt: new Date().toISOString(),
        type: 'manual',
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Error creating manual backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create manual backup',
      error: error.message 
    });
  }
};

const getAllBackups = async (req, res) => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    
    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      return res.status(200).json({ 
        success: true, 
        data: [], 
        message: 'No backups found' 
      });
    }
    
    // Read all backup files
    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(file => file.endsWith('.json'));
    
    const backups = backupFiles.map(filename => {
      const filePath = path.join(backupDir, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        type: filename.includes('backup-data-') ? 'manual' : 'automatic',
        status: 'completed'
      };
    });
    
    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.status(200).json({ 
      success: true, 
      data: backups, 
      message: `Found ${backups.length} backups` 
    });
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch backups',
      error: error.message 
    });
  }
};

const getStorageStats = async (req, res) => {
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return res.status(200).json({ 
        success: true, 
        data: {
          totalBackups: 0,
          totalSize: 0,
          availableSpace: 1024 * 1024 * 1024 * 10 // 10GB default
        }, 
        message: 'No backup directory found' 
      });
    }
    
    const files = fs.readdirSync(backupDir);
    const backupFiles = files.filter(file => file.endsWith('.json'));
    
    let totalSize = 0;
    backupFiles.forEach(filename => {
      const filePath = path.join(backupDir, filename);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });
    
    res.status(200).json({ 
      success: true, 
      data: {
        totalBackups: backupFiles.length,
        totalSize,
        availableSpace: 1024 * 1024 * 1024 * 10 - totalSize // 10GB - used space
      }, 
      message: 'Storage stats retrieved successfully' 
    });
  } catch (error) {
    console.error('Error getting storage stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get storage stats',
      error: error.message 
    });
  }
};


// ── Backup file access ───────────────────────────────────────────────────────
//
// `path.join(backupDir, req.params.filename)` walks straight out of the backup
// directory: a filename of "..%2f.env" decodes to "../.env" and resolves to the
// server's environment file — Mongo URI, JWT secret, live payment keys. The
// route is a GET, and this router only guards mutations, so any authenticated
// account could read it. Resolve the path and require it to stay inside the
// directory, and accept only the archive names this app actually writes.
const BACKUP_NAME = /^[A-Za-z0-9._-]+\.(json|gz|tar\.gz|zip)$/;

const resolveBackupPath = (filename) => {
  const name = String(filename || '');
  if (!BACKUP_NAME.test(name) || name.includes('..')) return null;

  const backupDir = path.resolve(process.cwd(), 'backups');
  const full = path.resolve(backupDir, name);
  // path.resolve collapses any traversal; anything that escapes is refused.
  if (full !== path.join(backupDir, name) || !full.startsWith(backupDir + path.sep)) return null;
  return full;
};

const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = resolveBackupPath(filename);

    // A rejected path and a missing file answer identically, so probing for
    // files outside the directory tells the caller nothing.
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to download backup',
      error: error.message 
    });
  }
};

const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = resolveBackupPath(filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Backup file not found' 
      });
    }
    
    // Delete the file
    fs.unlinkSync(filePath);
    
    res.status(200).json({ 
      success: true, 
      message: 'Backup deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete backup',
      error: error.message 
    });
  }
};



// ── Inline-extracted endpoints ───────────────────────────────────────────────




const previewInvoice = async (req, res) => {
  try {
    const { templateId, type = 'hotel' } = req.body || {};
    const hotelSection = await Settings.getSection('hotelProfile');
    const hotel = {
      name: hotelSection?.hotelName || 'Hotel Sandhya Grand & Marriage Hall',
      logo: await resolveLogo(hotelSection?.logo || ''),
      address: [
        hotelSection?.address?.line1,
        hotelSection?.address?.line2,
        hotelSection?.address?.city,
        hotelSection?.address?.state,
        hotelSection?.address?.postalCode,
      ].filter(Boolean).join(', '),
      contact: {
        phone: hotelSection?.contact?.phone || '',
        email: hotelSection?.contact?.email || '',
        website: hotelSection?.contact?.website || '',
      },
      gstin: hotelSection?.businessRegistration?.gstNumber || '',
    };

    const sampleBooking = type === 'banquet' ? {
      _id: 'SAMPLE0001',
      customerName: 'Aarav & Diya Sharma',
      guestName: 'Aarav & Diya Sharma',
      phone: '9876543210',
      email: 'aarav@example.com',
      address: '12 Rosewood Lane, Munger, Bihar',
      hallId: { name: 'Grand Banquet Hall' },
      hallName: 'Grand Banquet Hall',
      eventDate: new Date(),
      eventType: 'Reception',
      bookingDate: new Date(),
      startTime: '18:00',
      endTime: '23:00',
      guestCount: 150,
      numberOfGuests: 150,
      menu: {
        hasMeals: true,
        mealType: 'chicken',
        numberOfPlates: 150,
        side: { paniPuri: 150, coldDrink: 150 },
        extra: { chickenLollipop: 100 },
        combo: {},
        beverages: {},
      },
      hallCharges: 25000,
      totalAmount: 132500,
      paidAmount: 50000,
      paymentMethod: 'UPI',
      paymentReference: 'AXIS123456',
    } : {
      _id: 'SAMPLE0002',
      customerName: 'Mr. Rohan Verma',
      guestName: 'Mr. Rohan Verma',
      firstName: 'Rohan',
      lastName: 'Verma',
      phone: '9876501234',
      email: 'rohan@example.com',
      address: '21 Park Avenue, Patna, Bihar',
      roomId: { roomNumber: '204', roomType: 'Deluxe AC', type: 'Deluxe AC', pricePerNight: 4500 },
      checkIn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      adults: 2,
      children: 1,
      totalAmount: 13500,
      baseAmount: 4500,
      restaurantCharges: 2400,
      restaurantOrders: [
        { orderNumber: 'R-1001', totalAmount: 1450, items: [{}, {}, {}], createdAt: new Date() },
        { orderNumber: 'R-1002', totalAmount: 950, items: [{}, {}], createdAt: new Date() },
      ],
      paidAmount: 10000,
      paymentMethod: 'Card',
      paymentReference: 'HDFC4521',
    };

    const html = await renderInvoice({
      booking: sampleBooking,
      hotel,
      type,
      templateId,
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const testPaymentConnection = async (req, res) => {
  try {
    const { gateway } = req.body;
    res.json({
      success: true,
      data: { gateway, status: 'connected', message: `${gateway} connection test successful` },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSecurityPolicy = async (req, res) => {
  try {
    res.json({ success: true, data: req.body, message: 'Security policy updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const testNotification = async (req, res) => {
  try {
    const { type } = req.body;
    res.json({
      success: true,
      data: { type, status: 'sent', message: `Test ${type} notification sent successfully` },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const applyTheme = async (req, res) => {
  try {
    res.json({ success: true, data: req.body, message: 'Theme applied successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getThemePresets = async (_req, res) => {
  try {
    const presets = [
      { id: 'default', name: 'Default', primaryColor: '#6366F1', secondaryColor: '#EC4899' },
      { id: 'dark', name: 'Dark Mode', primaryColor: '#1F2937', secondaryColor: '#374151' },
      { id: 'blue', name: 'Ocean Blue', primaryColor: '#0EA5E9', secondaryColor: '#0284C7' },
      { id: 'green', name: 'Nature Green', primaryColor: '#10B981', secondaryColor: '#059669' },
    ];
    res.json({ success: true, data: presets, message: 'Theme presets retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sectionHandler = (sectionName, method) => (req, res) => {
  req.params.section = sectionName;
  if (method === 'get') return getSettingsSection(req, res);
  return updateSettingsSection(req, res);
};

export default {
  getPublicTheme,
  getPublicBranding,
  getAllSettings,
  getSettingsSection,
  updateSettingsSection,
  updateAllSettings,
  resetSettings,
  uploadLogo,
  uploadBackgroundImage,
  getRoomCategories,
  initializeRoomCategories,
  addRoomCategory,
  updateRoomCategory,
  deleteRoomCategory,
  updateRoomCategoryNames,
  validateGST,
  validatePAN,
  getShiftTemplates,
  testSecuritySettings,
  getHotelProfile,
  updateHotelProfile,
  saveHotelProfile,
  sendHotelEmailOtp,
  verifyHotelEmailOtp,
  getAvailableInvoiceTemplates,
  getInvoiceTemplateSettings,
  updateSelectedInvoiceTemplate,
  getAvailableBanquetTemplates,
  getBanquetTemplateSettings,
  updateSelectedBanquetTemplate,
  previewBanquetTemplate,
  getAvailablePermissions,
  createManualBackup,
  getAllBackups,
  getStorageStats,
  downloadBackup,
  deleteBackup,
  previewInvoice,
  testPaymentConnection,
  updateSecurityPolicy,
  testNotification,
  applyTheme,
  getThemePresets,
  sectionHandler,
};
