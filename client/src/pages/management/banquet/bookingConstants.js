// Static option lists and the empty form shape for the Banquet Hall booking form.
import { format } from 'date-fns';

// Banquet floor charges are SPECIFIC to hall bookings and differ from the normal
// per-night room tariff. Hall floors are priced as a package (second, fourth);
// room-only floors are billed at ₹3,000 per room (first = 5×3000, third = 10×3000).
export const BANQUET_ROOM_RATE = 3000; // per-room charge for room-only banquet floors
export const FLOOR_OPTIONS = [
  { label: 'First floor (5 rooms)', value: 'first', cost: 15000, details: '5 rooms' },      // 5 × ₹3,000
  { label: 'Second floor (Grand Hall + 2 rooms)', value: 'second', cost: 56000, details: 'Grand Hall + 2 rooms' },
  { label: 'Third floor (10 rooms)', value: 'third', cost: 30000, details: '10 rooms' },    // 10 × ₹3,000
  { label: 'Fourth floor (Crystal Hall + 5 rooms)', value: 'fourth', cost: 35000, details: 'Crystal Hall + 5 rooms' },
];

// Which building level each floor package occupies. Room numbers are
// hundreds-based (R-2xx → level 2), so once a floor package is booked its rooms
// are part of the deal and must not be offered again in the guest-room list.
export const FLOOR_VALUE_TO_LEVEL = { first: 1, second: 2, third: 3, fourth: 4 };

// Building level for a room number (R-305 → 3). Null when it can't be parsed.
export const roomFloorLevel = (roomNumber) => {
  const m = String(roomNumber || '').match(/\d+/);
  return m ? Math.floor(parseInt(m[0], 10) / 100) : null;
};

// Levels covered by the currently selected floor packages.
export const levelsForFloors = (selectedFloors = []) =>
  new Set(selectedFloors.map((v) => FLOOR_VALUE_TO_LEVEL[v]).filter(Boolean));

export const DECORATION_OPTIONS = [
  { label: 'Standard (Marwah, Stage, Lighting)', value: 'Standard', cost: 15000 },
  { label: 'Premium (Marwah, Stage, Lighting, Pandal)', value: 'Premium', cost: 25000 },
  { label: 'Custom', value: 'Custom', cost: 0 },
];

export const ADDITIONAL_SERVICE_OPTIONS = [
  'Generator Backup', 'Valet Parking', 'Security Guards', 'Housekeeping',
  'Welcome Drinks', 'Bridal Room', 'Groom Room', 'WiFi', 'LED Screens',
];

export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID', 'Other'];
export const SEATING_STYLES = ['Theater', 'Round Table', 'Classroom', 'U-Shape', 'Cluster', 'Banquet', 'Cocktail'];
export const ROOM_TYPE_OPTIONS = ['Deluxe', 'Executive', 'Suite'];
export const DECORATION_ADDON_OPTIONS = [
  'Stage Decoration', 'Floral Decoration', 'Entrance Decoration',
  'Mandap Setup', 'LED Wall', 'Balloon Decoration',
];
export const ENTERTAINMENT_OPTIONS = [
  'DJ Setup', 'Live Band', 'Orchestra', 'Anchor/Host', 'Dhol', 'Fireworks',
];

// Guests & Add-ons options tailored to each event category. The booking form's
// "Guests & Add-ons" step shows the set for the chosen eventType's category so a
// corporate event offers projectors/PA/registration rather than mandap/bridal room.
export const ADDONS_BY_CATEGORY = {
  wedding: {
    services: ['Generator Backup', 'Valet Parking', 'Security Guards', 'Housekeeping', 'Welcome Drinks', 'Bridal Room', 'Groom Room', 'WiFi', 'Baraat Arrangement', 'Fireworks'],
    decor: ['Stage Decoration', 'Floral Decoration', 'Entrance Decoration', 'Mandap Setup', 'Jaimala Stage', 'LED Wall', 'Car Decoration'],
    entertainment: ['DJ Setup', 'Live Band', 'Orchestra', 'Anchor/Host', 'Dhol', 'Fireworks'],
  },
  corporate: {
    services: ['Generator Backup', 'Valet Parking', 'Security Guards', 'WiFi', 'Projector & Screen', 'PA / Microphone System', 'Podium / Lectern', 'Registration Desk', 'Tea / Coffee Counter', 'Charging Stations', 'Video Conferencing', 'Business Lounge'],
    decor: ['Stage Backdrop / Branding', 'Entrance Standee', 'Table Setup', 'Floral Centerpieces', 'LED Wall', 'Banners / Signage'],
    entertainment: ['Anchor / Host', 'Cultural Program', 'DJ Setup'],
  },
  conference: {
    services: ['Generator Backup', 'Valet Parking', 'Security Guards', 'WiFi', 'Projector & Screen', 'PA / Microphone System', 'Podium / Lectern', 'Registration Desk', 'Breakout Rooms', 'Delegate Kits', 'Tea / Coffee Counter', 'Video Conferencing'],
    decor: ['Stage Backdrop / Branding', 'Entrance Standee', 'Table Setup', 'Floral Centerpieces', 'LED Wall', 'Banners / Signage'],
    entertainment: ['Anchor / Host', 'Cultural Program'],
  },
  birthday: {
    services: ['Generator Backup', 'Valet Parking', 'Security Guards', 'Welcome Drinks', 'WiFi', 'LED Screens', 'Photo Booth', 'Kids Play Area', 'Return Gifts Counter'],
    decor: ['Balloon Decoration', 'Theme Decoration', 'Entrance Decoration', 'Cake Table Setup', 'Photo Booth Backdrop', 'LED Wall'],
    entertainment: ['DJ Setup', 'Anchor/Host', 'Magician', 'Live Band'],
  },
  social: {
    services: ['Generator Backup', 'Valet Parking', 'Security Guards', 'Welcome Drinks', 'WiFi', 'LED Screens', 'Photo Booth', 'Bridal Room'],
    decor: ['Stage Decoration', 'Floral Decoration', 'Entrance Decoration', 'LED Wall', 'Balloon Decoration'],
    entertainment: ['DJ Setup', 'Live Band', 'Orchestra', 'Anchor/Host', 'Dhol'],
  },
  other: {
    services: ['Generator Backup', 'Valet Parking', 'Security Guards', 'Housekeeping', 'Welcome Drinks', 'WiFi', 'LED Screens'],
    decor: ['Stage Decoration', 'Floral Decoration', 'Entrance Decoration', 'LED Wall', 'Balloon Decoration'],
    entertainment: ['DJ Setup', 'Live Band', 'Anchor/Host'],
  },
};
export const addOnsForCategory = (category) => ADDONS_BY_CATEGORY[category] || ADDONS_BY_CATEGORY.other;

// Default Contract & Terms text per event category. These pre-fill the policy
// fields on the booking form (and print on the quotation) so staff don't retype
// them; they remain fully editable per booking.
export const POLICY_FIELDS = ['cancellationPolicy', 'refundPolicy', 'damageCharges', 'overtimeCharges', 'outsideVendorPolicy'];

export const POLICY_DEFAULTS_BY_CATEGORY = {
  wedding: {
    cancellationPolicy: 'Cancellation 30+ days before the event: 75% of advance refunded. 15–30 days: 50% refunded. Under 15 days: advance is non-refundable. One date change permitted, subject to availability.',
    refundPolicy: 'Approved refunds are processed within 10 working days to the original payment mode. Advance may instead be adjusted against a rescheduled date within 6 months.',
    damageCharges: 'Damage to the hall, fixtures, furniture or décor is charged at actuals and adjusted against a refundable security deposit of ₹10,000.',
    overtimeCharges: 'Use beyond the booked slot is charged at ₹5,000 per hour or part thereof. Kindly vacate by the agreed end time.',
    outsideVendorPolicy: 'Outside caterers/decorators allowed with prior approval and a ₹5,000 fee per vendor (in-house catering preferred). Loud music to stop by 10 PM per local norms.',
  },
  corporate: {
    cancellationPolicy: 'Cancellation 15+ days before: 75% of advance refunded. 7–15 days: 50% refunded. Under 7 days: advance is non-refundable. One reschedule permitted, subject to availability.',
    refundPolicy: 'Approved refunds are processed within 7 working days. A GST tax invoice is issued for all corporate bookings.',
    damageCharges: 'Damage to AV equipment, furniture or premises is billed at actuals. A refundable security deposit may apply for equipment-heavy events.',
    overtimeCharges: 'Sessions running beyond the booked hours are charged at the standard hourly hall rate per hour or part thereof.',
    outsideVendorPolicy: 'Client may engage own AV/production vendors with prior intimation; house PA and projector available on request. All vendor setup within the booked slot.',
  },
  conference: {
    cancellationPolicy: 'Cancellation 15+ days before: 75% of advance refunded. 7–15 days: 50% refunded. Under 7 days: advance is non-refundable. Reschedule permitted once, subject to availability.',
    refundPolicy: 'Approved refunds are processed within 7 working days. A GST tax invoice is issued; delegate counts finalise 48 hours before the event.',
    damageCharges: 'Damage to AV/IT equipment, seating or premises is billed at actuals against a refundable security deposit.',
    overtimeCharges: 'Extended sessions beyond the booked hours are charged at the standard hourly hall rate per hour or part thereof.',
    outsideVendorPolicy: 'External production, streaming and interpreter vendors allowed with prior approval; house PA, projector and podium provided. Setup within the booked slot.',
  },
  birthday: {
    cancellationPolicy: 'Cancellation 7+ days before: 50% of advance refunded. Under 7 days: advance is non-refundable. One date change permitted, subject to availability.',
    refundPolicy: 'Approved refunds are processed within 7 working days to the original payment mode.',
    damageCharges: 'Damage to décor, furniture or premises — including balloon/adhesive or paint marks — is charged at actuals.',
    overtimeCharges: 'Time beyond the booked slot is charged at ₹3,000 per hour or part thereof.',
    outsideVendorPolicy: 'Outside cake, décor and entertainment vendors allowed with prior approval; all setup and clearing within the booked slot.',
  },
  social: {
    cancellationPolicy: 'Cancellation 15+ days before: 60% of advance refunded. 7–15 days: 40% refunded. Under 7 days: advance is non-refundable. One date change permitted, subject to availability.',
    refundPolicy: 'Approved refunds are processed within 10 working days to the original payment mode, or adjusted against a rescheduled date.',
    damageCharges: 'Damage to the hall, fixtures, furniture or décor is charged at actuals and adjusted against a refundable security deposit.',
    overtimeCharges: 'Use beyond the booked slot is charged at ₹4,000 per hour or part thereof.',
    outsideVendorPolicy: 'Outside caterers/decorators/DJ allowed with prior approval and a per-vendor fee. Loud music to stop by 10 PM per local norms.',
  },
  other: {
    cancellationPolicy: 'Cancellation 15+ days before: 60% of advance refunded. 7–15 days: 40% refunded. Under 7 days: advance is non-refundable. Reschedule subject to availability.',
    refundPolicy: 'Approved refunds are processed within 10 working days to the original payment mode.',
    damageCharges: 'Damage to the hall, fixtures, furniture or décor is charged at actuals against a refundable security deposit.',
    overtimeCharges: 'Use beyond the booked slot is charged at the standard hourly hall rate per hour or part thereof.',
    outsideVendorPolicy: 'Outside vendors allowed with prior approval; all setup and clearing within the booked slot.',
  },
};

// The full set of default policy texts for an event type.
export const policyDefaultsForType = (eventType) =>
  ({ ...(POLICY_DEFAULTS_BY_CATEGORY[eventCategory(eventType)] || POLICY_DEFAULTS_BY_CATEGORY.other) });

// A policy value is "auto" (safe to replace when the type changes) when it's
// blank or still equals one of the category defaults — i.e. staff haven't
// hand-edited it. Hand-edited text is never overwritten.
export const isAutoPolicyValue = (field, value) => {
  if (!value || !String(value).trim()) return true;
  return Object.values(POLICY_DEFAULTS_BY_CATEGORY).some((s) => s[field] === value);
};

// Event types that show the wedding-specific fields (bride/groom names etc.)
export const WEDDING_EVENT_TYPES = ['Wedding', 'Reception'];

export const EVENT_TYPES = [
  'Wedding', 'Reception', 'Engagement', 'Anniversary', 'Party',
  'Birthday', 'Corporate', 'Meeting', 'Conference', 'Other',
];
export const BOOKING_STATUS = ['Confirmed', 'Pending', 'Cancelled', 'Completed'];

// Each event type belongs to a category that decides which type-specific fields
// the booking form's Event step shows (and how the venue is priced).
export const EVENT_CATEGORY = {
  Wedding: 'wedding', Reception: 'wedding',
  Engagement: 'social', Anniversary: 'social', Party: 'social',
  Corporate: 'corporate', Meeting: 'corporate',
  Conference: 'conference',
  Birthday: 'birthday',
  Other: 'other',
};
export const eventCategory = (eventType) => EVENT_CATEGORY[eventType] || 'other';

// Corporate-style events are priced by the hour (duration) rather than by floor.
export const DURATION_PRICED_TYPES = ['Corporate', 'Meeting', 'Conference', 'Birthday'];
export const isDurationPricedType = (eventType) => DURATION_PRICED_TYPES.includes(eventType);

// Sub-types offered for a Social Event (mirrors the eventType choices in that
// category) — used by the New-Booking "Social Event" preset.
export const SOCIAL_EVENT_TYPES = ['Engagement', 'Anniversary', 'Party'];

// Ordered steps for the step-by-step booking wizard.
export const BOOKING_STEPS = [
  'Customer',
  'Event',
  'Venue & Décor',
  'Catering',
  'Guests & Add-ons',
  'Payment',
];

// Empty shapes for the repeatable line items added on the booking form.
// Meal sittings a catering line can be for — lets a multi-day event bill
// breakfast / lunch / dinner separately (each line × plates × days).
export const MEAL_OPTIONS = ['Breakfast', 'Lunch', 'Hi-Tea', 'Dinner', 'All-day'];

export const emptyCateringItem = {
  cateringPackageId: '', name: '', category: '', meal: '', perPlate: 0, plates: '', actualPlates: null, days: 1,
};
export const emptyDecorationItem = {
  decorationPackageId: '', name: '', category: '', cost: 0, details: '',
};
export const emptyUtensilItem = {
  utensilItemId: '', name: '', unit: 'piece', cost: 0, quantity: '',
};
// Chargeable extras beyond the typed buckets — sound system, projector, Wi-Fi.
// Quoted ex-GST and billed gross; carried over automatically when a quotation
// is converted, and editable here for anything added on the event day.
export const emptyFacilityItem = {
  name: '', detail: '', price: 0, gstPercent: 18, quantity: 1,
};

// Common facilities, offered as suggestions on the booking form.
export const FACILITY_SUGGESTIONS = [
  'Sound System', 'Wireless Mic', 'LED Projector & Screen', 'Wi-Fi (120 Mbps)',
  'Podium & Wireless Mic', 'Stage Backdrop / Branding', 'Generator Backup',
  'Extra Lighting', 'Live Streaming Setup',
];

export const initialFormData = {
  customerName: '',
  customerPhone: '',
  alternatePhone: '',
  customerEmail: '',

  // Extended customer / KYC
  address: '',
  city: '',
  state: '',
  pincode: '',
  idProofType: '',
  idProofNumber: '',
  gstNumber: '',

  eventType: 'Wedding',
  eventDate: format(new Date(), 'yyyy-MM-dd'),
  startTime: '10:00',
  endTime: '09:00',
  eventDuration: '',
  guestCount: '',
  advanceAmount: '',
  totalAmount: 0,
  remainingAmount: 0,
  status: 'Pending',
  specialRequests: '',
  additionalServices: [],
  decorationType: '',
  decorationDetails: '',
  decorationCost: 0,
  selectedFloors: [],
  floorCost: 0,
  roomsCost: 0, // charge for reserved guest rooms (₹ per room), separate from the floor
  rooms: [], // guest rooms reserved for this event (blocked from regular booking)

  // Event package (venue + decoration bundle). When applied, its basePrice and
  // decorationCost drive the venue/decoration totals (the floor & decoration
  // pickers are replaced by a package summary).
  packageId: '',
  packageName: '',
  packageBasePrice: 0,
  packageDecorationCost: 0,

  // Catering package (per-plate menu bundle) + plate count. Kept for invoice
  // compatibility — flattened from the first cateringItems entry on submit.
  cateringPackageId: '',
  cateringPackageName: '',
  cateringPerPlate: 0,
  numberOfPlates: '',

  // Repeatable line items (each priced separately, summed into the total).
  cateringItems: [],   // [{ cateringPackageId, name, category, perPlate, plates, days }]
  decorationItems: [],  // [{ decorationPackageId, name, category, cost, details }]
  utensilItems: [],     // [{ utensilItemId, name, unit, cost, quantity }] — rented cookware
  extraItems: [],       // [{ name, detail, price, gstPercent, quantity }] — additional facilities
  utensilsCost: 0,      // computed sum of utensil line amounts

  menuCost: 0, // computed catering total (kept for invoice compatibility)
  numberOfDays: 1, // inclusive event-day span (drives multi-day duration pricing)
  endDate: '',
  daysWithMeals: '',

  // Event title + wedding-specific names
  eventTitle: '',
  groomName: '',
  brideName: '',

  // Type-specific event details (only the ones for the chosen event category
  // are shown/edited; the rest stay empty). Mirrors BanquetBooking.eventDetails.
  eventDetails: {
    organizationName: '',
    contactPerson: '',
    agenda: '',
    delegates: '',
    sessionsDays: '',
    avRequired: false,
    birthdayPersonName: '',
    birthdayAge: '',
    theme: '',
    cakeRequired: false,
    cakeMessage: '',
    celebrantNames: '',
    occasionNote: '',
  },

  // Venue configuration
  venueCapacity: '',
  seatingStyle: '',

  // Guest breakdown
  expectedGuests: '',
  guaranteedGuests: '',
  vipGuests: '',
  kidsCount: '',

  // Room booking for baraat / guests
  roomCheckIn: '',
  roomCheckOut: '',
  roomTypes: [],
  complimentaryRooms: '',
  extraBedRequired: false,

  // Coordinator / sales ownership
  salesExecutive: '',
  eventManager: '',
  coordinatorPhone: '',

  // Payment schedule (installment plan)
  paymentSchedule: [],

  // Contract & terms
  cancellationPolicy: '',
  refundPolicy: '',
  damageCharges: '',
  overtimeCharges: '',
  outsideVendorPolicy: '',
  termsAccepted: false,

  // Decoration extras
  decorationOptions: [],
  decorVendor: '',

  // Photography & Videography
  photographyRequired: false,
  videographyRequired: false,
  droneCoverage: false,
  preWeddingShoot: false,
  photographyVendor: '',
  photographyAmount: '',

  // Entertainment
  entertainmentOptions: [],
  entertainmentVendor: '',
  entertainmentCost: '',
};
