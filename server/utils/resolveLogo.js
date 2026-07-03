import Image from '../models/Image.js';

// Turn a stored logo reference into something that renders inside a detached
// print window (which has no server origin to resolve relative URLs against):
//   • data: URIs and absolute http(s) URLs pass through unchanged
//   • an "/api/images/<id>" reference is loaded from Mongo and inlined as a
//     base64 data URI so it always renders
//   • anything else is returned as-is
export const resolveLogo = async (ref) => {
  if (!ref || typeof ref !== 'string') return '';
  if (ref.startsWith('data:') || ref.startsWith('http://') || ref.startsWith('https://')) {
    return ref;
  }
  const match = ref.match(/\/images\/([0-9a-fA-F]{24})/);
  if (match) {
    try {
      const img = await Image.findById(match[1]);
      if (img?.data) {
        const buf = Buffer.isBuffer(img.data) ? img.data : Buffer.from(img.data.buffer || img.data);
        return `data:${img.contentType || 'image/png'};base64,${buf.toString('base64')}`;
      }
    } catch {
      /* fall through to returning the original ref */
    }
  }
  return ref;
};
