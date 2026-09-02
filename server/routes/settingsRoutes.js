import express from 'express';
import multer from 'multer';
import settingsController from '../controllers/settingsController.js';
import permissionMiddleware from '../middleware/permissionMiddleware.js';
import { requireManage } from '../middleware/requireManage.js';

const router = express.Router();

// '/backup' and '/backup/...', but not '/backupsomething'.
const isBackupPath = (p) => p === '/backup' || p.startsWith('/backup/');

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
  // /backup carries its own, stricter rules below. Deferring to them keeps
  // manage_backups meaningful on its own instead of requiring manage_settings
  // as well, which would make the finer-grained permission unusable.
  //
  // Matched exactly the way `router.use('/backup', ...)` matches, so the set of
  // paths exempted here is the same set that guard covers. A loose prefix test
  // would exempt a future '/backupsomething' from BOTH and leave it open.
  if (isBackupPath(req.path)) return next();
  return requireManage('manage_settings')(req, res, next);
});

// READS were left to authenticateToken alone, which is not the same thing as
// "safe to read". The Settings document carries payment-gateway keys, SMTP and
// SMS provider credentials and channel-manager keys, so `GET /api/settings`
// handed every logged-in account — housekeeping, waiters, reception — the live
// Razorpay secret. Two answers, because the reads are not all alike:
//
//   • The whole-document and named-section reads stay open, but the controller
//     redacts secrets for EVERY caller and drops the administrator-only
//     sections for anyone without view_settings. The admin UI loads settings on
//     every screen for every user, so a blanket 403 would break the app for
//     ordinary staff to no benefit.
//
//   • The backup endpoints are different, and are handled separately below.
//
// BACKUPS. Being GETs, these bypassed the mutation guard entirely, so a backup
// archive — the whole database, guest PII and ID-card scans included — was
// listable and downloadable by anyone holding a valid hotel login. They are
// graded by what each endpoint actually exposes:
//
//   listing / history / storage stats   view_backups   (metadata: names, sizes, dates)
//   create / delete                     manage_backups (changes what exists on disk)
//   download                            system administrator ONLY
//
// Download is the strictest because the archive IS the database; holding a copy
// is equivalent to holding every guest record and every stored credential. That
// is not something to delegate through an ordinary permission grant.
//
// The subtree guard is the baseline and runs first, so a backup route added
// later is guarded on arrival rather than inheriting nothing.
const { requireSystemAdmin } = permissionMiddleware;
const requireBackupRead = requireManage(['view_backups', 'manage_backups']);
const requireBackupManage = requireManage('manage_backups');

router.use('/backup', requireBackupRead);

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
router.get('/staff/shift-templates', settingsController.getShiftTemplates);

// === INTEGRATIONS ===

// === BACKUP ===
router.post('/backup/manual', requireBackupManage, settingsController.createManualBackup);
router.get('/backup', settingsController.getAllBackups);
router.get('/backup/history', settingsController.getAllBackups);
router.get('/backup/storage-stats', settingsController.getStorageStats);
router.get('/backup/download/:filename', requireSystemAdmin, settingsController.downloadBackup);
router.delete('/backup/:filename', requireBackupManage, settingsController.deleteBackup);

// Legacy section aliases used to sit here: GET/PUT/PATCH for /marriage,
// /rooms, /banquetHallBooking, /invoice, /notifications, /staff, /theme,
// /payment, /security and /tax, each forwarding to the section handler that
// /section/:section already reaches directly.
//
// Removed after an audit: no caller in the admin client or the website, and
// zero requests across two weeks of production access logs (19 Aug - 2 Sep),
// in a window that recorded 219 other settings requests across 20 distinct
// paths. A second door onto the same handler is a place for the two to drift
// apart -- which had already happened once, when the guarded /section/payment
// and the unguarded /payment reached the same controller.
//
// The SUB-paths are real endpoints and remain below: /theme/apply,
// /theme/presets, /payment/test-connection, /security/policy, /security/test,
// /notifications/test, /tax/validate-gst, /tax/validate-pan,
// /staff/shift-templates, /invoice/preview.

// === SETTINGS PANEL MISC ===
router.post('/payment/test-connection', settingsController.testPaymentConnection);
router.put('/security/policy', settingsController.updateSecurityPolicy);
router.post('/security/test', settingsController.testSecuritySettings);
router.post('/notifications/test', settingsController.testNotification);
router.post('/theme/apply', settingsController.applyTheme);
router.get('/theme/presets', settingsController.getThemePresets);

export default router;
