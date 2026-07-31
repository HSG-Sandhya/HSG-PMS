// Control-plane: hotel (tenant) management. Guarded by requirePlatformAdmin.
import { getTenantModel } from "../models/Tenant.js";
import { createTenant, listTenants, getTenant, slugify } from "../services/provisioning.js";

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const findOr404 = async (id, res) => {
  const tenant = await getTenant(id);
  if (!tenant) {
    res.status(404).json({ success: false, message: "Hotel not found." });
    return null;
  }
  return tenant;
};

export const list = wrap(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { slug: rx }, { subdomain: rx }, { customDomain: rx }];
  }
  const hotels = await listTenants(filter);
  res.json({ success: true, count: hotels.length, hotels });
});

export const getOne = wrap(async (req, res) => {
  const tenant = await findOr404(req.params.id, res);
  if (tenant) res.json({ success: true, hotel: tenant });
});

export const create = wrap(async (req, res) => {
  const b = req.body || {};
  const admin = b.admin || {};
  if (!b.name || !String(b.name).trim()) {
    return res.status(400).json({ success: false, message: "Hotel name is required." });
  }
  if (!admin.username || !admin.password || !admin.phone || !admin.firstName) {
    return res.status(400).json({
      success: false,
      message: "admin.username, admin.password, admin.phone and admin.firstName are required.",
    });
  }
  if (!/^\d{10}$/.test(String(admin.phone))) {
    return res.status(400).json({ success: false, message: "admin.phone must be 10 digits." });
  }
  if (String(admin.password).length < 6) {
    return res.status(400).json({ success: false, message: "admin.password must be at least 6 characters." });
  }
  try {
    const hotel = await createTenant({
      name: b.name, slug: b.slug, subdomain: b.subdomain, dbName: b.dbName,
      customDomain: b.customDomain, plan: b.plan, contactEmail: b.contactEmail,
      admin: {
        username: admin.username, password: admin.password, phone: admin.phone,
        firstName: admin.firstName, lastName: admin.lastName, email: admin.email,
      },
    });
    return res.status(201).json({ success: true, message: "Hotel created.", hotel });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

export const update = wrap(async (req, res) => {
  const tenant = await findOr404(req.params.id, res);
  if (!tenant) return;
  const b = req.body || {};
  if (b.name !== undefined) tenant.name = String(b.name).trim();
  if (b.plan !== undefined) tenant.plan = String(b.plan).trim();
  if (b.contactEmail !== undefined) tenant.contactEmail = String(b.contactEmail).trim().toLowerCase();
  if (b.notes !== undefined) tenant.notes = String(b.notes);
  if (b.customDomain !== undefined) {
    tenant.customDomain = b.customDomain ? String(b.customDomain).trim().toLowerCase() : null;
  }
  if (b.subdomain !== undefined) {
    const sub = slugify(b.subdomain);
    if (!sub) return res.status(400).json({ success: false, message: "Invalid subdomain." });
    const clash = await getTenantModel().findOne({ subdomain: sub, _id: { $ne: tenant._id } });
    if (clash) return res.status(409).json({ success: false, message: "That subdomain is already taken." });
    tenant.subdomain = sub;
  }
  try {
    await tenant.save();
  } catch (err) {
    const message = err?.code === 11000 ? "A hotel with that subdomain/domain already exists." : err.message;
    return res.status(400).json({ success: false, message });
  }
  res.json({ success: true, message: "Hotel updated.", hotel: tenant });
});

const setStatus = (status, verb) =>
  wrap(async (req, res) => {
    const tenant = await findOr404(req.params.id, res);
    if (!tenant) return;
    tenant.status = status;
    await tenant.save();
    res.json({ success: true, message: `Hotel ${verb}.`, hotel: tenant });
  });

export const suspend = setStatus("suspended", "suspended");
export const activate = setStatus("active", "activated");
