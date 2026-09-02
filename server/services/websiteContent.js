/**
 * Public-website content for whichever hotel this request belongs to.
 *
 * The marketing endpoints used to return arrays written into the controller,
 * so under multi-tenancy every hotel on the platform would advertise the same
 * spa and swimming pool, and one hotel's name sat in generic code. It was wrong
 * for the hotel running it, too — the live site served a placeholder US phone
 * number because the real one lives at hotelProfile.contact.phone and the code
 * read settings.phone.
 *
 * Everything here resolves from Settings, which the tenant context already
 * scopes to the right database. A hotel that has filled nothing in publishes
 * nothing: an empty list is honest, an invented one is not.
 */
import Settings from '../models/Settings.js';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

const publishable = (item) => item?.active !== false;

/** An offer with a past validUntil hides itself, so a stale promotion cannot linger. */
const currentOffer = (offer, now = new Date()) =>
  publishable(offer) && (!offer.validUntil || new Date(offer.validUntil) >= now);

export const getWebsiteContent = async () => {
  const settings = await Settings.findOne({}, { websiteContent: 1 }).lean();
  const c = settings?.websiteContent || {};
  return {
    amenities: c.amenities || [],
    services: c.services || [],
    gallery: c.gallery || [],
    offers: c.offers || [],
    highlights: c.highlights || [],
  };
};

export const publicAmenities = (content) =>
  (content.amenities || []).filter(publishable).sort(byOrder)
    .map((a) => ({ id: a._id, name: a.name, description: a.description, icon: a.icon }));

export const publicServices = (content) =>
  (content.services || []).filter(publishable).sort(byOrder)
    .map((s) => ({ id: s._id, name: s.name, description: s.description, available: s.available !== false }));

export const publicGallery = (content) =>
  (content.gallery || []).filter(publishable).sort(byOrder)
    .map((g) => ({ id: g._id, title: g.title, image: g.image, category: g.category }));

export const publicOffers = (content, now = new Date()) =>
  (content.offers || []).filter((o) => currentOffer(o, now)).sort(byOrder)
    .map((o) => ({ id: o._id, title: o.title, description: o.description, discount: o.discount, validUntil: o.validUntil }));

/**
 * The hotel's own identity and contact details, entirely from Settings.
 *
 * Nothing is invented: a field the hotel has not filled in comes back empty,
 * rather than as someone else's address or a placeholder phone number.
 */
export const publicHotelInfo = (settings, content, billing) => {
  const profile = settings?.hotelProfile || {};
  const contact = profile.contact || settings?.contact || {};
  const policies = settings?.policies || {};

  return {
    name: profile.hotelName || settings?.hotelName || '',
    description: profile.description || settings?.description || '',
    address: profile.address || settings?.address || null,
    phone: contact.phone || '',
    altPhone: contact.altPhone || '',
    email: contact.email || '',
    website: contact.website || '',
    // The operational times the hotel actually runs on, not 3PM/11AM in code.
    checkIn: policies.checkInTime || billing?.defaultCheckInTime || '',
    checkOut: policies.checkOutTime || billing?.defaultCheckOutTime || '',
    starRating: profile.starRating ?? profile.classification?.starRating ?? null,
    logo: profile.logo || '',
    social: profile.social || {},
    highlights: content?.highlights || [],
  };
};
