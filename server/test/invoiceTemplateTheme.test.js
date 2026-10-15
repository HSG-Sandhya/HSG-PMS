import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInvoiceContext } from '../services/invoiceTemplates/normalize.js';
import {
  getTemplateList, getTemplate, getTemplateTheme,
} from '../services/invoiceTemplates/index.js';
import {
  sanitizeTheme, resolveTheme, BASE_THEME, taxLabels, hexChannels,
} from '../services/invoiceTemplates/theme.js';

const ANIMATED = ['aurora-luxe', 'silk-ribbon', 'marble-shimmer', 'prism-motion'];

const hotel = {
  name: 'Hotel Sandhya Grand & Marriage Hall',
  logo: '',
  address: 'Bari Bazaar, Munger, Bihar',
  contact: { phone: '9431419196', email: 'reservations@sandhyagrand.in' },
  gstin: '10ASQPM7914B3ZW',
};

const roomBooking = {
  guestName: 'Mr. Rohan Verma',
  phone: '9876501234',
  roomId: { roomNumber: '204', roomType: 'Deluxe AC', pricePerNight: 4500 },
  checkIn: new Date('2026-09-19'),
  checkOut: new Date('2026-09-22'),
  adults: 2,
  totalAmount: 13500,
  restaurantCharges: 2400,
  restaurantOrders: [{ orderNumber: 'R-1001', totalAmount: 2400, items: [{}], createdAt: new Date() }],
  paidAmount: 10000,
  paymentMethod: 'Card',
};

const ctxFor = (custom = {}, templateId = 'aurora-luxe', booking = roomBooking, type = 'hotel') => {
  const ctx = normalizeInvoiceContext({ booking, hotel, type });
  ctx.theme = resolveTheme(getTemplate(templateId).theme, custom);
  return ctx;
};

const renderWith = (templateId, custom = {}, booking = roomBooking, type = 'hotel') =>
  getTemplate(templateId).render(ctxFor(custom, templateId, booking, type), { booking, hotel, type });

// ── Registration ────────────────────────────────────────────────────────────

test('the four animated room templates are registered and marked customizable', () => {
  const list = getTemplateList();
  for (const id of ANIMATED) {
    const entry = list.find((t) => t.id === id);
    assert.ok(entry, `${id} is not in the template list`);
    assert.equal(entry.customizable, true, `${id} must expose a theme`);
    assert.ok(entry.name && entry.description, `${id} needs a name and description`);
  }
});

test('templates without a theme report no editable surface', () => {
  // The older designs render fixed; the settings UI must not offer them a
  // styling panel it cannot apply.
  assert.equal(getTemplateTheme('hotel-standard'), null);
  assert.equal(getTemplateTheme('classic'), null);
  assert.equal(getTemplateTheme('no-such-template'), null);
});

test('each animated template publishes its field descriptors and defaults', () => {
  for (const id of ANIMATED) {
    const schema = getTemplateTheme(id);
    assert.ok(schema.fields.length > 0, `${id} has no fields`);
    // The client builds controls from these alone, so each needs enough to render.
    for (const f of schema.fields) {
      assert.ok(f.key && f.type && f.label && f.group, `${id}: incomplete field ${f.key}`);
      if (f.type === 'number') assert.ok(Number.isFinite(f.min) && Number.isFinite(f.max), `${f.key} needs a range`);
      if (f.type === 'select') assert.ok(Array.isArray(f.options) && f.options.length, `${f.key} needs options`);
    }
    assert.match(schema.defaults.accent, /^#[0-9a-f]{6}$/, `${id} default accent must be hex`);
  }
});

// ── Sanitization: nothing untrusted reaches the stylesheet ──────────────────

test('a colour that is not a plain hex value cannot reach the stylesheet', () => {
  // These are the shapes that would break out of `--accent: <value>;` and
  // inject rules of their own into the invoice's <style> block.
  const attacks = [
    'red; } body { display: none } .x {',
    'url(https://evil.example/x.png)',
    'expression(alert(1))',
    '#fff; background-image: url(javascript:alert(1))',
    'var(--anything)',
    '#12345',        // wrong length
    'rgb(1,2,3)',
  ];
  for (const accent of attacks) {
    const clean = sanitizeTheme({ accent });
    assert.equal(clean.accent, undefined, `accepted a bad colour: ${accent}`);
    const theme = resolveTheme({ accent: '#c8a253' }, { accent });
    assert.equal(theme.accent, '#c8a253', `bad colour survived resolution: ${accent}`);
  }
});

test('a hostile colour never appears in rendered CSS, and the default is used instead', () => {
  const html = renderWith('aurora-luxe', { accent: 'red; } body { display: none } .x {' });
  assert.ok(!html.includes('display: none } .x {'), 'injected CSS reached the document');
  assert.ok(html.includes('--accent: #c8a253'), 'the template default should stand in');
});

test('unknown keys are dropped rather than stored', () => {
  const clean = sanitizeTheme({ accent: '#123456', evil: '</style><script>x()</script>', __proto__: {} });
  assert.deepEqual(Object.keys(clean), ['accent']);
});

test('numbers clamp to their range and selects must be a listed option', () => {
  assert.equal(sanitizeTheme({ animationSpeed: 9999 }).animationSpeed, 60);
  assert.equal(sanitizeTheme({ animationSpeed: -5 }).animationSpeed, 6);
  assert.equal(sanitizeTheme({ backgroundIntensity: 50 }).backgroundIntensity, 50);
  assert.equal(sanitizeTheme({ animationSpeed: 'fast' }).animationSpeed, undefined);
  assert.equal(sanitizeTheme({ animation: 'off' }).animation, 'off');
  assert.equal(sanitizeTheme({ animation: 'disco' }).animation, undefined);
});

test('free text is length-capped and stripped of control characters', () => {
  const long = 'x'.repeat(500);
  assert.equal(sanitizeTheme({ docTitle: long }).docTitle.length, 40);
  assert.equal(sanitizeTheme({ docTitle: 'Tax\u0000 Invoice' }).docTitle, 'Tax Invoice');
  // Newlines belong to the multiline field only.
  assert.equal(sanitizeTheme({ docTitle: 'Tax\nInvoice' }).docTitle, 'Tax Invoice');
  assert.ok(sanitizeTheme({ terms: 'One\nTwo' }).terms.includes('\n'));
});

test('custom wording is HTML-escaped in the rendered invoice', () => {
  const html = renderWith('prism-motion', { docTitle: '<script>steal()</script>' });
  assert.ok(!html.includes('<script>steal()'), 'unescaped custom text reached the document');
  assert.ok(html.includes('&lt;script&gt;steal()'), 'the text should render escaped');
});

// ── Customization actually changes the document ─────────────────────────────

test('a custom palette and wording reach the rendered invoice', () => {
  const html = renderWith('silk-ribbon', {
    accent: '#b3003c',
    docTitle: 'Final Bill',
    thankYou: 'Until next time in Munger.',
  });
  assert.ok(html.includes('--accent: #b3003c'), 'the custom accent should drive the CSS');
  assert.ok(html.includes('Final Bill'), 'the custom document title should print');
  assert.ok(html.includes('Until next time in Munger.'), 'the custom closing line should print');
  assert.ok(!html.includes('--accent: #0f7b6c'), 'the default accent should be gone');
});

test('switching a block off removes it from the document', () => {
  for (const id of ANIMATED) {
    const on = renderWith(id);
    const off = renderWith(id, {
      showGstAnnexure: false,
      showAmountInWords: false,
      showSignatures: false,
      showTerms: false,
    });
    assert.ok(on.includes('Rupees Only'), `${id}: amount in words missing when on`);
    assert.ok(!off.includes('Rupees Only'), `${id}: amount in words still present when off`);
    assert.ok(!/Authorised Signatory/.test(off), `${id}: signatures still present when off`);
    assert.ok(off.length < on.length, `${id}: turning blocks off should shorten the invoice`);
  }
});

test('blank terms drop the terms block even while it is switched on', () => {
  const html = renderWith('marble-shimmer', { terms: '   ' });
  assert.ok(!html.includes('Terms &amp; Conditions'), 'an empty terms list should print no heading');
});

// ── Motion ──────────────────────────────────────────────────────────────────

test('turning the animation off emits no animation anywhere', () => {
  for (const id of ANIMATED) {
    const html = renderWith(id, { animation: 'off' });
    // Every animation shorthand collapses to `none`; nothing may still be bound
    // to a @keyframes name.
    const bindings = (html.match(/animation:\s*([^;<>"]+);/g) || []);
    for (const binding of bindings) {
      assert.match(binding, /animation:\s*none\s*(!important)?;/, `${id}: live animation left in — ${binding}`);
    }
  }
});

test('every animated template freezes its motion for print', () => {
  for (const id of ANIMATED) {
    const html = renderWith(id);
    assert.ok(html.includes('@media print'), `${id} has no print rules`);
    const printBlock = html.slice(html.indexOf('@media print'));
    assert.ok(
      printBlock.includes('animation: none !important'),
      `${id} does not stop its animation when printed`,
    );
    assert.ok(
      html.includes('prefers-reduced-motion'),
      `${id} ignores the reduced-motion preference`,
    );
  }
});

test('the background can be hidden entirely without hiding the invoice', () => {
  const html = renderWith('aurora-luxe', { backgroundIntensity: 0 });
  assert.ok(html.includes('--art-opacity: 0;'), 'the artwork layer should be fully transparent');
  assert.ok(html.includes('Grand Total'), 'the invoice itself must still render');
});

// ── The document still adds up ──────────────────────────────────────────────

test('every animated template renders a complete invoice for a room stay', () => {
  for (const id of ANIMATED) {
    const html = renderWith(id);
    for (const probe of ['<!doctype html>', '</html>', 'Grand Total', 'Rohan Verma', 'Room 204', 'HSN/SAC']) {
      assert.ok(html.includes(probe), `${id} is missing ${probe}`);
    }
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html), `${id} leaked a placeholder value`);
  }
});

test('every animated template also renders a banquet invoice', () => {
  const banquet = {
    customerName: 'Aarav & Diya Sharma',
    hallId: { name: 'Grand Banquet Hall' },
    eventDate: new Date('2026-10-02'),
    eventType: 'Reception',
    startTime: '18:00',
    endTime: '23:00',
    guestCount: 150,
    hallCharges: 25000,
    totalAmount: 132500,
    paidAmount: 50000,
  };
  for (const id of ANIMATED) {
    const html = renderWith(id, {}, banquet, 'banquet');
    assert.ok(html.includes('Grand Banquet Hall'), `${id} dropped the venue`);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html), `${id} leaked a placeholder value`);
  }
});

test('a missing logo falls back to a monogram rather than an empty masthead', () => {
  for (const id of ANIMATED) {
    const html = renderWith(id);
    assert.ok(html.includes('class="brand-mono"'), `${id} should typeset a monogram with no logo`);
    assert.ok(html.includes('>HS<'), `${id} monogram should come from the hotel name`);
  }
});

test('a configured logo is used and the monogram stands down', () => {
  const ctx = ctxFor({}, 'aurora-luxe');
  ctx.hotel.logo = 'data:image/png;base64,iVBORw0KGgo=';
  const html = getTemplate('aurora-luxe').render(ctx, { booking: roomBooking, hotel, type: 'hotel' });
  assert.ok(html.includes('class="brand-mark" src="data:image/png;base64,'), 'the logo should render');
  assert.ok(!html.includes('class="brand-mono"'), 'the monogram should not render beside a real logo');
});

test('turning the logo off removes both the mark and the watermark', () => {
  const html = renderWith('aurora-luxe', { showLogo: false, showWatermark: false });
  assert.ok(!html.includes('class="brand-mono"'), 'monogram still present with the logo off');
  assert.ok(!html.includes('class="wm'), 'watermark still present with it off');
});

// ── Tax labels stay honest ──────────────────────────────────────────────────

test('the GST label states the rate actually charged, not a hardcoded 2.5%', () => {
  // A hotel billing accommodation at 12% must not see "CGST @ 2.5%" printed on
  // a tax invoice for money taxed at 6% + 6%.
  const ctx = normalizeInvoiceContext({
    booking: { totalAmount: 1120, paidAmount: 0, checkIn: new Date('2026-09-01'), checkOut: new Date('2026-09-02') },
    hotel,
    type: 'hotel',
    billing: { roomGstRate: 12, posGstRate: 12, roundAmounts: true },
  });
  const labels = taxLabels(ctx);
  assert.equal(labels.half, 6);
  assert.equal(labels.halfLabel, '@ 6%');
});

test('a zero-rated invoice does not divide by zero', () => {
  const ctx = normalizeInvoiceContext({
    booking: { totalAmount: 0, paidAmount: 0, checkIn: new Date('2026-09-01'), checkOut: new Date('2026-09-02') },
    hotel,
    type: 'hotel',
    billing: { roomGstRate: 0, posGstRate: 0, roundAmounts: true },
  });
  const labels = taxLabels(ctx);
  assert.equal(labels.half, null);
  assert.doesNotThrow(() => renderWith('aurora-luxe', {}, { totalAmount: 0, checkIn: new Date(), checkOut: new Date() }));
});

// ── Small helpers ───────────────────────────────────────────────────────────

test('hex colours convert to the channel triples the CSS uses', () => {
  assert.equal(hexChannels('#ffffff'), '255, 255, 255');
  assert.equal(hexChannels('#000000'), '0, 0, 0');
  assert.equal(hexChannels('#abc'), '170, 187, 204');   // shorthand expands
  assert.equal(hexChannels(''), '0, 0, 0');             // never throws
});

test('resolution layers saved values over template defaults over the base', () => {
  const theme = resolveTheme({ accent: '#111111' }, { ink: '#222222' });
  assert.equal(theme.accent, '#111111', 'template default should win over the base');
  assert.equal(theme.ink, '#222222', 'the saved value should win over both');
  assert.equal(theme.docTitle, BASE_THEME.docTitle, 'untouched fields fall back to the base');
});

// ── Wiring ──────────────────────────────────────────────────────────────────
// Source-level guards, in the style of settingsSurface.test.js: these protect
// two behaviours that are easy to break silently and expensive to notice.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (...parts) => fs.readFileSync(path.join(here, '..', ...parts), 'utf8');

test('the styling and gallery endpoints are declared on the settings router', () => {
  const routes = readSrc('routes', 'settingsRoutes.js');
  assert.match(routes, /router\.get\('\/invoice-theme'/);
  assert.match(routes, /router\.put\('\/invoice-theme'/);
  assert.match(routes, /router\.post\('\/invoice\/thumbnails'/);
});

test('the styling is stored once for the hotel, not once per template', () => {
  // The whole point of the house theme: an admin sets a brand colour in one
  // place and every themed design follows it. A per-template write would bring
  // back the panel-per-card that the gallery replaced.
  const controller = readSrc('controllers', 'settingsController.js');
  const handler = controller.slice(
    controller.indexOf('const updateInvoiceTheme'),
    controller.indexOf('// \u2500\u2500 Banquet quotation/invoice templates'),
  );
  assert.ok(handler.length > 0, 'updateInvoiceTheme is missing');
  assert.match(handler, /updateSection\('invoice', \{ templateTheme: clean \}\)/);
  assert.match(handler, /sanitizeTheme\(customization\)/,
    'incoming values must be sanitized before they are stored');
  assert.ok(!/templateId/.test(handler), 'the house styling must not be keyed by template');
});

test('the gallery renders every design in ONE request', () => {
  // Seventeen separate preview calls would repeat the settings and logo reads
  // seventeen times; this Atlas tier throttles on operation count, not cost.
  const controller = readSrc('controllers', 'settingsController.js');
  const handler = controller.slice(controller.indexOf('const previewInvoiceThumbnails'));
  const body = handler.slice(0, handler.indexOf('\n};'));
  assert.match(body, /const hotel = await buildPreviewHotel\(\);/);
  assert.equal((body.match(/buildPreviewHotel\(/g) || []).length, 1,
    'the hotel identity must be built once for the whole batch');
  assert.match(body, /animation: 'off'/,
    'thumbnails must render still, not animate seventeen cards at once');
});

test('the stored styling has a home in the Settings schema', () => {
  // Mongoose drops unknown paths in strict mode, so without this field every
  // save would report success and persist nothing.
  const model = readSrc('models', 'Settings.js');
  assert.match(model, /templateTheme:\s*\{\s*type:\s*mongoose\.Schema\.Types\.Mixed/);
  const controller = readSrc('controllers', 'settingsController.js');
  assert.match(controller, /validFields = \['templateTheme'/,
    'the section validator must let the field through');
});

test('styling saved under the previous per-template scheme is carried over', () => {
  // The per-template store shipped earlier the same day. Reading it as a
  // fallback means an admin who set colours under that scheme does not silently
  // lose them when the house styling takes over.
  const index = readSrc('services', 'invoiceTemplates', 'index.js');
  const reader = index.slice(index.indexOf('export const getStoredInvoiceTheme'));
  assert.match(reader, /invoice\.templateTheme/);
  assert.match(reader, /perTemplate\[invoice\.template\]/,
    'the selected template\u2019s old entry should seed the house styling');
});


test('the preview endpoint can render values that were never saved', () => {
  // This is what makes "preview these settings" honest — without it the admin
  // would preview the last saved colours, not the ones on screen.
  const controller = readSrc('controllers', 'settingsController.js');
  const preview = controller.slice(controller.indexOf('const previewInvoice'));
  assert.match(preview, /customization = null/);
  assert.match(preview, /customization:\s*customization \? sanitizeTheme\(customization\) : null/);
});
