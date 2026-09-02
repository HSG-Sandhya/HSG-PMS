import Image from '../models/Image.js';
import Settings from '../models/Settings.js';
import { CONTENT_TYPE_BY_EXT } from '../utils/fileSignature.js';
import { optimizeImage } from '../utils/imageOptimizer.js';

/**
 * Settings fields that hold an image reference, as '/api/images/<id>'.
 *
 * An image id is rendered on the public site and the sign-in screen, so
 * deleting one that is still referenced breaks something a guest can see. The
 * check is a courtesy, not a lock: `?force=true` deletes anyway, for the case
 * where replacing the reference is the whole point.
 */
const IMAGE_REFERENCE_PATHS = [
  ['theme', 'backgroundImage'],
  ['hotelProfile', 'logo'],
  ['branding', 'logoUrl'],
  ['hotelProfile', 'signatureUrl'],
];

const readPath = (obj, parts) =>
  parts.reduce((cur, part) => (cur && typeof cur === 'object' ? cur[part] : undefined), obj);

const settingsReferencing = async (imageId) => {
  let doc = null;
  try {
    doc = await Settings.findOne({}).lean();
  } catch {
    return []; // a database hiccup must not block a legitimate delete
  }
  const id = String(imageId);
  return IMAGE_REFERENCE_PATHS
    .filter((parts) => String(readPath(doc, parts) || '').includes(id))
    .map((parts) => parts.join('.'));
};

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // verifyUploadedBuffers has read the real leading bytes and put the type it
    // found on the file. Use THAT, never the client's claim — a GIF-headed
    // polyglot is inert when served as image/gif, and dangerous when served as
    // whatever the uploader said it was.
    const safeType = req.file.safeContentType || 'application/octet-stream';
    const optimized = await optimizeImage(req.file.buffer, { contentType: safeType });

    const image = new Image({
      data: optimized.buffer,
      contentType: optimized.contentType,
      filename: req.file.originalname,
      size: optimized.size,
      category: req.body?.category || 'other',
      uploadedBy: req.user?.id || null,
    });

    await image.save();

    res.status(201).json({
      id: image._id,
      url: `/api/images/${image._id}`,
      contentType: image.contentType,
      size: image.size,
    });
  } catch (error) {
    console.error('Image upload error:', error.message);
    res.status(500).json({ message: 'Failed to upload image' });
  }
};

export const listImages = async (req, res) => {
  try {
    const { category } = req.query;
    const query = category ? { category } : {};
    // Skip the binary blob — only return metadata. Newest first.
    const images = await Image.find(query)
      .select('_id category filename size contentType createdAt')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(
      images.map((img) => ({
        id: img._id,
        url: `/api/images/${img._id}`,
        filename: img.filename,
        size: img.size,
        contentType: img.contentType,
        category: img.category,
        createdAt: img.createdAt,
      })),
    );
  } catch (error) {
    console.error('Image list error:', error.message);
    res.status(500).json({ message: 'Failed to list images' });
  }
};

export const getImage = async (req, res) => {
  try {
    // Avoid .lean() — with it, BSON Binary fields come back as `Binary`
    // instances whose `.length` is not a valid Number for Content-Length,
    // which makes Node reject the header. Mongoose conversion gives a real
    // Node Buffer.
    const image = await Image.findById(req.params.id).select('data contentType');

    // The global request-timeout middleware may have already answered with 503
    // while this query was queued/running. Writing now throws ERR_HTTP_HEADERS_SENT
    // ("Cannot set headers after they are sent"), so bail out quietly.
    if (res.headersSent || req.timedout) return;

    if (!image || !image.data) {
      return res.status(404).end();
    }

    const buffer = Buffer.isBuffer(image.data)
      ? image.data
      : Buffer.from(image.data.buffer || image.data);

    // Serve only a type from the known-safe list. Stored types are written by
    // the upload path from verified bytes, but this endpoint is public and
    // predates that check, so anything unrecognised — including an
    // image/svg+xml left by an older upload — is served as an opaque download
    // rather than as active content in our own origin.
    const SAFE = new Set(Object.values(CONTENT_TYPE_BY_EXT));
    const stored = image.contentType || '';
    res.set('Content-Type', SAFE.has(stored) ? stored : 'application/octet-stream');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    // Let Express set Content-Length from the buffer it's actually sending.
    res.send(buffer);
  } catch (error) {
    console.error('Image fetch error:', error.message);
    if (res.headersSent || req.timedout) return;
    res.status(404).end();
  }
};

export const deleteImage = async (req, res) => {
  try {
    const force = String(req.query.force || '').toLowerCase() === 'true';

    if (!force) {
      const used = await settingsReferencing(req.params.id);
      if (used.length) {
        return res.status(409).json({
          message:
            'This image is still in use and deleting it would break how the site renders. ' +
            'Point the setting at a different image first, or repeat with ?force=true.',
          referencedBy: used,
        });
      }
    }

    const image = await Image.findByIdAndDelete(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    res.json({ message: 'Image deleted' });
  } catch (error) {
    console.error('Image delete error:', error.message);
    res.status(500).json({ message: 'Failed to delete image' });
  }
};
