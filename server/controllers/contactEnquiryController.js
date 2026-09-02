/**
 * Reading and working through public contact enquiries.
 *
 * The form now stores what people send; this is how reception gets at it. The
 * promise on the website is "we will get back to you soon", which needs a list
 * someone can actually work down.
 */
import ContactEnquiry from '../models/ContactEnquiry.js';

const STATUSES = ['new', 'in_progress', 'closed'];

// GET /api/contact-enquiries?status=&page=&limit=
export const listEnquiries = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const query = {};
    if (STATUSES.includes(req.query.status)) query.status = req.query.status;

    const [items, total, newCount] = await Promise.all([
      ContactEnquiry.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('handledBy', 'firstName lastName username')
        .lean(),
      ContactEnquiry.countDocuments(query),
      ContactEnquiry.countDocuments({ status: 'new' }),
    ]);

    res.json({ success: true, data: items, total, page, limit, newCount });
  } catch (error) {
    console.error('Error listing contact enquiries:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load enquiries' });
  }
};

// GET /api/contact-enquiries/:id
export const getEnquiry = async (req, res) => {
  try {
    const item = await ContactEnquiry.findById(req.params.id)
      .populate('handledBy', 'firstName lastName username')
      .lean();
    if (!item) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error fetching contact enquiry:', error.message);
    res.status(500).json({ success: false, message: 'Failed to load enquiry' });
  }
};

// PATCH /api/contact-enquiries/:id  { status?, notes? }
export const updateEnquiry = async (req, res) => {
  try {
    const update = {};
    if (req.body?.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${STATUSES.join(', ')}`,
        });
      }
      update.status = req.body.status;
      // Record who picked it up the first time it leaves "new".
      if (req.body.status !== 'new') update.handledBy = req.user?.id || req.user?._id || null;
    }
    if (req.body?.notes !== undefined) update.notes = String(req.body.notes).slice(0, 2000);

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const item = await ContactEnquiry.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .populate('handledBy', 'firstName lastName username')
      .lean();
    if (!item) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    res.json({ success: true, data: item, message: 'Enquiry updated' });
  } catch (error) {
    console.error('Error updating contact enquiry:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update enquiry' });
  }
};
