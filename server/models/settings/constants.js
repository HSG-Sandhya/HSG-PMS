// ---- Constants (DRY) ------------------------------------------------------
export const LANGUAGES = [
  'English', 'Hindi', 'Marathi', 'Tamil', 'Telugu',
  'Kannada', 'Bengali', 'Gujarati', 'Punjabi', 'Malayalam'
];

export const COUNTRIES = ['India'];

export const AMENITIES = [
  'WiFi', 'AC', 'Parking', 'Restaurant', 'Room Service', 'Laundry', 'Elevator', 'Gym', 'Spa',
  'Swimming Pool', 'Banquet Hall', 'Conference Room', 'Power Backup', 'CCTV', 'Fire Safety',
  'Bar', 'Airport Shuttle', 'Pet Friendly', 'Wheelchair Access', 'Housekeeping'
];

export const SOCIAL_PLATFORMS = [
  'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'whatsapp', 'threads', 'tiktok'
];

export const GST_TAX_RATES = [0, 5, 12, 18, 28];

export const PAYMENT_ENVIRONMENTS = ['test', 'live'];

export const BACKUP_FREQUENCIES = ['daily', 'weekly', 'monthly'];

export const BACKUP_TYPES = ['manual', 'automatic'];

export const BACKUP_STATUSES = ['completed', 'failed', 'in-progress'];

export const INVOICE_TEMPLATES = [
  'modern_gradient', 'minimalist_clean', 'corporate_blue', 'creative_studio',
  'elegant_gold', 'modern_tech', 'financial_formal', 'healthcare_clean',
  'retail_friendly', 'hospitality_warm', 'consulting_sharp', 'eco_green',
  'luxury_premium', 'startup_dynamic', 'classic_professional'
];

export const FONT_SIZES = ['small', 'medium', 'large'];

export const HEADER_STYLES = ['minimal', 'detailed', 'branded'];

// Simple validator helpers
export const isNonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
export const phoneRegex = /^[0-9+\-()\s]{6,20}$/;
export const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i; // e.g. 22AAAAA0000A1Z5
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const urlRegex = /^https?:\/\/.+/;
