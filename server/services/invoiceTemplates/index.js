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
import { normalizeInvoiceContext } from './normalize.js';

// The decorative set (fiscal, luxe, atelier, aurora, mono, ledger, quiet,
// formal) was replaced by the detailed house set below: Hotel Standard plus
// six professional variants, all with the full 5% GST treatment.
const TEMPLATES = [
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
  TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));

export const getTemplate = (id) =>
  TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === DEFAULT_TEMPLATE_ID);

// Injected into every rendered invoice so it always prints on a single A4 sheet.
// A plain CSS transform does not change pagination height, so we wrap the body's
// content, scale it down when it would overflow, and collapse the wrapper's
// layout box to the scaled height. Runs on load and again once fonts settle.
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
      while (b.firstChild) { inner.appendChild(b.firstChild); }
      outer.appendChild(inner); b.appendChild(outer);
    }
    var inner = document.getElementById('__invFitInner');
    inner.style.transform = 'none'; outer.style.height = ''; outer.style.overflow = 'visible';
    var available = 1015; // printable px for A4 (96dpi) at default print margins
    var h = inner.scrollHeight;
    if (h > available) {
      var s = available / h;
      inner.style.transformOrigin = 'top center';
      inner.style.transform = 'scale(' + s + ')';
      outer.style.height = Math.floor(h * s) + 'px';
      outer.style.overflow = 'hidden';
    }
  }
  function run() { try { fit(); } catch (e) {} }
  if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
})();
<\/script>`;

export const renderInvoice = async ({ booking, hotel, type, templateId, payment = null }) => {
  const template = getTemplate(templateId);
  const context = normalizeInvoiceContext({ booking, hotel, type, payment });
  const html = await template.render(context, { booking, hotel, type });
  if (typeof html === 'string' && html.includes('</body>')) {
    return html.replace('</body>', `${FIT_TO_PAGE_SNIPPET}</body>`);
  }
  return typeof html === 'string' ? html + FIT_TO_PAGE_SNIPPET : html;
};

export { normalizeInvoiceContext };
