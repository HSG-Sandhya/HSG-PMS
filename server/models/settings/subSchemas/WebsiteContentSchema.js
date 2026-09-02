import { Schema } from 'mongoose';

/**
 * Public-website content, per hotel.
 *
 * The marketing endpoints — amenities, services, gallery, special offers, and
 * the bullet list on the hotel-info page — returned arrays written into the
 * controller. Under multi-tenancy that means every hotel on the platform
 * advertises the same swimming pool, spa and fitness centre, and one of them is
 * named in generic code. It was also simply wrong for the hotel running it:
 * the live site was serving "+1 (555) 123-4567" as the phone number.
 *
 * This is the smallest CMS that solves it. Each hotel edits its own copy
 * through the existing settings API (PUT /api/settings/section/websiteContent),
 * and a hotel that has filled nothing in publishes nothing — an empty list is
 * honest, an invented one is not.
 */

const itemBase = {
  name: { type: String, trim: true, required: true },
  description: { type: String, trim: true, default: '' },
  icon: { type: String, trim: true, default: '' },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
};

const AmenitySchema = new Schema(itemBase, { _id: true });

const ServiceSchema = new Schema(
  { ...itemBase, available: { type: Boolean, default: true } },
  { _id: true }
);

const GalleryItemSchema = new Schema(
  {
    title: { type: String, trim: true, default: '' },
    // A path this hotel serves: an /api/images/<id> reference or a static file.
    image: { type: String, trim: true, required: true },
    category: { type: String, trim: true, default: 'general' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const OfferSchema = new Schema(
  {
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: '' },
    discount: { type: Number, min: 0, max: 100, default: 0 },
    // Absent means "no end date"; a past date hides the offer automatically, so
    // a stale promotion cannot keep advertising itself.
    validUntil: { type: Date, default: null },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const WebsiteContentSchema = new Schema(
  {
    amenities: { type: [AmenitySchema], default: [] },
    services: { type: [ServiceSchema], default: [] },
    gallery: { type: [GalleryItemSchema], default: [] },
    offers: { type: [OfferSchema], default: [] },
    // The short bullet list shown beside the hotel's contact details.
    highlights: { type: [String], default: [] },
  },
  { _id: false }
);

export default WebsiteContentSchema;
