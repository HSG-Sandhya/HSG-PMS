// Starting points for the quotation builder. Picking a preset fills the package
// columns, optional facilities and terms with a sensible offer for that kind of
// event — staff then adjust prices and inclusions before sending.
//
// Prices are indicative defaults; every field stays editable in the builder.

export const PRICE_BASES = ['per person', 'per plate', 'per day', 'per session', 'lump sum'];

export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Converted'];

export const STATUS_COLOR = {
  Draft: '#94a3b8',
  Sent: '#0ea5e9',
  Accepted: '#10b981',
  Declined: '#ef4444',
  Expired: '#f59e0b',
  Converted: '#8b5cf6',
};

// Optional facilities offered alongside most events (quoted ex-GST).
const STANDARD_ADDONS = [
  { name: 'Sound System', price: 2000, unit: 'per event', quantity: 1, gstPercent: 18, note: '' },
  { name: 'Wireless Mic', price: 500, unit: 'per mic', quantity: 1, gstPercent: 18, note: '' },
  { name: 'Wi-Fi (120 Mbps)', price: 1200, unit: 'per day', quantity: 1, gstPercent: 18, note: '' },
];

const CONFERENCE_ADDONS = [
  { name: 'LED Projector & Screen', price: 3500, unit: 'per day', quantity: 1, gstPercent: 18, note: '' },
  { name: 'Podium & Wireless Mic', price: 1500, unit: 'per event', quantity: 1, gstPercent: 18, note: '' },
  { name: 'Wi-Fi (120 Mbps)', price: 1200, unit: 'per day', quantity: 1, gstPercent: 18, note: '' },
  { name: 'Stage Backdrop / Branding', price: 6000, unit: 'per event', quantity: 1, gstPercent: 18, note: '' },
];

const CORPORATE_COMPLIMENTARY = [
  'Fully Air Conditioned Hall',
  'Professional Wireless Mic',
  'High Speed Wi-Fi',
  'Writing Pads & Pens',
  'Unlimited Mineral Water',
  'Spacious Parking',
  'Dedicated Event Manager',
];

const CELEBRATION_COMPLIMENTARY = [
  'Fully Air Conditioned Hall',
  'High Quality Sound System',
  'Professional Wireless Mic',
  'High Speed Wi-Fi',
  'Spacious Parking',
  'Professional Service Staff',
  'Clean & Hygienic Kitchen',
];

const CORPORATE_TERMS = [
  '50% advance payment required for booking confirmation.',
  'Remaining amount must be paid 48 hours before the event.',
  'Final delegate count must be confirmed 72 hours in advance.',
  'Outside food or catering vendors are not permitted.',
  'Hall handover and setup as per the agreed timings; overtime billed hourly.',
  'GST applicable as per Government norms.',
];

export const QUOTATION_PRESETS = [
  {
    id: 'conference',
    label: 'Conference',
    eventType: 'Conference',
    description: 'Half-day / full-day delegate packages with AV and tea breaks',
    seatingStyle: 'Theater',
    startTime: '09:30',
    endTime: '17:30',
    complimentary: CORPORATE_COMPLIMENTARY,
    terms: CORPORATE_TERMS,
    addOns: CONFERENCE_ADDONS,
    packages: [
      {
        name: 'Half Day Conference',
        tagline: '4 hours · 09:30 AM – 01:30 PM',
        price: 650,
        priceBasis: 'per person',
        days: 1,
        recommended: false,
        sections: [
          { title: 'Hall & Setup', items: ['Fully air conditioned hall', 'Theater / classroom seating', 'Registration desk', 'Writing pad & pen'] },
          { title: 'Refreshments (2 breaks)', items: ['Welcome tea / coffee', 'Mid-session tea with 2 snacks', 'Unlimited mineral water'] },
          { title: 'Audio Visual', items: ['Wireless mic (1)', 'Podium', 'High speed Wi-Fi'] },
        ],
        notes: '',
      },
      {
        name: 'Full Day Conference',
        tagline: '8 hours · 09:30 AM – 05:30 PM',
        price: 1100,
        priceBasis: 'per person',
        days: 1,
        recommended: true,
        sections: [
          { title: 'Hall & Setup', items: ['Fully air conditioned hall', 'Theater / classroom seating', 'Registration desk', 'Writing pad & pen', 'Stage & backdrop space'] },
          { title: 'Refreshments (2 breaks)', items: ['Welcome tea / coffee', 'Morning tea with 2 snacks', 'Evening tea with 2 snacks', 'Unlimited mineral water'] },
          { title: 'Lunch (Buffet)', items: ['2 starters (veg)', 'Paneer main course', 'Seasonal veg sabji', 'Dal tadka', 'Rice & Indian breads', 'Salad, papad & raita', 'Dessert'] },
          { title: 'Audio Visual', items: ['Wireless mic (2)', 'Podium', 'LED projector & screen', 'High speed Wi-Fi'] },
        ],
        notes: '',
      },
      {
        name: 'Residential Conference',
        tagline: 'Full day + stay · per delegate',
        price: 2400,
        priceBasis: 'per person',
        days: 1,
        recommended: false,
        sections: [
          { title: 'Hall & Setup', items: ['Everything in Full Day Conference', 'Breakout area on request'] },
          { title: 'Refreshments (2 breaks)', items: ['All full-day refreshments', 'Working dinner'] },
          { title: 'Lunch (Buffet)', items: ['Full day buffet lunch', 'Buffet dinner'] },
          { title: 'Audio Visual', items: ['Complete AV setup', 'Technician on call'] },
          { title: 'Accommodation', items: ['1 night stay (twin sharing)', 'Breakfast included', 'Complimentary Wi-Fi in rooms'] },
        ],
        notes: 'Room allotment subject to availability on the event date.',
      },
    ],
  },
  {
    id: 'meeting',
    label: 'Meeting',
    eventType: 'Meeting',
    description: 'Compact board / review meeting packages priced per session',
    seatingStyle: 'U-Shape',
    startTime: '10:00',
    endTime: '14:00',
    complimentary: CORPORATE_COMPLIMENTARY,
    terms: CORPORATE_TERMS,
    addOns: CONFERENCE_ADDONS.slice(0, 3),
    packages: [
      {
        name: 'Board Meeting (Half Day)',
        tagline: 'Up to 25 pax · 4 hours',
        price: 12000,
        priceBasis: 'lump sum',
        days: 1,
        recommended: true,
        sections: [
          { title: 'Hall & Setup', items: ['Air conditioned meeting room', 'U-shape / boardroom seating', 'Writing pad & pen', 'Name placards'] },
          { title: 'Refreshments', items: ['Welcome tea / coffee', 'One tea break with 2 snacks', 'Unlimited mineral water'] },
          { title: 'Audio Visual', items: ['Wireless mic (1)', 'LED screen', 'High speed Wi-Fi'] },
        ],
        notes: 'Above 25 pax billed at ₹450 per additional delegate.',
      },
      {
        name: 'Review Meeting (Full Day)',
        tagline: 'Up to 25 pax · 8 hours',
        price: 22000,
        priceBasis: 'lump sum',
        days: 1,
        recommended: false,
        sections: [
          { title: 'Hall & Setup', items: ['Air conditioned meeting room', 'U-shape / boardroom seating', 'Writing pad & pen', 'Name placards'] },
          { title: 'Refreshments', items: ['Welcome tea / coffee', 'Two tea breaks with snacks', 'Unlimited mineral water'] },
          { title: 'Lunch (Buffet)', items: ['Veg buffet lunch', 'Dessert'] },
          { title: 'Audio Visual', items: ['Wireless mic (2)', 'LED projector & screen', 'High speed Wi-Fi'] },
        ],
        notes: 'Above 25 pax billed at ₹800 per additional delegate.',
      },
    ],
  },
  {
    id: 'corporate',
    label: 'Corporate Event',
    eventType: 'Corporate',
    description: 'Annual day / product launch / dealer meet with dinner',
    seatingStyle: 'Round Table',
    startTime: '18:00',
    endTime: '23:00',
    complimentary: CELEBRATION_COMPLIMENTARY,
    terms: CORPORATE_TERMS,
    addOns: [...CONFERENCE_ADDONS.slice(0, 1), ...STANDARD_ADDONS],
    packages: [
      {
        name: 'Corporate Evening — Veg',
        tagline: 'Cocktail seating · 5 hours',
        price: 850,
        priceBasis: 'per plate',
        days: 1,
        recommended: false,
        sections: [
          { title: 'Hall & Setup', items: ['Fully air conditioned hall', 'Round table seating', 'Stage with backdrop space'] },
          { title: 'Welcome (3 items)', items: ['Welcome drink', 'Paneer tikka', 'Veg spring roll'] },
          { title: 'Main Course (8 items)', items: ['Paneer butter masala', 'Seasonal veg sabji', 'Dal makhani', 'Veg pulao', 'Indian breads', 'Green salad', 'Raita & papad', 'Dessert'] },
          { title: 'Audio Visual', items: ['Sound system', 'Wireless mic (2)', 'High speed Wi-Fi'] },
        ],
        notes: '',
      },
      {
        name: 'Corporate Evening — Non-Veg',
        tagline: 'Cocktail seating · 5 hours',
        price: 1050,
        priceBasis: 'per plate',
        days: 1,
        recommended: true,
        sections: [
          { title: 'Hall & Setup', items: ['Fully air conditioned hall', 'Round table seating', 'Stage with backdrop space'] },
          { title: 'Welcome (3 items)', items: ['Welcome drink', 'Chicken tikka', 'Paneer tikka'] },
          { title: 'Main Course (8 items)', items: ['Chicken curry (Indian style)', 'Paneer butter masala', 'Seasonal veg sabji', 'Dal tadka', 'Veg pulao', 'Indian breads', 'Salad, raita & papad', 'Dessert'] },
          { title: 'Audio Visual', items: ['Sound system', 'Wireless mic (2)', 'High speed Wi-Fi'] },
        ],
        notes: '',
      },
    ],
  },
  {
    id: 'celebration',
    label: 'Celebration',
    eventType: 'Birthday',
    description: 'Birthday / anniversary / reception per-plate menu options',
    seatingStyle: 'Banquet',
    startTime: '19:00',
    endTime: '23:00',
    complimentary: CELEBRATION_COMPLIMENTARY,
    terms: [
      '50% advance payment required for booking confirmation.',
      'Remaining amount must be paid 48 hours before the event.',
      'Prices are per plate.',
      'Outside food or catering vendors are not permitted.',
      'Additional decorations or customized menus are chargeable.',
      'GST applicable as per Government norms.',
    ],
    addOns: STANDARD_ADDONS,
    packages: [
      {
        name: 'Fish Package',
        tagline: 'Fully air conditioned banquet hall',
        price: 700,
        priceBasis: 'per plate',
        days: 1,
        recommended: false,
        sections: [
          { title: 'Welcome (3 items)', items: ['Veg Kachri', 'Paneer Pakoda', 'Tea'] },
          { title: 'Main Course (9 items)', items: ['Matar Paneer', 'Seasonal Veg Sabji', 'Veg Pulao', 'Dal Tadka', 'Fish (Indian Style)', 'Hing Kachori / Paalak Kachori', 'Green Salad', 'Papad', 'Mix Raita'] },
        ],
        notes: '',
      },
      {
        name: 'Mutton Package',
        tagline: 'Fully air conditioned banquet hall',
        price: 900,
        priceBasis: 'per plate',
        days: 1,
        recommended: true,
        sections: [
          { title: 'Welcome (3 items)', items: ['Veg Kachri', 'Paneer Pakoda', 'Tea'] },
          { title: 'Main Course (9 items)', items: ['Matar Paneer', 'Seasonal Veg Sabji', 'Veg Pulao', 'Dal Tadka', 'Mutton (Indian Style)', 'Hing Kachori / Paalak Kachori', 'Green Salad', 'Papad', 'Mix Raita'] },
        ],
        notes: '',
      },
    ],
  },
];

// A quotation that is past its validity date is shown as Expired without the
// stored status changing — an open proposal simply goes stale on its own date,
// and re-dating it in the builder makes it live again. Accepted/Converted
// quotations are past that point, so they never expire.
const LIVE_STATUSES = ['Draft', 'Sent'];

export const isExpired = (q) => {
  if (!q?.validUpto || !LIVE_STATUSES.includes(q.status)) return false;
  const end = new Date(q.validUpto);
  end.setHours(23, 59, 59, 999); // valid through the whole of the last day
  return end < new Date();
};

// Status to display for a quotation, folding in derived expiry.
export const effectiveStatus = (q) => (isExpired(q) ? 'Expired' : q?.status);

export const emptyPackage = () => ({
  name: '', tagline: '', price: 0, priceBasis: 'per person',
  quantity: 0, days: 1, recommended: false, sections: [], notes: '',
});

export const emptySection = () => ({ title: '', items: [] });

export const emptyAddOn = () => ({ name: '', price: 0, unit: 'per event', quantity: 1, gstPercent: 18, note: '' });

export const emptyQuotation = () => ({
  clientName: '', clientCompany: '', clientPhone: '', clientEmail: '', clientAddress: '', clientGstin: '',
  eventType: 'Conference', eventTitle: '', hallId: '', hallName: '',
  eventDate: null, endDate: null, startTime: '', endTime: '',
  expectedGuests: 0, seatingStyle: '',
  packages: [], addOns: [], complimentary: [], terms: [], notes: '',
  preparedBy: '', contactNumber: '', status: 'Draft',
  quotationDate: new Date(), validUpto: null,
});

// Mirror of the server-side helpers (models/EventQuotation.js) so the builder can
// show live totals without a round trip. Keep the two in step.
export const packageTotal = (pkg, fallbackGuests = 0) => {
  const price = Number(pkg?.price) || 0;
  const days = Number(pkg?.days) || 1;
  if (pkg?.priceBasis === 'lump sum') return price * days;
  const qty = Number(pkg?.quantity) || Number(fallbackGuests) || 0;
  return price * qty * days;
};

export const addOnTotal = (addOn) => {
  const base = (Number(addOn?.price) || 0) * (Number(addOn?.quantity) || 1);
  return Math.round(base * (1 + (Number(addOn?.gstPercent) || 0) / 100));
};
