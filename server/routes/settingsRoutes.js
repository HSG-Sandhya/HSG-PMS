import express from 'express';
import multer from 'multer';
import settingsController from '../controllers/settingsController.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import { requireManage } from '../middleware/requireManage.js';

const router = express.Router();

// Public — declared BEFORE the auth gate. The login page needs the appearance
// settings (mode, colours, background, darkness) before anyone is signed in.
router.get('/public/theme', settingsController.getPublicTheme);
router.get('/public/branding', settingsController.getPublicBranding);

router.use(permissionMiddleware.authenticateToken);

// Authorisation for EVERY mutation on this router, applied once here rather
// than per route. Two things made the per-route approach unsafe:
//
//  1. Only 21 of 67 mutations actually named a guard. The rest — payment and
//     security config, integrations, hotel profile, data import, templates —
//     were reachable by any logged-in account, a cleaner included. The legacy
//     section aliases were a straight bypass: `PUT /section/payment` was
//     guarded, while `PUT /payment` reached the very same controller unguarded.
//
//  2. The guard it used (requireSettingsAccess) tests `isSystemAdmin` or a role
//     literally named "admin". This hotel's admins hold a role named
//     "Super Admin", so they failed it and could only save settings through the
//     unguarded aliases — the hole was load-bearing.
//
// requireManage('manage_settings') fixes both: it honours the real permission
// from the catalogue, still lets system admins through, and rejects inactive
// accounts. Defaulting to deny means a route added later is guarded on arrival.
router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  return requireManage('manage_settings')(req, res, next);
});

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const { sectionHandler } = settingsController;

// === MAIN SETTINGS ROUTES ===
router.get('/', settingsController.getAllSettings);
router.get('/section/:section', settingsController.getSettingsSection);
router.get('/invalid-endpoint', settingsController.invalidEndpoint);
router.put('/section/:section', settingsController.updateSettingsSection);
router.put('/', settingsController.updateAllSettings);
router.post('/reset', settingsController.resetSettings);

// === FILE UPLOADS ===
router.post('/upload-logo', upload.single('logo'), settingsController.uploadLogo);
router.post('/upload-background', upload.single('background'), settingsController.uploadBackgroundImage);

// === ROOM CATEGORIES MANAGEMENT ===
router.get('/room-categories', settingsController.getRoomCategories);
router.post('/room-categories/initialize', settingsController.initializeRoomCategories);
router.put('/room-categories/update-names', settingsController.updateRoomCategoryNames);
router.post('/room-categories', settingsController.addRoomCategory);
router.put('/room-categories/:id', settingsController.updateRoomCategory);
router.delete('/room-categories/:id', settingsController.deleteRoomCategory);

// Room types / amenities (mock stubs for extended API tests)
router.post('/room-types', settingsController.createRoomType);
router.post('/amenities', settingsController.createAmenity);

// === STATIC DATA ===

// === HOTEL PROFILE MANAGEMENT ===
router.post('/tax/validate-gst', settingsController.validateGST);
router.post('/tax/validate-pan', settingsController.validatePAN);
router.get('/hotel-profile', settingsController.getHotelProfile);
router.put('/hotel-profile', settingsController.updateHotelProfile);
router.post('/hotel-profile', settingsController.saveHotelProfile);
router.post('/hotel-profile/email-otp/send', settingsController.sendHotelEmailOtp);
router.post('/hotel-profile/email-otp/verify', settingsController.verifyHotelEmailOtp);

// === DATA MANAGEMENT ===

// === INVOICE TEMPLATE MANAGEMENT ===
router.get('/invoice-templates', settingsController.getAvailableInvoiceTemplates);
router.get('/invoice/templates', settingsController.getAvailableInvoiceTemplates);
router.get('/invoice-template-settings', settingsController.getInvoiceTemplateSettings);
router.put('/invoice-template', settingsController.updateSelectedInvoiceTemplate);
router.post('/invoice/preview', settingsController.previewInvoice);

// === BANQUET QUOTATION/INVOICE TEMPLATE MANAGEMENT ===
router.get('/banquet-templates', settingsController.getAvailableBanquetTemplates);
router.get('/banquet-template-settings', settingsController.getBanquetTemplateSettings);
router.put('/banquet-template', settingsController.updateSelectedBanquetTemplate);
router.post('/banquet/preview', settingsController.previewBanquetTemplate);

// === DEPARTMENTS / ROLES / PERMISSIONS ===


router.get('/permissions', settingsController.getAvailablePermissions);

// === LEGACY STAFF MGMT ===
router.get('/staff/permissions', settingsController.getAllPermissions);
router.get('/staff/shift-templates', settingsController.getShiftTemplates);

// === INTEGRATIONS ===

// === BACKUP ===
router.post('/backup/manual', settingsController.createManualBackup);
router.get('/backup', settingsController.getAllBackups);
router.get('/backup/history', settingsController.getAllBackups);
router.get('/backup/storage-stats', settingsController.getStorageStats);
router.get('/backup/download/:filename', settingsController.downloadBackup);
router.delete('/backup/:filename', settingsController.deleteBackup);

// === LEGACY SECTION ALIASES ===
router.get('/marriage', sectionHandler('hotelProfile', 'get'));
router.put('/marriage', sectionHandler('hotelProfile', 'put'));

router.get('/rooms', settingsController.getRoomCategories);
router.put('/rooms', (req, res) => {
  if (req.body.categories) return settingsController.updateAllSettings(req, res);
  res.status(400).json({ success: false, message: 'No room data provided' });
});

router.get('/banquetHallBooking', sectionHandler('banquetHall', 'get'));
router.put('/banquetHallBooking', sectionHandler('banquetHall', 'put'));

router.get('/invoice', sectionHandler('invoice', 'get'));
router.patch('/invoice', sectionHandler('invoice', 'put'));

router.get('/notifications', sectionHandler('notifications', 'get'));
router.put('/notifications', sectionHandler('notifications', 'put'));
router.patch('/notifications', sectionHandler('notifications', 'put'));

router.get('/staff', sectionHandler('staff', 'get'));
router.put('/staff', sectionHandler('staff', 'put'));
router.patch('/staff', sectionHandler('staff', 'put'));

router.get('/theme', sectionHandler('theme', 'get'));
router.put('/theme', sectionHandler('theme', 'put'));
router.patch('/theme', sectionHandler('theme', 'put'));

router.get('/payment', sectionHandler('payment', 'get'));
router.put('/payment', sectionHandler('payment', 'put'));
router.patch('/payment', sectionHandler('payment', 'put'));

router.get('/security', sectionHandler('security', 'get'));
router.put('/security', sectionHandler('security', 'put'));
router.patch('/security', sectionHandler('security', 'put'));

router.get('/tax', sectionHandler('tax', 'get'));
router.put('/tax', sectionHandler('tax', 'put'));
router.patch('/tax', sectionHandler('tax', 'put'));

// === SETTINGS PANEL MISC ===
router.post('/payment/test-connection', settingsController.testPaymentConnection);
router.put('/security/policy', settingsController.updateSecurityPolicy);
router.post('/security/test', settingsController.testSecuritySettings);
router.post('/notifications/test', settingsController.testNotification);
router.post('/theme/apply', settingsController.applyTheme);
router.get('/theme/presets', settingsController.getThemePresets);

export default router;
