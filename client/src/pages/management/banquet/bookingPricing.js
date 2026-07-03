// Pure pricing / timing helpers for the Banquet Hall booking form.
import { format, parseISO } from 'date-fns';
import { FLOOR_OPTIONS, isDurationPricedType } from './bookingConstants';
import { liveBilling } from '../../../utils/billing';

export const calculateFloorCost = (selectedFloors) => {
  if (selectedFloors.length === 0) { return 0; }
  if (selectedFloors.length === FLOOR_OPTIONS.length) { return 151000; } // All floors special price (includes decoration)
  return selectedFloors.reduce((total, floor) => {
    const option = FLOOR_OPTIONS.find(f => f.value === floor);
    return total + (option ? option.cost : 0);
  }, 0);
};

// Catering cost is simply the chosen package's per-plate price × plates × days.
export const calculateCateringCost = (perPlate, numberOfPlates, days) =>
  (Number(perPlate) || 0) * (parseInt(numberOfPlates, 10) || 0) * Math.max(1, parseInt(days, 10) || 1);

// One catering line item's amount: per-plate × plates × days.
//  • After the event, the ACTUAL plates consumed (actualPlates) drive the amount.
//  • Before that, the quoted `plates` estimate applies.
//  • If no plates estimate was entered, fall back to the event's guest count —
//    at quotation staff just pick a package + total guests, so guests ARE the
//    estimated plate count (actuals are captured later at finalize).
export const cateringItemAmount = (item, guestCount = 0) => {
  const hasActual = item?.actualPlates !== null && item?.actualPlates !== undefined && item?.actualPlates !== '';
  const estimate = (parseInt(item?.plates, 10) || 0) || (parseInt(guestCount, 10) || 0);
  const plates = hasActual ? (parseInt(item.actualPlates, 10) || 0) : estimate;
  return (Number(item?.perPlate) || 0) * plates * Math.max(1, parseInt(item?.days, 10) || 1);
};

// Sum of every catering line item on the booking.
export const sumCateringItems = (items = [], guestCount = 0) =>
  (items || []).reduce((total, it) => total + cateringItemAmount(it, guestCount), 0);

// Sum of every decoration line item (each a flat cost) on the booking.
export const sumDecorationItems = (items = []) =>
  (items || []).reduce((total, it) => total + (Number(it?.cost) || 0), 0);

// One rented-utensil line's amount: per-unit cost × quantity taken.
export const utensilItemAmount = (item) =>
  (Number(item?.cost) || 0) * (parseInt(item?.quantity, 10) || 0);

// Sum of every utensil line item on the booking (rented cookware charge).
export const sumUtensilItems = (items = []) =>
  (items || []).reduce((total, it) => total + utensilItemAmount(it), 0);

export const calculateTotalAmount = ({
  floorCost,
  decorationCost,
  cateringCost,
  eventType,
  eventDuration,
  extrasCost = 0,
}) => {
  // For corporate-style events (Corporate/Meeting/Conference/Birthday), the venue
  // is duration-based (configured hourly rate) rather than floor-priced.
  if (isDurationPricedType(eventType)) {
    const durationCost = (parseFloat(eventDuration) || 0) * liveBilling().banquetVenueHourlyRate;
    return durationCost + cateringCost + extrasCost;
  }
  // Everything else: floor (or event package base) + decoration + catering + extras.
  return floorCost + decorationCost + cateringCost + extrasCost;
};

export const calculateRemainingAmount = (totalAmount, advanceAmount) =>
  Math.max(0, totalAmount - advanceAmount);

export const calculateEventDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return '';

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  let durationMinutes = endMinutes - startMinutes;

  // Handle overnight events
  if (durationMinutes < 0) {
    durationMinutes += 24 * 60;
  }

  const hours = Math.ceil(durationMinutes / 60); // Round up to nearest hour

  return hours.toString();
};

// Standard timing per event type:
// - Wedding: 10:00 on the event date until 09:00 the next day (overnight)
// - Everything else: 10:00 to 22:00 on the same day
export const getEventTimingDefaults = (eventType, eventDate) => {
  if (eventType === 'Wedding') {
    let endDate = '';
    if (eventDate) {
      try {
        const next = new Date(parseISO(eventDate));
        next.setDate(next.getDate() + 1);
        endDate = format(next, 'yyyy-MM-dd');
      } catch (_e) {
        endDate = '';
      }
    }
    return { startTime: '10:00', endTime: '09:00', endDate };
  }
  return { startTime: '10:00', endTime: '22:00', endDate: '' };
};
