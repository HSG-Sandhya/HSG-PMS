import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  publicAmenities, publicServices, publicGallery, publicOffers, publicHotelInfo,
} from '../services/websiteContent.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const controller = fs.readFileSync(path.join(here, '..', 'controllers', 'websiteController.js'), 'utf8');

// The marketing endpoints returned arrays written into the controller, so every
// hotel on the platform would advertise the same spa and swimming pool. It was
// wrong for the hotel running it too: the live site served "+1 (555) 123-4567"
// because the code read settings.phone while the real number lives at
// hotelProfile.contact.phone.

test('no hotel name, address or phone literal survives in the controller', () => {
  for (const literal of ['Sandhya', '555) 123-4567', '123 Main Street',
    'Swimming Pool', 'Fitness Center', 'world-class amenities']) {
    assert.equal(controller.includes(literal), false,
      `"${literal}" is still hard-coded in generic multi-hotel code`);
  }
});

test('a hotel that has filled nothing in publishes nothing', () => {
  // An empty list is honest; an invented one is not.
  const empty = { amenities: [], services: [], gallery: [], offers: [], highlights: [] };
  assert.deepEqual(publicAmenities(empty), []);
  assert.deepEqual(publicServices(empty), []);
  assert.deepEqual(publicGallery(empty), []);
  assert.deepEqual(publicOffers(empty), []);
  // Missing keys entirely, not just empty arrays.
  assert.deepEqual(publicAmenities({}), []);
  assert.deepEqual(publicOffers({}), []);
});

test('hotel info comes from settings, and an unset field comes back empty', () => {
  const info = publicHotelInfo(
    {
      hotelProfile: {
        hotelName: 'The Riverside',
        description: 'A small hotel by the water',
        address: { city: 'Munger', country: 'India' },
        contact: { phone: '+91 9000000000', email: 'stay@riverside.test' },
        starRating: 3,
      },
      policies: { checkInTime: '13:00', checkOutTime: '10:00' },
    },
    { highlights: ['Free WiFi'] },
    { defaultCheckInTime: '12:00', defaultCheckOutTime: '11:00' }
  );

  assert.equal(info.name, 'The Riverside');
  assert.equal(info.phone, '+91 9000000000');
  assert.equal(info.checkIn, '13:00', "the hotel's own policy wins over the billing default");
  assert.equal(info.checkOut, '10:00');
  assert.equal(info.website, '', 'an unset field is empty, not a placeholder');
  assert.equal(info.altPhone, '');
  assert.deepEqual(info.highlights, ['Free WiFi']);
  assert.equal(info.starRating, 3);
});

test('check-in falls back to the billing default, then to empty', () => {
  const withBilling = publicHotelInfo({}, {}, { defaultCheckInTime: '12:00', defaultCheckOutTime: '11:00' });
  assert.equal(withBilling.checkIn, '12:00');
  const withNothing = publicHotelInfo({}, {}, {});
  assert.equal(withNothing.checkIn, '', 'never 3:00 PM from a source literal');
  assert.equal(withNothing.name, '');
});

test('an entirely absent settings document does not throw', () => {
  const info = publicHotelInfo(null, null, null);
  assert.equal(info.name, '');
  assert.deepEqual(info.highlights, []);
  assert.equal(info.address, null);
});

test('an expired offer stops advertising itself', () => {
  const now = new Date('2026-09-02');
  const content = {
    offers: [
      { _id: '1', title: 'Live', validUntil: new Date('2026-10-01'), active: true },
      { _id: '2', title: 'Expired', validUntil: new Date('2026-08-01'), active: true },
      { _id: '3', title: 'No end date', validUntil: null, active: true },
      { _id: '4', title: 'Switched off', validUntil: new Date('2026-10-01'), active: false },
    ],
  };
  const titles = publicOffers(content, now).map((o) => o.title);
  assert.deepEqual(titles, ['Live', 'No end date']);
});

test('inactive items are withheld and order is respected', () => {
  const content = {
    amenities: [
      { _id: 'b', name: 'Second', order: 2, active: true },
      { _id: 'a', name: 'First', order: 1, active: true },
      { _id: 'x', name: 'Hidden', order: 0, active: false },
    ],
  };
  assert.deepEqual(publicAmenities(content).map((a) => a.name), ['First', 'Second']);
});

test('the public shape carries no internal bookkeeping', () => {
  const content = {
    services: [{ _id: 's1', name: 'Laundry', description: 'Same day', order: 3, active: true, available: false }],
  };
  const [s] = publicServices(content);
  assert.deepEqual(Object.keys(s).sort(), ['available', 'description', 'id', 'name']);
  assert.equal(s.available, false, 'a service can be listed but marked unavailable');
});

test('the default hotel name is never another hotel name', async () => {
  const { currentTenantName } = await import('../db/tenantContext.js');
  const name = currentTenantName();
  assert.equal(/sandhya/i.test(name), false,
    'a new hotel on the platform must not be named after the first one');
});
