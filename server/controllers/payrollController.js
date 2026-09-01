import Payroll from "../models/Payroll.js";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Settings from "../models/Settings.js";
import StaffTransaction from "../models/StaffTransaction.js";
import StaffRecharge from "../models/StaffRecharge.js";
import { validationResult } from "express-validator";
import PDFDocument from "pdfkit";
import { syncPayrollExpense } from "../services/accountingSync.js";
import { getOps } from "../config/operationalConfig.js";
import { loadAuthUser } from "../middleware/requireManage.js";
import { isAdminActor } from '../utils/isAdminActor.js';
import {
  num,
  periodLabel,
  previousPeriod,
  nextPeriod,
  closingBalanceOf,
  summariseStaffMoney,
  DEDUCTION_FIELDS,
} from "../utils/payrollLedger.js";

// Scheduled salary pay date for a payroll period: the configured pay day of the
// month FOLLOWING the period (salary paid in arrears). payrollPeriod.month is
// 1-indexed, so passing it straight to Date() lands on the next month. Clamped
// to 28 so it never rolls over a short month.
const scheduledPayDate = (payrollPeriod, payDay) => {
  const day = Math.min(Math.max(Number(payDay) || 1, 1), 28);
  return new Date(payrollPeriod.year, payrollPeriod.month, day);
};

// Any one of these grants access to the payroll screens. `manage_payroll` is the
// umbrella grant; the granular strings come from config/permissions.js so a role
// given "all payroll permissions" works. `manage_staff`/`admin_access` are kept
// for back-compat with roles set up before the granular list existed.
const PAYROLL_ACCESS = [
  'manage_payroll',
  'view_payroll',
  'generate_payroll',
  'approve_payroll',
  'edit_payroll',
  'delete_payroll',
  'generate_payroll_pdf',
  'download_payroll_pdf',
  'process_payroll_payments',
  'view_payroll_reports',
  'view_payroll_summary',
  'manage_staff',
  'admin_access',
];

// Helper function to check if user can manage payroll.
//
// Takes the REQUEST, not the token payload: a JWT only carries the permissions
// held when it was issued, so grants made afterwards were invisible until the
// user logged in again (tokens last 30 days). Falls back to reading the role
// from the database, cached on `req.authUser` for the rest of the request.
const canManagePayroll = async (req) => {
  const user = req?.user;
  // Require proper authentication - no bypass
  if (!user) return false;

  // Check system admin flag (handle both boolean and string values)
  if (user.isSystemAdmin === true || user.isSystemAdmin === 'true') return true;

  // Check role name (from JWT token, or a populated role object)
  const roleName = user.roleName || user.role?.name;
  if (roleName && ['Admin', 'System Administrator'].includes(roleName)) return true;

  // Permissions carried by the token (fast path, no query).
  if (Array.isArray(user.permissions) && PAYROLL_ACCESS.some((p) => user.permissions.includes(p))) {
    return true;
  }

  // Authoritative check against the user's current role.
  try {
    const dbUser = req.authUser
      || (typeof user.hasPermission === 'function' ? user : await loadAuthUser(user));
    if (!dbUser || dbUser.isActive === false) return false;
    req.authUser = dbUser;
    if (dbUser.isSystemAdmin) return true;
    if (['Admin', 'System Administrator'].includes(dbUser.role?.name)) return true;

    const rolePerms = dbUser.role?.permissions || [];
    const directPerms = dbUser.permissions || [];
    return PAYROLL_ACCESS.some((p) => rolePerms.includes(p) || directPerms.includes(p));
  } catch {
    return false;
  }
};

// Approving a payroll is the step that authorises money to leave the business,
// so it is held to a higher bar than the rest of the payroll screen: managers
// may generate, recalculate and print, but only an administrator or the owner
// may approve.
//
// This deliberately checks WHO the caller is rather than what permissions they
// hold. The `approve_payroll` permission cannot discriminate here — every role
// that can reach payroll at all (Hotel Manager and General Manager included)
// was granted the entire payroll permission group, so a permission test would
// pass for exactly the roles this is meant to stop. Grant-based checks can come
// back once those roles are re-scoped.
//
// Administrator status comes from utils/isAdminActor.js (isSystemAdmin or an
// explicit admin grant), shared with staffAuthority.js and the permission
// middleware so every surface answers the question identically.
const canApprovePayroll = async (req) => {
  const user = req?.user;
  if (!user) return false;

  if (user.isSystemAdmin === true || user.isSystemAdmin === 'true') return true;
  // Approving payroll releases money — decided by grants, not by role label.
  if (isAdminActor(user)) return true;
  if (String(user.roleName || user.role?.name || '').toLowerCase() === 'owner') return true;

  // The token only carries the role held when it was issued, so confirm against
  // the user's current role before refusing (same reasoning as canManagePayroll).
  try {
    const dbUser = req.authUser
      || (typeof user.hasPermission === 'function' ? user : await loadAuthUser(user));
    if (!dbUser || dbUser.isActive === false) return false;
    req.authUser = dbUser;

    if (dbUser.isSystemAdmin) return true;
    const dbRole = dbUser.role?.name || '';
    return isAdminActor(dbUser) || dbRole.toLowerCase() === 'owner';
  } catch {
    return false;
  }
};

// @desc    Generate payroll for staff
// @route   POST /api/payroll/generate
// @access  Private (Admin/System Admin only)
export const generatePayroll = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Admin and System Admin can generate payroll."
      });
    }

    const { staffId, month, year } = req.body;

    // Check if payroll already exists for this staff, month, and year
    const existingPayroll = await Payroll.findOne({
      staff: staffId,
      'payrollPeriod.month': month,
      'payrollPeriod.year': year
    });

    let payroll;
    if (existingPayroll) {
      // Approved or paid payrolls are locked — don't silently overwrite an
      // amount that's already been signed off or disbursed.
      if (!['draft', 'calculated'].includes(existingPayroll.status)) {
        return res.status(400).json({
          success: false,
          message: `Payroll for ${month}/${year} is already ${existingPayroll.status} and cannot be recalculated.`,
          data: {
            existingPayrollId: existingPayroll._id,
            status: existingPayroll.status,
            createdAt: existingPayroll.createdAt
          }
        });
      }
      // Recalculate the existing draft/calculated record in place so the latest
      // salary, attendance and advances (and current payroll policy) are applied.
      await existingPayroll.calculatePayroll();
      payroll = existingPayroll;
    } else {
      payroll = await Payroll.generateForStaff(staffId, month, year);
    }

    payroll.calculatedBy = req.user?._id || null;
    await payroll.save();

    await payroll.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'calculatedBy', select: 'firstName lastName' }
    ]);

    res.status(existingPayroll ? 200 : 201).json({
      success: true,
      message: existingPayroll ? "Payroll recalculated successfully" : "Payroll generated successfully",
      data: payroll
    });
  } catch (error) {
    console.error('Generate payroll error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error while generating payroll"
    });
  }
};

// Active, non-admin users — the people this payroll pays. Admin/Owner roles and
// anyone in the "System Administration" department are excluded, matching the
// operational staff list.
const getEligibleStaff = async () => {
  const staffList = await User.find({ isSystemAdmin: false, isActive: true }).populate('role department');
  return staffList.filter((u) =>
    !['Admin', 'System Administrator', 'Owner'].includes(u.role?.name) &&
    (u.department?.name || '') !== 'System Administration'
  );
};

// Per-category breakdown of what a staff member drew, so the dashboard can show
// WHY a deduction is what it is rather than one opaque figure.
const deductionBreakdown = (payroll) => DEDUCTION_FIELDS.reduce((out, field) => {
  out[field] = num(payroll.deductions?.[field]);
  return out;
}, {});

// @desc    Live payroll for every eligible staff member for a month/year.
//          Rows already generated show their persisted figures + status; the
//          rest are computed on the fly (not saved) so the dashboard reflects
//          each staff member's current salary, advances and deductions before
//          payroll is generated. The row's `persisted` flag drives whether the
//          UI shows a "Generate" button or the approve/pay/PDF actions.
//
//          Every row carries the money drawn during THIS month only, broken
//          down by form (advance, recharge, part-salary, loan, other), plus the
//          balance carried in from the previous month and the balance rolling
//          out to the next one.
// @route   GET /api/payroll/live?month=&year=
// @access  Private (Admin/System Admin only)
export const getLivePayroll = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "month and year are required" });
    }

    const eligible = await getEligibleStaff();

    // Any payroll already generated for this period, keyed by staff id.
    const existing = await Payroll.find({ 'payrollPeriod.month': month, 'payrollPeriod.year': year });
    const persistedByStaff = new Map(existing.map((p) => [String(p.staff), p]));

    // One batched pass computes the whole month for every staff member, and
    // hands back the carry-in each of them starts from.
    const { previews, openings, previousPeriod: prevInfo } = await Payroll.previewMonth(eligible, month, year);

    const rows = eligible.map((staff) => {
      const key = String(staff._id);
      const base = {
        staffId: key,
        employeeId: staff.profile?.employeeId || 'N/A',
        name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
      };
      const currentOpening = openings.get(key) || { amount: 0, source: 'none' };
      const persisted = persistedByStaff.get(key);
      const source = persisted || previews.get(key);

      if (!source) {
        return {
          ...base,
          basicSalary: staff.profile?.salary || 0,
          totalEarnings: 0,
          deductions: { advance: 0, salaryPaid: 0, recharge: 0, loan: 0, other: 0 },
          totalDeductions: 0,
          openingBalance: 0,
          openingSource: 'none',
          netThisMonth: 0,
          netSalary: 0,
          carryForward: 0,
          status: 'not_generated',
          persisted: false,
        };
      }

      const opening = num(source.carryForward?.opening);
      const totalDeductions = num(source.deductions?.totalDeductions);
      const totalEarnings = num(source.earnings?.totalEarnings);

      return {
        ...base,
        basicSalary: num(source.salary?.basic),
        totalEarnings,
        deductions: deductionBreakdown(source),
        totalDeductions,
        openingBalance: opening,
        openingSource: source.carryForward?.openingSource || 'none',
        // Earnings less what was drawn, before the carry-in — the month on its own.
        netThisMonth: totalEarnings - totalDeductions,
        netSalary: num(source.netSalary),
        carryForward: closingBalanceOf(source),
        amountPaid: num(source.payment?.amountPaid),
        status: persisted ? persisted.status : 'not_generated',
        persisted: Boolean(persisted),
        ...(persisted ? { payrollId: String(persisted._id) } : {}),
        // A generated record stores the carry-in it was calculated with. If the
        // previous month has since been recalculated, that stored figure is out
        // of date and the row needs regenerating — flagged rather than silently
        // rewritten, because an approved or paid record must not change by itself.
        openingStale: Boolean(persisted) && Math.abs(opening - num(currentOpening.amount)) >= 0.5,
      };
    });

    rows.sort((a, b) => a.name.localeCompare(b.name));
    const totals = rows.reduce((acc, r) => ({
      netSalary: acc.netSalary + r.netSalary,
      totalEarnings: acc.totalEarnings + r.totalEarnings,
      totalDeductions: acc.totalDeductions + r.totalDeductions,
      openingBalance: acc.openingBalance + r.openingBalance,
      carryForward: acc.carryForward + r.carryForward,
      pendingCount: acc.pendingCount + (r.persisted ? 0 : 1),
      overdrawnCount: acc.overdrawnCount + (r.netSalary < 0 ? 1 : 0),
    }), {
      netSalary: 0, totalEarnings: 0, totalDeductions: 0,
      openingBalance: 0, carryForward: 0, pendingCount: 0, overdrawnCount: 0,
    });

    const next = nextPeriod(month, year);
    res.json({
      success: true,
      data: {
        rows,
        totals,
        count: rows.length,
        month,
        year,
        period: { month, year, label: periodLabel(month, year) },
        // Balances only roll forward out of a month that has been generated, so
        // the UI can tell the user what is still un-closed behind them.
        previous: {
          month: prevInfo.month,
          year: prevInfo.year,
          label: periodLabel(prevInfo.month, prevInfo.year),
          generatedCount: prevInfo.generatedCount,
          missingCount: Math.max(0, rows.length - prevInfo.generatedCount),
        },
        next: { month: next.month, year: next.year, label: periodLabel(next.month, next.year) },
      },
    });
  } catch (error) {
    console.error('Live payroll error:', error);
    res.status(500).json({ success: false, message: "Error computing live payroll" });
  }
};

// @desc    Generate payroll for every eligible staff member who has none for the
//          period. Closing a month is what makes its balances roll into the next
//          one, and doing that one row at a time for a whole team is tedious.
//          Existing records are left untouched — recalculating an individual row
//          stays an explicit, per-staff action.
// @route   POST /api/payroll/generate-month
// @access  Private (Admin/System Admin only)
export const generateMonthPayroll = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Admin and System Admin can generate payroll."
      });
    }

    const month = parseInt(req.body.month, 10);
    const year = parseInt(req.body.year, 10);
    if (!month || !year || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "A valid month and year are required" });
    }

    const eligible = await getEligibleStaff();
    const existing = await Payroll.find(
      { 'payrollPeriod.month': month, 'payrollPeriod.year': year },
      { staff: 1 }
    );
    const alreadyGenerated = new Set(existing.map((p) => String(p.staff)));
    const pending = eligible.filter((s) => !alreadyGenerated.has(String(s._id)));

    const generated = [];
    const failed = [];
    for (const staff of pending) {
      try {
        const payroll = await Payroll.generateForStaff(staff._id, month, year);
        payroll.calculatedBy = req.user?._id || null;
        await payroll.save();
        generated.push({ staffId: String(staff._id), netSalary: payroll.netSalary });
      } catch (err) {
        failed.push({
          staffId: String(staff._id),
          name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim(),
          message: err.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: failed.length
        ? `Generated ${generated.length} payroll(s) for ${periodLabel(month, year)}; ${failed.length} failed.`
        : `Generated ${generated.length} payroll(s) for ${periodLabel(month, year)}.`,
      data: {
        month,
        year,
        generatedCount: generated.length,
        skippedCount: alreadyGenerated.size,
        failed,
      },
    });
  } catch (error) {
    console.error('Generate month payroll error:', error);
    res.status(500).json({ success: false, message: "Server error while generating payroll for the month" });
  }
};

// @desc    Get all payrolls
// @route   GET /api/payroll
// @access  Private (Admin/System Admin only)
export const getAllPayrolls = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Admin and System Admin can view payrolls."
      });
    }

    const { page = 1, limit = 10, month, year, status, staff } = req.query;

    let query = {};
    if (month) query['payrollPeriod.month'] = parseInt(month);
    if (year) query['payrollPeriod.year'] = parseInt(year);
    if (status) query.status = status;
    if (staff) query.staff = staff;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { 'payrollPeriod.year': -1, 'payrollPeriod.month': -1 },
      populate: [
        { path: 'staff', select: 'firstName lastName profile.employeeId' },
        { path: 'calculatedBy approvedBy payment.paidBy', select: 'firstName lastName' }
      ]
    };

    const payrolls = await Payroll.paginate(query, options);

    res.status(200).json({
      success: true,
      data: payrolls.docs,
      pagination: {
        currentPage: payrolls.page,
        totalPages: payrolls.totalPages,
        totalRecords: payrolls.totalDocs
      }
    });
  } catch (error) {
    console.error('Get payrolls error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payrolls"
    });
  }
};

// @desc    Generate payroll PDF
// @route   GET /api/payroll/:id/pdf
// @access  Private (Admin/System Admin only)
export const generatePayrollPDF = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    const payroll = await Payroll.findById(req.params.id)
      .populate('staff', 'firstName lastName profile email phone')
      .populate('calculatedBy approvedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found"
      });
    }

    // Fetch real hotel profile from settings
    let hotelProfile;
    try {
      const settings = await Settings.findOne();
      if (settings) {
        hotelProfile = {
          name: settings.hotelName || 'Hotel Management System',
          legalName: settings.legalName,
          address: {
            line1: settings.address?.line1,
            line2: settings.address?.line2,
            area: settings.address?.area,
            city: settings.address?.city,
            state: settings.address?.state,
            postalCode: settings.address?.postalCode,
            country: settings.address?.country
          },
          phone: settings.contact?.phone,
          mobile: settings.contact?.mobile,
          email: settings.contact?.email,
          website: settings.contact?.website,
          starRating: settings.starRating,
          gst: settings.tax?.gst?.number,
          pan: settings.tax?.pan?.number
        };
      }
    } catch (error) {
      console.log('Could not fetch hotel settings, using defaults');
    }

    // Fetch every form in which this staff member drew money during the period.
    // The individual rows are kept, not just the totals, so the slip can itemise
    // exactly what was recovered — a staff member querying a deduction needs to
    // see which advance and which recharge it came from. Classification is
    // shared with the payroll calculation (utils/payrollLedger.js) so the slip
    // can never disagree with the stored record.
    let staffTransactions = [];
    let rechargeTransactions = [];

    try {
      staffTransactions = await StaffTransaction.find({
        staff: payroll.staff._id,
        date: {
          $gte: payroll.payrollPeriod.startDate,
          $lte: payroll.payrollPeriod.endDate
        }
      }).sort({ date: 1 });

      rechargeTransactions = await StaffRecharge.find({
        staff: payroll.staff._id,
        date: {
          $gte: payroll.payrollPeriod.startDate,
          $lte: payroll.payrollPeriod.endDate
        }
      }).sort({ date: 1 });
    } catch (error) {
      console.log('Could not fetch advance/recharge data:', error);
    }

    const { taken } = summariseStaffMoney(staffTransactions, rechargeTransactions);
    // Transactions the staff member drew against salary, in date order, for the
    // itemised card further down.
    const drawnTransactions = staffTransactions.filter((t) => (
      ['advance', 'salary', 'loan', 'deduction'].includes(t.type) && t.status !== 'cancelled'
    ));
    const recoveredRecharges = rechargeTransactions.filter((r) => !['failed', 'cancelled'].includes(r.status));

    // Fallback hotel profile
    if (!hotelProfile) {
      hotelProfile = {
        name: 'Hotel Management System',
        address: { line1: 'Hotel Address', city: 'City', state: 'State' },
        phone: 'Phone Number',
        email: 'hotel@example.com',
        website: 'www.hotel.com'
      };
    }

    // Create PDF with professional layout
    const doc = new PDFDocument({ 
      margin: 30,
      size: 'A4'
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${payroll.staff.firstName}-${payroll.payrollPeriodDisplay}.pdf"`);
    
    doc.pipe(res);

    // ---- Modern palette ----
    const INK = '#0F172A';
    const SLATE = '#475569';
    const MUTED = '#94A3B8';
    const mediumGray = '#64748B';
    const BORDER = '#E5E9F2';
    const indigo = '#4F46E5';
    const indigoSoft = '#EEF2FF';
    const green = '#059669';
    const greenLite = '#10B981';
    const warningColor = '#D97706';
    const red = '#DC2626';
    const white = '#FFFFFF';

    const PAGE_X = 40;
    const PAGE_W = 515;
    // A4 is 842pt tall; leave room for the footer lines at the bottom.
    const PAGE_BOTTOM = 842 - 70;
    const headH = 30;
    const rowH = 22;

    const fmt = (amount) => `Rs. ${(Number(amount) || 0).toFixed(2)}`;
    const safeNum = (v) => (isNaN(v) || v == null ? 0 : Number(v));
    const TOTAL_LABELS = ['TOTAL EARNINGS', 'TOTAL DEDUCTIONS'];

    // Generic card: titled header, optional sub-header row, data rows.
    const drawCard = (x, y, w, title, accent, rows, opts = {}) => {
      const { subhead = null, valueColor = INK } = opts;
      const subN = subhead ? 1 : 0;
      const h = headH + subN * rowH + rows.length * rowH;
      const labelW = w * 0.5;
      const cols = (rows[0] && rows[0].length) || 2;
      const valColW = cols > 1 ? (w - labelW) / (cols - 1) : w - labelW;

      // background
      doc.roundedRect(x, y, w, h, 8).fill(white);

      // title
      doc.rect(x + 14, y + 10, 3.5, 12).fill(accent);
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(10.5)
        .text(title.toUpperCase(), x + 24, y + 10.5);
      doc.moveTo(x, y + headH).lineTo(x + w, y + headH).lineWidth(0.8).strokeColor('#EEF1F6').stroke();

      let ry = y + headH;

      if (subhead) {
        doc.rect(x + 1, ry, w - 2, rowH).fill('#F8FAFC');
        doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8.5);
        subhead.forEach((htext, i) => {
          if (i === 0) doc.text(htext, x + 16, ry + 7, { width: labelW - 16 });
          else doc.text(htext, x + labelW + (i - 1) * valColW, ry + 7, { width: valColW - 16, align: 'right' });
        });
        ry += rowH;
      }

      rows.forEach((row, idx) => {
        const isTotal = TOTAL_LABELS.includes(String(row[0]).toUpperCase());
        if (isTotal) doc.rect(x + 1, ry, w - 2, rowH).fill(indigoSoft);
        else if (idx % 2 === 1) doc.rect(x + 1, ry, w - 2, rowH).fill('#FAFBFC');

        doc.fillColor(isTotal ? accent : SLATE).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
        doc.text(String(row[0]), x + 16, ry + 6.5, { width: labelW - 18 });

        for (let i = 1; i < row.length; i++) {
          const isLastCol = i === row.length - 1;
          const vc = isTotal ? accent : (isLastCol ? valueColor : SLATE);
          doc.fillColor(vc).font(isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
          doc.text(String(row[i]), x + labelW + (i - 1) * valColW, ry + 6.5, { width: valColW - 14, align: 'right' });
        }
        ry += rowH;
      });

      doc.roundedRect(x, y, w, h, 8).lineWidth(1).strokeColor(BORDER).stroke();
      return y + h;
    };

    // ---- Header band ----
    const headerGrad = doc.linearGradient(PAGE_X, 40, PAGE_X + PAGE_W, 132);
    headerGrad.stop(0, indigo).stop(1, '#818CF8');
    doc.roundedRect(PAGE_X, 40, PAGE_W, 92, 12).fill(headerGrad);

    doc.fillColor(white).font('Helvetica-Bold').fontSize(19)
      .text(hotelProfile.name, PAGE_X, 58, { align: 'center', width: PAGE_W });

    let addressText = '';
    if (hotelProfile.address.line1) addressText += hotelProfile.address.line1;
    if (hotelProfile.address.line2) addressText += ', ' + hotelProfile.address.line2;
    if (hotelProfile.address.city) addressText += ', ' + hotelProfile.address.city;
    if (hotelProfile.address.state) addressText += ', ' + hotelProfile.address.state;

    doc.font('Helvetica').fontSize(8.5).fillColor('#E0E7FF')
      .text(addressText, PAGE_X, 84, { align: 'center', width: PAGE_W });

    let contactText = '';
    if (hotelProfile.phone) contactText += `Phone: ${hotelProfile.phone}`;
    if (hotelProfile.email) contactText += `   |   Email: ${hotelProfile.email}`;
    doc.fillColor('#E0E7FF').fontSize(8.5)
      .text(contactText, PAGE_X, 98, { align: 'center', width: PAGE_W });

    // ---- Title / period strip ----
    let currentY = 146;
    doc.roundedRect(PAGE_X, currentY, PAGE_W, 30, 6).fill(indigoSoft);
    doc.fillColor(indigo).font('Helvetica-Bold').fontSize(12)
      .text('SALARY SLIP', PAGE_X + 16, currentY + 9);
    doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(10)
      .text(`Pay Period:  ${payroll.payrollPeriodDisplay}`, PAGE_X, currentY + 10, { width: PAGE_W - 16, align: 'right' });
    currentY += 44;

    // ---- Employee information ----
    // Payment date: the actual paid date once paid, otherwise the scheduled
    // pay day from Settings → Operations → Payroll.
    const { payroll: payCfg } = await getOps();
    const paidDate = payroll.payment?.paidAt;
    const payDateLabel = paidDate
      ? `${new Date(paidDate).toLocaleDateString('en-IN')} (paid)`
      : `${scheduledPayDate(payroll.payrollPeriod, payCfg.payDay).toLocaleDateString('en-IN')} (scheduled)`;
    const empRows = [
      ['Employee Name', `${payroll.staff.firstName} ${payroll.staff.lastName}`],
      ['Employee ID', payroll.staff.profile?.employeeId || 'N/A'],
      ['Email', payroll.staff.email || 'N/A'],
      ['Phone', payroll.staff.phone || 'N/A'],
      ['Payment Date', payDateLabel],
    ];
    currentY = drawCard(PAGE_X, currentY, PAGE_W, 'Employee Information', indigo, empRows) + 16;

    // ---- Attendance summary ----
    const wd = safeNum(payroll.attendance.workingDays);
    const pct = (n) => (wd > 0 ? `${((safeNum(n) / wd) * 100).toFixed(1)}%` : '0.0%');
    const attRows = [
      ['Total Working Days', wd, '100%'],
      ['Present Days', safeNum(payroll.attendance.presentDays), pct(payroll.attendance.presentDays)],
      ['Absent Days', safeNum(payroll.attendance.absentDays), pct(payroll.attendance.absentDays)],
      ['Half Days', safeNum(payroll.attendance.halfDays), pct(payroll.attendance.halfDays)],
      ['Leave Days', safeNum(payroll.attendance.leaveDays), pct(payroll.attendance.leaveDays)],
      ['Overall Attendance', '', `${safeNum(payroll.attendance.attendancePercentage).toFixed(1)}%`],
    ];
    currentY = drawCard(PAGE_X, currentY, PAGE_W, 'Attendance Summary', green, attRows, { subhead: ['Metric', 'Days', 'Percentage'] }) + 16;

    // ---- Earnings (left) & Deductions (right) ----
    const a = payroll.earnings.allowances || {};
    const earnAll = [
      ['Basic Pay', payroll.earnings.basicPay, true],
      ['Overtime Pay', payroll.earnings.overtimePay],
      ['HRA', a.hra], ['DA', a.da], ['TA', a.ta],
      ['Medical Allowance', a.medical], ['Food Allowance', a.food],
      ['Performance', a.performance], ['Other Allowance', a.other],
      ['Bonus', payroll.earnings.bonus], ['Incentive', payroll.earnings.incentive],
    ];
    const totalEarnings = safeNum(payroll.earnings.totalEarnings);
    const earnRows = earnAll
      .filter((r) => r[2] || safeNum(r[1]) > 0)
      .map((r) => [r[0], fmt(r[1])]);
    earnRows.push(['TOTAL EARNINGS', fmt(totalEarnings)]);

    // No statutory (PF/ESI/TDS) or attendance-penalty (absent/late) deductions —
    // salary is attendance-based, so what is recovered is simply everything the
    // staff member drew during the month, whichever form it took.
    const dedAll = [
      ['Advance Payment', taken.advance, true],
      ['Mobile Recharge', taken.recharge, true],
      ['Salary Paid In Month', taken.salaryPaid],
      ['Loan', taken.loan],
      ['Other Deductions', taken.other],
    ];
    const totalDeductions = dedAll.reduce((s, r) => s + safeNum(r[1]), 0);
    const dedRows = dedAll
      .filter((r) => r[2] || safeNum(r[1]) > 0)
      .map((r) => [r[0], fmt(r[1])]);
    dedRows.push(['TOTAL DEDUCTIONS', fmt(totalDeductions)]);

    const colW = (PAGE_W - 15) / 2;
    const earnEndY = drawCard(PAGE_X, currentY, colW, 'Earnings', green, earnRows, { valueColor: INK });
    const dedEndY = drawCard(PAGE_X + colW + 15, currentY, colW, 'Deductions', warningColor, dedRows, { valueColor: red });
    currentY = Math.max(earnEndY, dedEndY) + 16;

    // ---- Deduction summary (itemised) ----
    // The Deductions card above gives one line per category; this breaks those
    // categories back down into the individual advances and recharges behind
    // them, so the staff member can reconcile every rupee withheld. Skipped
    // entirely when nothing was recovered — an empty card just wastes a page.
    const DRAWN_LABEL = {
      advance: 'Advance',
      salary: 'Salary paid in month',
      loan: 'Loan',
      deduction: 'Deduction',
    };
    const dedDetailRows = [
      ...drawnTransactions.map((t) => [
        `${DRAWN_LABEL[t.type] || t.type}${t.reason ? ` — ${t.reason}` : ''}`,
        new Date(t.date).toLocaleDateString('en-IN'),
        fmt(t.amount),
      ]),
      ...recoveredRecharges.map((r) => [
        `Recharge${r.operator ? ` — ${r.operator}` : ''}${r.phoneNumber ? ` (${r.phoneNumber})` : ''}`,
        new Date(r.date).toLocaleDateString('en-IN'),
        fmt(r.amount),
      ]),
    ];

    if (dedDetailRows.length > 0) {
      dedDetailRows.push(['TOTAL DEDUCTIONS', '', fmt(totalDeductions)]);

      // This slip already fills most of an A4 by the time it reaches here, so
      // spill onto a second page rather than letting the card run off the
      // bottom edge.
      const detailH = headH + rowH + dedDetailRows.length * rowH;
      if (currentY + detailH > PAGE_BOTTOM) {
        doc.addPage();
        currentY = 40;
      }
      currentY = drawCard(PAGE_X, currentY, PAGE_W, 'Deduction Summary', warningColor, dedDetailRows, {
        subhead: ['Particulars', 'Date', 'Amount'],
        valueColor: red,
      }) + 16;
    }

    // ---- Running balance (carry-forward) ----
    // Salary here is a running account: what the staff member did not draw stays
    // owed to them, and what they over-drew is recovered next month. The slip has
    // to show both ends of that, or the net will not reconcile against this
    // month's earnings and deductions on their own.
    const netThisMonth = totalEarnings - totalDeductions;
    const opening = safeNum(payroll.carryForward?.opening);
    const netSalary = netThisMonth + opening;
    const amountPaid = safeNum(payroll.payment?.amountPaid);
    const closing = payroll.status === 'paid' ? netSalary - amountPaid : netSalary;

    const prev = previousPeriod(payroll.payrollPeriod.month, payroll.payrollPeriod.year);
    const next = nextPeriod(payroll.payrollPeriod.month, payroll.payrollPeriod.year);
    const signed = (v) => `${safeNum(v) < 0 ? '-' : ''}${fmt(Math.abs(safeNum(v)))}`;

    const balanceRows = [
      [`Balance from ${periodLabel(prev.month, prev.year)}`, signed(opening)],
      [`Earnings less amount drawn (${payroll.payrollPeriodDisplay})`, signed(netThisMonth)],
      ...(payroll.status === 'paid' ? [['Paid out', fmt(amountPaid)]] : []),
      [`Balance carried to ${periodLabel(next.month, next.year)}`, signed(closing)],
    ];

    const balanceH = headH + balanceRows.length * rowH;
    if (currentY + balanceH + 54 + 40 > PAGE_BOTTOM) {
      doc.addPage();
      currentY = 40;
    }
    currentY = drawCard(PAGE_X, currentY, PAGE_W, 'Running Balance', indigo, balanceRows, {
      valueColor: INK,
    }) + 16;

    // ---- Net salary band ----
    if (currentY + 54 + 40 > PAGE_BOTTOM) {
      doc.addPage();
      currentY = 40;
    }
    // An over-drawn month pays out nothing, so the band flips to a recovery
    // notice rather than printing a negative "net salary".
    const overdrawn = netSalary < 0;
    const netGrad = doc.linearGradient(PAGE_X, currentY, PAGE_X + PAGE_W, currentY + 54);
    if (overdrawn) netGrad.stop(0, '#B91C1C').stop(1, red);
    else netGrad.stop(0, green).stop(1, greenLite);
    doc.roundedRect(PAGE_X, currentY, PAGE_W, 54, 10).fill(netGrad);
    doc.fillColor(white).font('Helvetica-Bold').fontSize(13)
      .text(overdrawn ? 'EXCESS DRAWN' : 'NET SALARY', PAGE_X + 18, currentY + 13);
    doc.fillColor(overdrawn ? '#FEE2E2' : '#D1FAE5').font('Helvetica').fontSize(8.5)
      .text(
        overdrawn
          ? `Nothing payable — recovered from ${periodLabel(next.month, next.year)}`
          : `Payable for ${payroll.payrollPeriodDisplay}`,
        PAGE_X + 18,
        currentY + 31
      );
    doc.fillColor(white).font('Helvetica-Bold').fontSize(20)
      .text(fmt(Math.abs(netSalary)), PAGE_X, currentY + 17, { width: PAGE_W - 18, align: 'right' });
    currentY += 72;

    // ---- Footer ----
    doc.fillColor(mediumGray).fontSize(8).font('Helvetica');
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}  |  Generated by: ${req.user?.firstName || 'System'} ${req.user?.lastName || 'Admin'}`, PAGE_X, currentY, { width: PAGE_W, align: 'center' });
    doc.text('This is a computer-generated document and does not require a signature.', PAGE_X, currentY + 12, { width: PAGE_W, align: 'center' });

    // Update payroll PDF status before ending the stream
    payroll.pdfGenerated = true;
    payroll.pdfGeneratedAt = new Date();
    await payroll.save();

    doc.end();

  } catch (error) {
    console.error('Generate PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Error generating PDF"
      });
    }
  }
};

// @desc    Approve payroll
// @route   PUT /api/payroll/:id/approve
// @access  Private (Admin/System Admin/Owner only — NOT managers)
export const approvePayroll = async (req, res) => {
  try {
    if (!(await canApprovePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only an administrator or the owner can approve payroll."
      });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found"
      });
    }

    if (payroll.status !== 'calculated') {
      return res.status(400).json({
        success: false,
        message: "Only calculated payrolls can be approved"
      });
    }

    payroll.approve(req.user?._id || null);
    await payroll.save();

    res.status(200).json({
      success: true,
      message: "Payroll approved successfully",
      data: payroll
    });
  } catch (error) {
    console.error('Approve payroll error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while approving payroll"
    });
  }
};

// @desc    Mark payroll as paid
// @route   PUT /api/payroll/:id/pay
// @access  Private (Admin/System Admin only)
export const markPayrollAsPaid = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    const { paymentMethod, transactionId, bankDetails, amountPaid } = req.body;

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found"
      });
    }

    if (payroll.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: "Only approved payrolls can be marked as paid"
      });
    }

    // Paying more than the balance owed would leave the staff member with a
    // negative opening balance next month for no reason — refuse it rather than
    // quietly carrying the difference.
    const payable = Math.max(0, num(payroll.netSalary));
    if (amountPaid != null && amountPaid !== '' && num(amountPaid) > payable + 0.5) {
      return res.status(400).json({
        success: false,
        message: `Amount paid cannot exceed the payable balance of ${payable.toFixed(2)}.`
      });
    }

    const paymentDetails = {
      method: paymentMethod,
      transactionId,
      bankDetails,
      // Left out, markAsPaid settles the whole payable balance. A part payment
      // settles only that much and the rest carries into the next month.
      ...(amountPaid != null && amountPaid !== '' ? { amountPaid: num(amountPaid) } : {}),
    };

    payroll.markAsPaid(paymentDetails, req.user?._id || null);
    await payroll.save();

    // Post the salary payment to the accounting ledger as an expense.
    await payroll.populate('staff', 'firstName lastName profile.employeeId');
    await syncPayrollExpense(payroll);

    res.status(200).json({
      success: true,
      message: "Payroll marked as paid successfully",
      data: payroll
    });
  } catch (error) {
    console.error('Mark payroll as paid error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while marking payroll as paid"
    });
  }
};

// @desc    Get payroll summary
// @route   GET /api/payroll/summary
// @access  Private (Admin/System Admin only)
export const getPayrollSummary = async (req, res) => {
  try {
    if (!(await canManagePayroll(req))) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const summary = await Payroll.getPayrollSummary(targetMonth, targetYear);

    // Next salary pay day (Settings → Operations → Payroll): the upcoming
    // occurrence of the configured pay day, plus how many days away it is.
    const { payroll: payCfg } = await getOps();
    const pd = Math.min(Math.max(Number(payCfg.payDay) || 1, 1), 28);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let nextPayDate = new Date(now.getFullYear(), now.getMonth(), pd);
    if (now.getDate() > pd) nextPayDate = new Date(now.getFullYear(), now.getMonth() + 1, pd);
    const daysUntilPayDay = Math.round((nextPayDate - todayMidnight) / 86400000);

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        summary,
        payDay: pd,
        nextPayDate,
        daysUntilPayDay
      }
    });
  } catch (error) {
    console.error('Get payroll summary error:', error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payroll summary"
    });
  }
};
