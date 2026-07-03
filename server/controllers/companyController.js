import Company from '../models/Company.js';
import Booking from '../models/Booking.js';

const COMPANY_TYPES = ['Corporate', 'Travel Agent', 'Government', 'Local Business', 'Other'];

const normRates = (rates) => (Array.isArray(rates) ? rates : [])
  .filter((r) => r && r.roomType)
  .map((r) => ({ roomType: r.roomType, rate: Number(r.rate) || 0 }));

// Editable profile fields (credit *usage* is managed by bookings/payments, not here).
export const buildCompanyData = (body = {}) => ({
  name: (body.name || '').trim(),
  companyType: COMPANY_TYPES.includes(body.companyType) ? body.companyType : '',
  gstNumber: (body.gstNumber || '').trim(),
  pan: (body.pan || '').trim(),
  billingAddress: (body.billingAddress || '').trim(),
  primaryContact: {
    name: body.primaryContact?.name || '',
    designation: body.primaryContact?.designation || '',
    phone: body.primaryContact?.phone || '',
    email: body.primaryContact?.email || '',
  },
  alternateContact: { name: body.alternateContact?.name || '', phone: body.alternateContact?.phone || '' },
  contractRates: normRates(body.contractRates),
  creditLimit: Number(body.creditLimit) || 0,
  creditDays: Number(body.creditDays) || 0,
});

const fail = (res, error, message) => {
  console.error(message, error);
  return res.status(500).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
  });
};

export const getCompanies = async (req, res) => {
  try {
    const { search, active } = req.query;
    const q = {};
    if (active === 'true') q.isActive = true;
    if (search) q.name = { $regex: search, $options: 'i' };
    const companies = await Company.find(q).sort({ name: 1 });
    return res.json({ success: true, data: companies });
  } catch (error) {
    return fail(res, error, 'Error fetching companies');
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    return res.json({ success: true, data: company });
  } catch (error) {
    return fail(res, error, 'Error fetching company');
  }
};

export const createCompany = async (req, res) => {
  try {
    const data = buildCompanyData(req.body);
    if (!data.name) return res.status(400).json({ success: false, message: 'Company name is required' });

    const exists = await Company.findOne({ name: data.name });
    if (exists) return res.status(409).json({ success: false, message: 'A company with this name already exists' });

    const company = await Company.create(data);
    return res.status(201).json({ success: true, data: company, message: 'Company created' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A company with this name already exists' });
    return fail(res, error, 'Error creating company');
  }
};

export const updateCompany = async (req, res) => {
  try {
    const data = buildCompanyData(req.body);
    if (!data.name) return res.status(400).json({ success: false, message: 'Company name is required' });
    if (typeof req.body.isActive === 'boolean') data.isActive = req.body.isActive;

    const company = await Company.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    return res.json({ success: true, data: company, message: 'Company updated' });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'A company with this name already exists' });
    return fail(res, error, 'Error updating company');
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    return res.json({ success: true, message: 'Company deleted' });
  } catch (error) {
    return fail(res, error, 'Error deleting company');
  }
};

// Group a company's bookings into clusters (one per groupId) for history.
const clustersFor = (bookings) => {
  const byGroup = new Map();
  for (const b of bookings) {
    const key = b.groupId || String(b._id);
    if (!byGroup.has(key)) {
      byGroup.set(key, {
        groupId: key, name: b.groupName || b.guestName, bookingType: b.bookingType,
        checkIn: b.checkIn, checkOut: b.checkOut, status: b.bookingStatus,
        rooms: 0, revenue: 0, paid: 0, createdAt: b.createdAt,
      });
    }
    const c = byGroup.get(key);
    c.rooms += 1;
    if (b.bookingStatus !== 'Cancelled') c.revenue += Number(b.totalAmount) || 0;
    if (b.isGroupMaster) { c.paid = Number(b.paidAmount) || 0; c.status = b.bookingStatus; c.createdAt = b.createdAt; }
  }
  return [...byGroup.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

// Corporate revenue analytics across all companies.
export const getCompaniesAnalytics = async (_req, res) => {
  try {
    const companies = await Company.find();
    const byId = new Map(companies.map((c) => [String(c._id), c]));

    const bookings = await Booking.find({ bookingType: 'company', 'company.ref': { $ne: null } })
      .select('company groupId totalAmount bookingStatus');
    const active = bookings.filter((b) => b.bookingStatus !== 'Cancelled');

    const revByCompany = new Map();
    const revByType = new Map();
    const clusters = new Set();
    let totalRevenue = 0;
    for (const b of active) {
      const amt = Number(b.totalAmount) || 0;
      totalRevenue += amt;
      if (b.groupId) clusters.add(b.groupId);
      const cid = String(b.company?.ref);
      revByCompany.set(cid, (revByCompany.get(cid) || 0) + amt);
      const type = byId.get(cid)?.companyType || b.company?.companyType || 'Other';
      revByType.set(type, (revByType.get(type) || 0) + amt);
    }

    const topCompanies = [...revByCompany.entries()]
      .map(([cid, revenue]) => ({ id: cid, name: byId.get(cid)?.name || 'Unknown', revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const revenueByType = [...revByType.entries()].map(([type, revenue]) => ({ type, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return res.json({
      success: true,
      data: {
        totalCompanies: companies.length,
        activeCompanies: companies.filter((c) => c.isActive).length,
        totalCreditLimit: companies.reduce((s, c) => s + (c.creditLimit || 0), 0),
        totalCreditUsed: companies.reduce((s, c) => s + (c.creditUsed || 0), 0),
        corporateRevenue: totalRevenue,
        corporateBookings: clusters.size,
        topCompanies,
        revenueByType,
      },
    });
  } catch (error) {
    return fail(res, error, 'Error computing company analytics');
  }
};

// One company's booking history (clusters) + credit summary.
export const getCompanyHistory = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const bookings = await Booking.find({ 'company.ref': company._id })
      .select('groupName guestName bookingType checkIn checkOut bookingStatus totalAmount paidAmount isGroupMaster groupId createdAt');
    const clusters = clustersFor(bookings);
    const revenue = clusters.reduce((s, c) => s + c.revenue, 0);
    const paid = clusters.reduce((s, c) => s + c.paid, 0);

    return res.json({
      success: true,
      data: {
        company,
        clusters,
        summary: {
          clusters: clusters.length,
          revenue,
          paid,
          outstanding: Math.max(0, revenue - paid),
          creditUsed: company.creditUsed || 0,
          creditAvailable: company.creditAvailable,
        },
      },
    });
  } catch (error) {
    return fail(res, error, 'Error fetching company history');
  }
};

// Reduce the running credit balance when the company settles an invoice.
export const recordCreditPayment = async (req, res) => {
  try {
    const amount = Number(req.body?.amount) || 0;
    if (amount <= 0) return res.status(400).json({ success: false, message: 'Payment amount must be positive' });

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.creditUsed = Math.max(0, (company.creditUsed || 0) - amount);
    await company.save();
    return res.json({ success: true, data: company, message: 'Credit payment recorded' });
  } catch (error) {
    return fail(res, error, 'Error recording credit payment');
  }
};
