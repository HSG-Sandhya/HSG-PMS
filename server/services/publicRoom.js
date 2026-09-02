/**
 * What an anonymous guest may see about a room.
 *
 * The public endpoints returned Mongoose documents straight from the database,
 * so a guest browsing the storefront also received the operational record:
 * housekeeping state (`status`, `lastCleaned`), the internal `roomNumber`, and
 * `maintenanceHistory` — which carries a free-text fault description, what the
 * repair cost, and the name of whoever resolved it. None of that helps someone
 * choose a room, and the last of it is nobody's business outside the hotel.
 *
 * One serializer, so "what a guest may see about a room" is decided in a single
 * place rather than re-derived per endpoint. Adding a field to the Room schema
 * no longer publishes it by default: it has to be added here on purpose.
 */
import { roomGst } from '../config/operationalConfig.js';

/** Title-case a stored lowercase enum for display ('deluxe' -> 'Deluxe'). */
const titleCase = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);

/**
 * The marketing view of a room.
 *
 * `capacity` is the total number of people, matching the convention the
 * storefront already uses; the split is offered separately rather than
 * overloading the same name with two shapes.
 *
 * @param {object} room     a Room document or lean object
 * @param {object} billing  resolved billing config, for the GST-inclusive total
 */
export const publicRoomView = (room, billing) => {
  if (!room) return null;
  const basePrice = room.pricePerNight || 0;
  const adults = room.capacity?.adults || 0;
  const children = room.capacity?.children || 0;

  return {
    id: room._id,
    _id: room._id, // the storefront indexes on _id
    type: titleCase(room.type),
    capacity: adults + children,
    maxAdults: adults,
    maxChildren: children,
    // Base price; the storefront adds GST so it can show the breakdown.
    price: basePrice,
    pricePerNight: basePrice,
    totalPrice: room.totalPrice || basePrice + roomGst(basePrice, billing),
    amenities: room.amenities || [],
    features: room.features || [],
    description: room.description || '',
    images: room.images || [],
    floor: room.floor,
  };
};

/**
 * The storefront's room list needs two things the marketing view does not:
 * the room number it labels the card with, and whether booking is open. Kept
 * as a deliberate extension so the extra disclosure is visible in one place.
 *
 * `status` is passed through because the site renders an unavailable room as
 * view-only rather than hiding it. It says "occupied" or "maintenance"; it does
 * not say who was in it, when it was last cleaned, or what a repair cost.
 */
export const storefrontRoomView = (room, billing) => ({
  ...publicRoomView(room, billing),
  roomNumber: room.roomNumber,
  status: titleCase(room.status) || 'Available',
  isAvailable: room.status === 'available',
});

/** Fields the public endpoints need to read. Anything else is not fetched. */
export const PUBLIC_ROOM_FIELDS =
  'roomNumber type capacity pricePerNight totalPrice amenities features description images floor status';
