import Image from '../models/Image.js';
import { optimizeImage } from '../utils/imageOptimizer.js';

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const isImage = req.file.mimetype?.startsWith('image/');
    const optimized = isImage
      ? await optimizeImage(req.file.buffer, { contentType: req.file.mimetype })
      : { buffer: req.file.buffer, contentType: req.file.mimetype, size: req.file.size };

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
    if (!image || !image.data) {
      return res.status(404).end();
    }

    const buffer = Buffer.isBuffer(image.data)
      ? image.data
      : Buffer.from(image.data.buffer || image.data);

    res.set('Content-Type', image.contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    // Let Express set Content-Length from the buffer it's actually sending.
    res.send(buffer);
  } catch (error) {
    console.error('Image fetch error:', error.message);
    res.status(404).end();
  }
};

export const deleteImage = async (req, res) => {
  try {
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
