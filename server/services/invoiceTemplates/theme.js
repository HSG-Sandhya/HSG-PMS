import { escapeHtml as e } from './formatters.js';

// ── Invoice template theming ────────────────────────────────────────────────
// The animated room-invoice designs (Aurora Luxe, Silk Ribbon, Marble Shimmer,
// Prism Motion) are driven entirely by the values resolved here, so an admin
// can restyle a template — colours, wording, which blocks appear, how the
// background moves — without a code change.
//
// Every value reaches a <style> block or the document body, so NOTHING is
// trusted: colours must match a strict hex pattern, numbers are clamped to a
// range, selects must be one of their options, and text is escaped at render.
// An invalid value falls back to the template's default rather than failing the
// render — a bad colour must never cost a guest their invoice.
// ────────────────────────────────────────────────────────────────────────────

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// The editable surface, in the order the settings UI renders it. `group` drives
// the accordion sections; the client builds its controls from this list alone,
// so adding a knob here is enough to expose it.
export const THEME_FIELDS = [
  // ── Colours ──
  { key: 'accent', type: 'color', group: 'Colours', label: 'Accent',
    help: 'Rules, headings and the leading colour of the moving background.' },
  { key: 'accentAlt', type: 'color', group: 'Colours', label: 'Secondary accent',
    help: 'The colour the background animation blends towards.' },
  { key: 'ink', type: 'color', group: 'Colours', label: 'Body text' },
  { key: 'muted', type: 'color', group: 'Colours', label: 'Secondary text',
    help: 'Labels, captions and hints.' },
  { key: 'sheet', type: 'color', group: 'Colours', label: 'Invoice sheet',
    help: 'The paper the invoice is printed on. Keep it light.' },
  { key: 'backdrop', type: 'color', group: 'Colours', label: 'Backdrop',
    help: 'Sits behind the sheet, on screen only — printing always uses white.' },
  { key: 'headerInk', type: 'color', group: 'Colours', label: 'Header text',
    help: 'Text drawn over the coloured masthead band.' },

  // ── Wording ──
  { key: 'docTitle', type: 'text', group: 'Wording', label: 'Document title', max: 40 },
  { key: 'tagline', type: 'text', group: 'Wording', label: 'Tagline', max: 90,
    help: 'Printed under the hotel name. Leave blank to hide it.' },
  { key: 'billedToLabel', type: 'text', group: 'Wording', label: '"Billed to" heading', max: 30 },
  { key: 'stayLabel', type: 'text', group: 'Wording', label: '"Stay details" heading', max: 30 },
  { key: 'thankYou', type: 'text', group: 'Wording', label: 'Closing line', max: 160 },
  { key: 'footerNote', type: 'text', group: 'Wording', label: 'Footer note', max: 200 },
  { key: 'guestSignatureLabel', type: 'text', group: 'Wording', label: 'Guest signature label', max: 40 },
  { key: 'signatoryLabel', type: 'text', group: 'Wording', label: 'Hotel signature label', max: 40 },
  { key: 'terms', type: 'multiline', group: 'Wording', label: 'Terms & conditions', max: 1200,
    help: 'One condition per line. Leave blank to drop the terms block.' },

  // ── Blocks ──
  { key: 'showLogo', type: 'toggle', group: 'Blocks', label: 'Hotel logo' },
  { key: 'showWatermark', type: 'toggle', group: 'Blocks', label: 'Logo watermark',
    help: 'A faint centred mark behind the charges.' },
  { key: 'showGstAnnexure', type: 'toggle', group: 'Blocks', label: 'Per-line GST annexure' },
  { key: 'showAmountInWords', type: 'toggle', group: 'Blocks', label: 'Amount in words' },
  { key: 'showPayment', type: 'toggle', group: 'Blocks', label: 'Payment details' },
  { key: 'showTerms', type: 'toggle', group: 'Blocks', label: 'Terms & conditions' },
  { key: 'showSignatures', type: 'toggle', group: 'Blocks', label: 'Signature lines' },

  // ── Motion ──
  { key: 'animation', type: 'select', group: 'Motion', label: 'Background animation',
    options: [
      { value: 'full', label: 'On' },
      { value: 'subtle', label: 'Subtle' },
      { value: 'off', label: 'Off' },
    ],
    help: 'Plays on screen. Print and PDF always freeze it to a still background.' },
  { key: 'animationSpeed', type: 'number', group: 'Motion', label: 'Cycle length (seconds)',
    min: 6, max: 60, step: 1, help: 'Higher is slower and calmer.' },
  { key: 'backgroundIntensity', type: 'number', group: 'Motion', label: 'Background strength',
    min: 0, max: 100, step: 5, help: '0 hides the artwork entirely.' },

  // ── Layout ──
  { key: 'logoHeight', type: 'number', group: 'Layout', label: 'Logo height (px)', min: 24, max: 110, step: 2 },
  { key: 'fontScale', type: 'number', group: 'Layout', label: 'Text size (%)', min: 88, max: 115, step: 1 },
  { key: 'cornerRadius', type: 'number', group: 'Layout', label: 'Corner rounding (px)', min: 0, max: 28, step: 1 },
];

const FIELD_BY_KEY = new Map(THEME_FIELDS.map((f) => [f.key, f]));

// Applied under every template's own defaults, so a template only declares what
// makes it distinctive and still gets a complete, valid theme.
export const BASE_THEME = {
  accent: '#8e6f3f',
  accentAlt: '#2f4858',
  ink: '#1d2126',
  muted: '#6f7782',
  sheet: '#ffffff',
  backdrop: '#f4f6f8',
  headerInk: '#ffffff',

  docTitle: 'Tax Invoice',
  tagline: '',
  billedToLabel: 'Billed To',
  stayLabel: 'Stay Details',
  thankYou: 'Thank you for staying with us — we look forward to welcoming you again.',
  footerNote: 'This is a computer-generated invoice and is valid without a physical signature.',
  guestSignatureLabel: 'Guest Signature',
  signatoryLabel: 'Authorised Signatory',
  terms: [
    'GST is charged as applicable to hotel accommodation and allied services.',
    'Check-out time is 12:00 noon. Late check-out is subject to availability and additional charges.',
    'Any discrepancy in this invoice must be reported to the front desk within 7 days of the invoice date.',
    'All disputes are subject to the jurisdiction of Munger, Bihar.',
  ].join('\n'),

  showLogo: true,
  showWatermark: true,
  showGstAnnexure: true,
  showAmountInWords: true,
  showPayment: true,
  showTerms: true,
  showSignatures: true,

  animation: 'full',
  animationSpeed: 18,
  backgroundIntensity: 60,

  logoHeight: 52,
  fontScale: 100,
  cornerRadius: 14,
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// One field's value, or undefined when it is missing or unusable. Returning
// undefined (rather than the default) lets the caller layer template defaults
// under a partial saved object without a bad value punching through.
const coerce = (field, value) => {
  if (value === undefined || value === null) return undefined;
  switch (field.type) {
    case 'color': {
      const v = String(value).trim();
      return HEX.test(v) ? v.toLowerCase() : undefined;
    }
    case 'text':
    case 'multiline': {
      // Control characters would survive HTML escaping and corrupt the markup
      // around them; newlines are kept for multiline fields only.
      const keepNewlines = field.type === 'multiline';
      const cleaned = String(value)
        .replace(keepNewlines ? /[^\S\n]+/g : /\s+/g, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
        .slice(0, field.max || 200);
      return keepNewlines ? cleaned.replace(/\n{3,}/g, '\n\n').trim() : cleaned.trim();
    }
    case 'toggle':
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 1 || value === '1') return true;
      if (value === 'false' || value === 0 || value === '0') return false;
      return undefined;
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? clamp(n, field.min, field.max) : undefined;
    }
    case 'select': {
      const v = String(value);
      return field.options.some((o) => o.value === v) ? v : undefined;
    }
    default:
      return undefined;
  }
};

/**
 * Strip an incoming customization down to known, valid fields.
 * Unknown keys and unusable values are dropped, never stored.
 */
export const sanitizeTheme = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(input)) {
    const field = FIELD_BY_KEY.get(key);
    if (!field) continue;
    const value = coerce(field, raw);
    if (value !== undefined) out[key] = value;
  }
  return out;
};

/**
 * Resolve the theme a template renders with: base defaults, the template's own
 * defaults over them, then the admin's saved (or previewed) customization.
 */
export const resolveTheme = (templateDefaults = {}, saved = {}) => ({
  ...BASE_THEME,
  ...sanitizeTheme(templateDefaults),
  ...sanitizeTheme(saved),
});

/** The editable surface plus a template's defaults — what the settings UI needs. */
export const themeSchema = (templateDefaults = {}) => ({
  fields: THEME_FIELDS,
  defaults: resolveTheme(templateDefaults, {}),
});

// ── Render helpers shared by the animated templates ─────────────────────────

/**
 * "r, g, b" channels for a validated hex colour, so templates can write
 * rgba(var(--accent-rgb), 0.12) for tints.
 *
 * color-mix() would be terser, but an engine that does not support it drops the
 * whole declaration — a hairline border silently disappears rather than falling
 * back. Channel variables render identically everywhere.
 */
export const hexChannels = (hex) => {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('');
  h = h.slice(0, 6).padEnd(6, '0');
  const int = parseInt(h, 16);
  if (!Number.isFinite(int)) return '0, 0, 0';
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
};


/** Opacity for the artwork layer, folding intensity and the "subtle" mode together. */
const artOpacity = (theme) => {
  const base = clamp(Number(theme.backgroundIntensity) || 0, 0, 100) / 100;
  const scaled = theme.animation === 'subtle' ? base * 0.55 : base;
  return Math.round(scaled * 1000) / 1000;
};

/**
 * The custom properties every animated template's CSS is written against.
 * Colours are pre-validated hex, numbers are clamped — safe to interpolate.
 */
export const themeVars = (theme) => `
    --ink: ${theme.ink};
    --muted: ${theme.muted};
    --accent: ${theme.accent};
    --accent-alt: ${theme.accentAlt};
    --ink-rgb: ${hexChannels(theme.ink)};
    --muted-rgb: ${hexChannels(theme.muted)};
    --accent-rgb: ${hexChannels(theme.accent)};
    --accent-alt-rgb: ${hexChannels(theme.accentAlt)};
    --header-ink-rgb: ${hexChannels(theme.headerInk)};
    --sheet: ${theme.sheet};
    --backdrop: ${theme.backdrop};
    --header-ink: ${theme.headerInk};
    --radius: ${theme.cornerRadius}px;
    --logo-h: ${theme.logoHeight}px;
    --art-opacity: ${artOpacity(theme)};
    --cycle: ${theme.animationSpeed}s;`;

/**
 * An animation shorthand, or `none` when motion is switched off. Templates read
 * as normal CSS and the off state costs nothing at render time.
 */
export const motion = (theme, shorthand) => (theme.animation === 'off' ? 'none' : shorthand);

/**
 * Scaffolding every animated template shares: the type ramp, the sheet, the
 * artwork layer, and — the part that matters most — the print discipline.
 *
 * Print freezes every animation and drops the backdrop to white. A moving
 * gradient is a screen flourish; a tax invoice that reaches a guest or an
 * auditor must be a still, legible, ink-cheap document.
 */
export const baseCss = (theme) => `
  :root {${themeVars(theme)}
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    color: var(--ink);
    background: var(--backdrop);
    font-size: ${(12 * (Number(theme.fontScale) || 100)) / 100}px;
    /* Tight enough that a single-night stay still prints on ONE A4 sheet. The
       fit script refuses to scale below 85% (a uniform scale also narrows the
       sheet and wastes its width), so the document has to arrive close to the
       budget rather than relying on being shrunk into it. */
    line-height: 1.42;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    max-width: 820px;
    margin: 0 auto;
    padding: 14px 18px 16px;
    overflow: hidden;
  }
  /* The moving artwork. Always behind the sheet, never in the text's way.
     It clips itself rather than relying on .page's overflow: print relaxes that
     so a long invoice can paginate without its content being cut, and an
     unclipped blob then smears past the footer onto the printed sheet. */
  .art {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    opacity: var(--art-opacity);
    pointer-events: none;
  }
  .sheet {
    position: relative;
    z-index: 1;
    background: var(--sheet);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: 0 18px 50px -28px rgba(15, 23, 42, 0.45), 0 2px 8px -4px rgba(15, 23, 42, 0.12);
  }
  .wm {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(58%, 380px);
    opacity: 0.045;
    z-index: 0;
    pointer-events: none;
    filter: grayscale(1);
  }
  .wm-text {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-24deg);
    font-size: 108px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--accent);
    opacity: 0.05;
    z-index: 0;
    pointer-events: none;
    white-space: nowrap;
  }
  .r { text-align: right; }
  .c { text-align: center; }
  .num { font-variant-numeric: tabular-nums; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }

  @media print {
    /* A printed invoice is a still document: no motion, no heavy backdrop. */
    *, *::before, *::after { animation: none !important; transition: none !important; }
    body { background: #ffffff; }
    .page { max-width: none; padding: 0; overflow: visible; }
    .art { opacity: calc(var(--art-opacity) * 0.5); }
    .sheet { box-shadow: none; border-radius: 0; }
    .no-print { display: none !important; }
  }`;

/** Two-letter mark from the hotel's name, for when no logo is configured. */
export const monogram = (name) => {
  const words = String(name || 'Hotel').trim().split(/\s+/).filter(Boolean);
  const letters = words.length === 1
    ? words[0].slice(0, 2)
    : words.slice(0, 2).map((w) => w[0]).join('');
  return letters.toUpperCase() || 'HS';
};

/**
 * The hotel's logo, or a typeset monogram when none is set, so the masthead
 * never renders as an empty gap.
 */
export const brandMark = (ctx, theme, { className = 'brand-mark', markClass = 'brand-mono' } = {}) => {
  if (!theme.showLogo) return '';
  if (ctx.hotel.logo) {
    return `<img class="${className}" src="${e(ctx.hotel.logo)}" alt="${e(ctx.hotel.name)}" />`;
  }
  return `<div class="${markClass}">${e(monogram(ctx.hotel.name))}</div>`;
};

/** The faint centred watermark — the logo if there is one, else the monogram. */
export const watermark = (ctx, theme) => {
  if (!theme.showWatermark) return '';
  return ctx.hotel.logo
    ? `<img class="wm" src="${e(ctx.hotel.logo)}" alt="" aria-hidden="true" />`
    : `<div class="wm-text" aria-hidden="true">${e(monogram(ctx.hotel.name))}</div>`;
};

/**
 * GST percentages read back from the computed totals rather than hardcoded.
 *
 * Both rates are configurable per hotel (billing settings), and a stay that
 * mixes room nights with restaurant charges blends them — so a template that
 * prints a literal "CGST @ 2.5%" is stating a rate it did not actually charge.
 * Deriving it from the numbers on the invoice keeps the label honest.
 */
export const taxLabels = (ctx) => {
  const taxable = Number(ctx.totals.subtotal) || 0;
  const cgst = Number(ctx.totals.cgst) || 0;
  const sgst = Number(ctx.totals.sgst) || 0;
  if (!taxable) return { half: null, full: null, halfLabel: 'CGST', fullLabel: 'GST' };
  const round1 = (n) => Math.round(n * 10) / 10;
  const half = round1((cgst / taxable) * 100);
  const full = round1(((cgst + sgst) / taxable) * 100);
  return {
    half,
    full,
    halfLabel: `@ ${half}%`,
    fullLabel: `${full}% GST`,
  };
};

/** Terms as escaped <li> items, or '' when the block is off or empty. */
export const termsItems = (theme) => {
  if (!theme.showTerms) return '';
  const lines = String(theme.terms || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return lines.map((l) => `<li>${e(l)}</li>`).join('');
};

export const STATUS_LABEL = { paid: 'Paid', partial: 'Part Paid', unpaid: 'Balance Due' };
