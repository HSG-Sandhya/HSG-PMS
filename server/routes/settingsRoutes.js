import express from 'express';
import multer from 'multer';
import settingsController from '../controllers/settingsController.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Public — declared BEFORE the auth gate. The login page needs the appearance
// settings (mode, colours, background, darkness) before anyone is signed in.
router.get('/public/theme', settingsController.getPublicTheme);

router.use(permissionMiddleware.authenticateToken);

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
router.put('/section/:section', permissionMiddleware.requireSettingsAccess, settingsController.updateSettingsSection);
router.put('/', permissionMiddleware.requireSettingsAccess, settingsController.updateAllSettings);
router.post('/reset', permissionMiddleware.requireSettingsAccess, settingsController.resetSettings);

// === FILE UPLOADS ===
router.post('/upload-logo', permissionMiddleware.requireSettingsAccess, upload.single('logo'), settingsController.uploadLogo);
router.post('/upload-background', permissionMiddleware.requireSettingsAccess, upload.single('background'), settingsController.uploadBackgroundImage);

// === ROOM CATEGORIES MANAGEMENT ===
router.get('/room-categories', settingsController.getRoomCategories);
router.post('/room-categories/initialize', permissionMiddleware.requireSettingsAccess, settingsController.initializeRoomCategories);
router.put('/room-categories/update-names', permissionMiddleware.requireSettingsAccess, settingsController.updateRoomCategoryNames);
router.post('/room-categories', permissionMiddleware.requireSettingsAccess, settingsController.addRoomCategory);
router.put('/room-categories/:id', permissionMiddleware.requireSettingsAccess, settingsController.updateRoomCategory);
router.delete('/room-categories/:id', permissionMiddleware.requireSettingsAccess, settingsController.deleteRoomCategory);

// Room types / amenities (mock stubs for extended API tests)
router.post('/room-types', settingsController.createRoomType);
router.post('/amenities', settingsController.createAmenity);

// === STATIC DATA ===
router.get('/indian-states', settingsController.getIndianStates);
router.get('/indian-languages', settingsController.getIndianLanguages);

// === HOTEL PROFILE MANAGEMENT ===
router.post('/validate-business-numbers', settingsController.validateBusinessNumbers);
router.post('/tax/validate-gst', settingsController.validateGST);
router.post('/tax/validate-pan', settingsController.validatePAN);
router.get('/hotel-profile', settingsController.getHotelProfile);
router.put('/hotel-profile', settingsController.updateHotelProfile);
router.post('/hotel-profile', settingsController.saveHotelProfile);

// === DATA MANAGEMENT ===
router.get('/data/export', settingsController.exportSettings);
router.post('/data/import', settingsController.importSettings);

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
router.get('/departments', settingsController.getAllDepartments);
router.post('/departments', permissionMiddleware.requireSettingsAccess, settingsController.createDepartment);
router.put('/departments/:id', permissionMiddleware.requireSettingsAccess, settingsController.updateDepartment);
router.delete('/departments/:id', permissionMiddleware.requireSettingsAccess, settingsController.deleteDepartment);

router.get('/roles', settingsController.getAllRoles);
router.post('/roles', permissionMiddleware.requireSettingsAccess, settingsController.createRole);
router.put('/roles/:id', permissionMiddleware.requireSettingsAccess, settingsController.updateRole);
router.delete('/roles/:id', permissionMiddleware.requireSettingsAccess, settingsController.deleteRole);
router.get('/roles/:id/users', settingsController.getUsersByRole);

router.get('/permissions', settingsController.getAvailablePermissions);

// === LEGACY STAFF MGMT ===
router.get('/staff/departments', settingsController.getAllDepartments);
router.post('/staff/departments', settingsController.addDepartment);
router.get('/staff/roles', settingsController.getAllRoles);
router.post('/staff/roles', settingsController.addRole);
router.delete('/staff/departments/:id', settingsController.deleteDepartment);
router.delete('/staff/roles/:id', settingsController.deleteRole);
router.get('/staff/permissions', settingsController.getAllPermissions);
router.put('/staff/roles/:id', settingsController.updateRole);
router.get('/staff/shift-templates', settingsController.getShiftTemplates);

// === INTEGRATIONS ===
router.get('/integrations', settingsController.getAllIntegrations);
router.put('/integrations/email-service', settingsController.updateEmailService);
router.put('/integrations/email', settingsController.updateEmailService);
router.put('/integrations/sms-service', settingsController.updateSmsService);
router.put('/integrations/sms', settingsController.updateSmsService);
router.put('/integrations/channel-manager', settingsController.updateChannelManager);
router.put('/integrations/analytics', settingsController.updateAnalytics);
router.post('/integrations/test-connection', settingsController.testIntegrationConnection);

// === BACKUP ===
router.post('/backup/manual', permissionMiddleware.requireSettingsAccess, settingsController.createManualBackup);
router.get('/backup', settingsController.getAllBackups);
router.get('/backup/history', settingsController.getAllBackups);
router.get('/backup/storage-stats', settingsController.getStorageStats);
router.get('/backup/download/:filename', settingsController.downloadBackup);
router.delete('/backup/:filename', permissionMiddleware.requireSettingsAccess, settingsController.deleteBackup);
router.post('/backup/restore/:filename', permissionMiddleware.requireSettingsAccess, settingsController.restoreBackup);
router.post('/backup/upload', permissionMiddleware.requireSettingsAccess, upload.single('backup'), settingsController.uploadBackup);

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
router.put('/security/policy', permissionMiddleware.requireSettingsAccess, settingsController.updateSecurityPolicy);
router.post('/security/test', settingsController.testSecuritySettings);
router.post('/notifications/test', settingsController.testNotification);
router.post('/theme/apply', settingsController.applyTheme);
router.get('/theme/presets', settingsController.getThemePresets);

export default router;
