// Registry for the banquet-only invoice / quotation templates. These are
// distinct from the room-invoice set (index.js) and are selected separately in
// Settings → Invoice templates. One selected template renders BOTH the banquet
// quotation and the banquet invoice (the docType flag switches the copy/layout).
import { meta as auroraMeta, render as renderAurora } from './banquet/aurora.js';
import { meta as noirMeta, render as renderNoir } from './banquet/noir.js';
import { meta as blushMeta, render as renderBlush } from './banquet/blush.js';
import { meta as emeraldMeta, render as renderEmerald } from './banquet/emerald.js';
import { meta as sapphireMeta, render as renderSapphire } from './banquet/sapphire.js';
import { meta as marigoldMeta, render as renderMarigold } from './banquet/marigold.js';
import { normalizeInvoiceContext } from './normalize.js';

const BANQUET_TEMPLATES = [
  { ...auroraMeta, render: renderAurora },
  { ...noirMeta, render: renderNoir },
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

// Render a banquet document. docType is 'invoice' or 'quotation'. The templates
// own their own A4-fill print CSS, so no fit-to-page script is injected here.
export const renderBanquetDocument = async ({ booking, hotel, templateId, docType = 'invoice' }) => {
  const template = getBanquetTemplate(templateId);
  const context = normalizeInvoiceContext({ booking, hotel, type: 'banquet' });
  return template.render(context, { docType });
};
