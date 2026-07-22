// Registry for the banquet-only invoice / quotation templates. These are
// distinct from the room-invoice set (index.js) and are selected separately in
// Settings → Invoice templates. One selected template renders BOTH the banquet
// quotation and the banquet invoice (the docType flag switches the copy/layout).
import { meta as auroraMeta, render as renderAurora } from './banquet/aurora.js';
import { meta as royalMeta, render as renderRoyal } from './banquet/royal.js';
import { meta as blushMeta, render as renderBlush } from './banquet/blush.js';
import { meta as emeraldMeta, render as renderEmerald } from './banquet/emerald.js';
import { meta as sapphireMeta, render as renderSapphire } from './banquet/sapphire.js';
import { meta as marigoldMeta, render as renderMarigold } from './banquet/marigold.js';
import { meta as corporateMeta, render as renderCorporate } from './banquet/corporate.js';
import QRCode from 'qrcode';
import { normalizeInvoiceContext } from './normalize.js';
import { getOps } from '../../config/operationalConfig.js';

// Build the UPI "scan & pay" QR for the invoice. Encodes a standard UPI intent
// link (payee VPA + name, INR, the balance as the amount, invoice no. as the
// note) so any UPI app opens pre-filled. Returns the bank details plus an inline
// SVG QR, or just the bank details when there is no UPI id / generation fails.
const buildPaymentContext = async (bankAccount, ctx) => {
  if (!bankAccount || (!bankAccount.accountNumber && !bankAccount.upiId)) return null;
  const payment = { ...bankAccount, qrSvg: '', upiLink: '' };
  if (bankAccount.upiId) {
    const enc = encodeURIComponent;
    const amt = Number(ctx.totals?.balance) > 0 ? Math.round(Number(ctx.totals.balance)) : 0;
    // The VPA (pa) is left raw — UPI scanners expect the literal "name@bank";
    // %40 works in most apps but the raw @ is the most compatible. The payee
    // name and note DO need encoding (spaces, & in the hotel name).
    const vpa = String(bankAccount.upiId).trim();
    let link = `upi://pay?pa=${vpa}&pn=${enc(ctx.hotel?.name || 'Hotel')}&cu=INR`;
    if (amt > 0) link += `&am=${amt}`;
    if (ctx.invoice?.number) link += `&tn=${enc(ctx.invoice.number)}`;
    payment.upiLink = link;
    try {
      const svg = await QRCode.toString(link, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
      // Force a fixed print size; the viewBox keeps the modules crisp.
      payment.qrSvg = svg.replace('<svg ', '<svg style="width:104px;height:104px;display:block" ');
    } catch {
      payment.qrSvg = '';
    }
  }
  return payment;
};

const BANQUET_TEMPLATES = [
  { ...corporateMeta, render: renderCorporate },
  { ...auroraMeta, render: renderAurora },
  { ...royalMeta, render: renderRoyal },
  { ...blushMeta, render: renderBlush },
  { ...emeraldMeta, render: renderEmerald },
  { ...sapphireMeta, render: renderSapphire },
  { ...marigoldMeta, render: renderMarigold },
];

export const DEFAULT_BANQUET_TEMPLATE_ID = 'aurora';

export const getBanquetTemplateList = () =>
  BANQUET_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));

export const getBanquetTemplate = (id) =>
  BANQUET_TEMPLATES.find((t) => t.id === id)
  || BANQUET_TEMPLATES.find((t) => t.id === DEFAULT_BANQUET_TEMPLATE_ID);

// A "shrink to one page" script appended to every banquet document. The
// templates are laid out for a single A4 sheet, but a booking with many line
// items (a full wedding: venue + décor + catering + several facilities) can run
// past the page. Rather than clip or spill onto a second sheet, this measures
// the rendered sheet and, only when it is too tall, scales it down uniformly so
// everything stays on ONE page. Light invoices are left untouched (scale 1).
//   • It neutralises the print `min-height:100vh` so the true content height is
//     measured, then wraps the sheet in a box whose height is the scaled height
//     (a CSS transform alone would not shrink the space the page reserves).
//   • Runs on load and again once fonts settle, before the browser prints.
const FIT_TO_PAGE_SCRIPT = `<script>
(function(){
  function fit(){
    var pg=document.querySelector('.page');
    if(!pg||pg.getAttribute('data-fitted'))return;
    pg.style.minHeight='0';document.body.style.margin='0';
    var outer=document.createElement('div');outer.style.overflow='hidden';
    var inner=document.createElement('div');inner.style.transformOrigin='top left';
    pg.parentNode.insertBefore(outer,pg);inner.appendChild(pg);outer.appendChild(inner);
    pg.setAttribute('data-fitted','1');
    var AVAIL=1035; // A4 printable height (~279mm at 96dpi), with a safety margin
    var h=inner.scrollHeight;
    if(h>AVAIL){var s=AVAIL/h;inner.style.transform='scale('+s+')';outer.style.height=Math.floor(h*s)+'px';}
  }
  function run(){try{fit();}catch(e){}}
  if(document.readyState==='complete')run();else window.addEventListener('load',run);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(run);
})();
</script>`;

// Render a banquet document. docType is 'invoice' or 'quotation'.
export const renderBanquetDocument = async ({ booking, hotel, templateId, docType = 'invoice', bankAccount = null }) => {
  const template = getBanquetTemplate(templateId);
  const context = normalizeInvoiceContext({ booking, hotel, type: 'banquet' });
  // Surface the configurable banquet rules (advance %, quotation validity) so
  // the quotation reflects Settings → Operations instead of hardcoded values.
  try {
    context.banquet = (await getOps()).banquet;
  } catch {
    context.banquet = undefined; // templates fall back to their built-in defaults
  }
  // Bank + UPI QR for the "Payment Details" block (from Accounting). Kept on a
  // dedicated `bank` key so it never collides with normalize's `payment`
  // (which carries the payment-method, not the payee account).
  context.bank = await buildPaymentContext(bankAccount, context);
  const html = template.render(context, { docType });
  return html.includes('</body>')
    ? html.replace('</body>', `${FIT_TO_PAGE_SCRIPT}</body>`)
    : html + FIT_TO_PAGE_SCRIPT;
};
