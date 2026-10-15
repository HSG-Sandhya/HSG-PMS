import { meta as classicMeta, render as renderClassic } from './classic.js';
import { meta as modernMeta, render as renderModern } from './modern.js';
import { meta as executiveMeta, render as renderExecutive } from './executive.js';
import { meta as elegantMeta, render as renderElegant } from './elegant.js';
import { meta as compactMeta, render as renderCompact } from './compact.js';
import { meta as heritageMeta, render as renderHeritage } from './heritage.js';
import { meta as hotelStandardMeta, render as renderHotelStandard } from './hotelStandard.js';
import { meta as royalCrestMeta, render as renderRoyalCrest } from './royalCrest.js';
import { meta as corporateSlateMeta, render as renderCorporateSlate } from './corporateSlate.js';
import { meta as summitProMeta, render as renderSummitPro } from './summitPro.js';
import { meta as monogramMeta, render as renderMonogram } from './monogram.js';
import { meta as complianceGridMeta, render as renderComplianceGrid } from './complianceGrid.js';
import { meta as folioStatementMeta, render as renderFolioStatement } from './folioStatement.js';
import { meta as auroraLuxeMeta, render as renderAuroraLuxe } from './auroraLuxe.js';
import { meta as silkRibbonMeta, render as renderSilkRibbon } from './silkRibbon.js';
import { meta as marbleShimmerMeta, render as renderMarbleShimmer } from './marbleShimmer.js';
import { meta as prismMotionMeta, render as renderPrismMotion } from './prismMotion.js';
import { normalizeInvoiceContext } from './normalize.js';
import { getBilling } from '../../config/operationalConfig.js';
import { resolveTheme, themeSchema } from './theme.js';
import { renderFoodBillSection } from './foodBillSection.js';
import Settings from '../../models/Settings.js';

// The decorative set (fiscal, luxe, atelier, aurora, mono, ledger, quiet,
// formal) was replaced by the detailed house set below: Hotel Standard plus
// six professional variants, all with the full 5% GST treatment.
//
// The four animated designs lead the list: their background artwork moves on
// screen and freezes to a still, light background in print (see theme.js), and
// every colour, label, block and the motion itself is editable per template
// from Settings → Invoice templates.
const TEMPLATES = [
  { ...auroraLuxeMeta, render: renderAuroraLuxe },
  { ...silkRibbonMeta, render: renderSilkRibbon },
  { ...marbleShimmerMeta, render: renderMarbleShimmer },
  { ...prismMotionMeta, render: renderPrismMotion },
  { ...hotelStandardMeta, render: renderHotelStandard },
  { ...royalCrestMeta, render: renderRoyalCrest },
  { ...corporateSlateMeta, render: renderCorporateSlate },
  { ...summitProMeta, render: renderSummitPro },
  { ...monogramMeta, render: renderMonogram },
  { ...complianceGridMeta, render: renderComplianceGrid },
  { ...folioStatementMeta, render: renderFolioStatement },
  { ...classicMeta, render: renderClassic },
  { ...modernMeta, render: renderModern },
  { ...executiveMeta, render: renderExecutive },
  { ...elegantMeta, render: renderElegant },
  { ...compactMeta, render: renderCompact },
  { ...heritageMeta, render: renderHeritage },
];

// Also the fallback for any previously-saved selection of a removed template.
export const DEFAULT_TEMPLATE_ID = 'hotel-standard';

export const getTemplateList = () =>
  TEMPLATES.map(({ id, name, description, customizable }) => ({
    id, name, description, customizable: Boolean(customizable),
  }));

export const getTemplate = (id) =>
  TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);

/**
 * The editable surface for one template — the field descriptors the settings UI
 * builds its controls from, plus that template's own defaults. Null for the
 * older designs, which carry no theme and render fixed.
 */
export const getTemplateTheme = (id) => {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template || !template.customizable) return null;
  return { id: template.id, name: template.name, ...themeSchema(template.theme) };
};

/**
 * The hotel's ONE house styling, applied to every themed template.
 *
 * Styling used to be stored per template, which meant an admin who wanted their
 * brand colour on invoices had to set it again on each design. It is now a
 * single object of OVERRIDES: a field the admin has set wins everywhere, and a
 * field they have left alone falls back to each design's own default, so the
 * four designs keep their distinct character until a colour is deliberately
 * changed.
 *
 * Read fresh for each render. Invoices are generated a handful of times an
 * hour, so this does not want the TTL cache the booking hot paths use — and a
 * colour the admin just saved should show on the very next invoice, not up to
 * fifteen seconds later.
 */
export const getStoredInvoiceTheme = async () => {
  try {
    const doc = await Settings.findOne(
      {},
      { 'invoice.templateTheme': 1, 'invoice.templateCustomization': 1, 'invoice.template': 1 },
    ).lean();
    const invoice = doc?.invoice || {};
    if (invoice.templateTheme && typeof invoice.templateTheme === 'object') {
      return invoice.templateTheme;
    }
    // Carry over the short-lived per-template storage that preceded the house
    // theme, so styling saved under the old scheme is not silently lost. The
    // selected template's entry is the one that was actually being printed.
    const perTemplate = invoice.templateCustomization;
    if (perTemplate && typeof perTemplate === 'object') {
      return perTemplate[invoice.template] || Object.values(perTemplate)[0] || {};
    }
    return {};
  } catch {
    return {}; // a settings read failure must not cost the guest their invoice
  }
};

// Injected into every rendered invoice to keep it on a single A4 sheet WHEN a
// gentle scale-down (>= 85%) is enough. A plain CSS transform does not change
// pagination height, so we wrap the body's content, scale it down when it would
// overflow, and collapse the wrapper's layout box to the scaled height. When the
// content is so long that fitting it would shrink the invoice below 85% (which
// also narrows it and wastes the sheet's width), we skip scaling entirely and let
// it flow full-width across multiple sheets. Runs on load and again once fonts settle.
// Templates set no @page, so Chrome's default print margins apply (~12.7mm); a
// slightly conservative printable height keeps it on one sheet at those margins.
const FIT_TO_PAGE_SNIPPET = `
<script>
(function () {
  function fit() {
    var b = document.body; if (!b) return;
    var outer = document.getElementById('__invFitOuter');
    if (!outer) {
      outer = document.createElement('div'); outer.id = '__invFitOuter';
      var inner = document.createElement('div'); inner.id = '__invFitInner';
      // Anything marked data-fit-exempt prints on its own sheet (the food bill)
      // and stays OUT of the scaled wrapper. The fit is for the stay invoice
      // alone; sweeping a second document in would shrink both to share a page.
      var aside = [];
      while (b.firstChild) {
        var node = b.firstChild; b.removeChild(node);
        if (node.nodeType === 1 && node.hasAttribute('data-fit-exempt')) aside.push(node);
        else inner.appendChild(node);
      }
      outer.appendChild(inner); b.appendChild(outer);
      for (var k = 0; k < aside.length; k++) { b.appendChild(aside[k]); }
    }
    var inner = document.getElementById('__invFitInner');
    inner.style.transform = 'none'; outer.style.height = ''; outer.style.overflow = 'visible';
    var available = 1015; // printable px for A4 (96dpi) at default print margins
    var minScale = 0.82;  // never shrink below this: scale() is uniform, so a
                          // heavier shrink also narrows the invoice and wastes the
                          // sheet's width. Longer invoices flow onto a 2nd sheet.
                          // Was 0.85, which sent an ordinary stay (a late-checkout
                          // charge, a company on the bill) onto a second sheet that
                          // carried only the signatures. A slightly narrower single
                          // sheet beats a nearly empty second one.
    var h = inner.scrollHeight;
    if (h > available) {
      var s = available / h;
      if (s >= minScale) {
        inner.style.transformOrigin = 'top center';
        inner.style.transform = 'scale(' + s + ')';
        outer.style.height = Math.floor(h * s) + 'px';
        outer.style.overflow = 'hidden';
      }
      // else: too tall to fit one sheet without over-shrinking — keep it at full
      // width and let the browser paginate across pages.
    }
  }
  function run() { try { fit(); } catch (e) {} }
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
})();
<\/script>`;

/**
 * Render an invoice.
 *
 * `customization` overrides what is saved in Settings — the settings screen
 * passes the unsaved form values so an admin can preview a colour before
 * committing it. Omit it and the hotel's saved house styling is used.
 */
export const renderInvoice = async ({
  booking, hotel, type, templateId, payment = null, customization = null,
}) => {
  const template = getTemplate(templateId);
  const context = normalizeInvoiceContext({ booking, hotel, type, payment, billing: await getBilling() });
  if (template.customizable) {
    const saved = customization || await getStoredInvoiceTheme();
    // resolveTheme sanitizes: an unusable colour or an out-of-range number falls
    // back to the template's default rather than reaching the stylesheet.
    context.theme = resolveTheme(template.theme, saved);
  }
  const html = await template.render(context, { booking, hotel, type });

  // Food is a document of its own, appended after whichever design was chosen
  // so every template gets the separate bill without each having to author it.
  // Empty string when nothing was eaten, so a room-only stay prints one sheet.
  const tail = `${renderFoodBillSection(context, context.theme || null)}${FIT_TO_PAGE_SNIPPET}`;
  if (typeof html === 'string' && html.includes('</body>')) {
    return html.replace('</body>', `${tail}</body>`);
  }
  return typeof html === 'string' ? html + tail : html;
};

export { normalizeInvoiceContext };
