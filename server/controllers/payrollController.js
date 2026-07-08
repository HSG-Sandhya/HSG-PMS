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

// Scheduled salary pay date for a payroll period: the configured pay day of the
// month FOLLOWING the period (salary paid in arrears). payrollPeriod.month is
// 1-indexed, so passing it straight to Date() lands on the next month. Clamped
// to 28 so it never rolls over a short month.
const scheduledPayDate = (payrollPeriod, payDay) => {
  const day = Math.min(Math.max(Number(payDay) || 1, 1), 28);
  return new Date(payrollPeriod.year, payrollPeriod.month, day);
};

// Helper function to check if user can manage payroll
const canManagePayroll = (user) => {
  // Require proper authentication - no bypass
  if (!user) return false;
  
  // Check system admin flag (handle both boolean and string values)
  if (user.isSystemAdmin === true || user.isSystemAdmin === 'true') return true;
  
  // Check role name (from JWT token)
  if (user.roleName && ['Admin', 'System Administrator'].includes(user.roleName)) return true;
  
  // Check role object (if populated)
  if (user.role && user.role.name && ['Admin', 'System Administrator'].includes(user.role.name)) return true;
  
  // Check permissions array
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.includes('manage_payroll') || 
        user.permissions.includes('manage_staff') ||
        user.permissions.includes('admin_access')) {
      return true;
    }
  }
  
  return false;
};

// @desc    Generate payroll for staff
// @route   POST /api/payroll/generate
// @access  Private (Admin/System Admin only)
export const generatePayroll = async (req, res) => {
  try {
    if (!canManagePayroll(req.user)) {
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

    if (existingPayroll) {
      return res.status(400).json({
        success: false,
        message: `Payroll already exists for this staff member for ${month}/${year}. Please check the payroll management section.`,
        data: {
          existingPayrollId: existingPayroll._id,
          status: existingPayroll.status,
          createdAt: existingPayroll.createdAt
        }
      });
    }

    const payroll = await Payroll.generateForStaff(staffId, month, year);
    payroll.calculatedBy = req.user?._id || null;
    await payroll.save();

    await payroll.populate([
      { path: 'staff', select: 'firstName lastName profile.employeeId' },
      { path: 'calculatedBy', select: 'firstName lastName' }
    ]);

    res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
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

// @desc    Get all payrolls
// @route   GET /api/payroll
// @access  Private (Admin/System Admin only)
export const getAllPayrolls = async (req, res) => {
  try {
    if (!canManagePayroll(req.user)) {
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
    if (!canManagePayroll(req.user)) {
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

    // Fetch real staff advance and recharge data for the payroll period
    let totalAdvanceAmount = 0;
    let totalRechargeAmount = 0;

    try {
      // Get advance transactions for this staff in the payroll period
      const advanceTransactions = await StaffTransaction.find({
        staff: payroll.staff._id,
        type: 'advance',
        date: {
          $gte: payroll.payrollPeriod.startDate,
          $lte: payroll.payrollPeriod.endDate
        }
      });

      totalAdvanceAmount = advanceTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

      // Get recharge transactions for this staff in the payroll period
      const rechargeTransactions = await StaffRecharge.find({
        staff: payroll.staff._id,
        date: {
          $gte: payroll.payrollPeriod.startDate,
          $lte: payroll.payrollPeriod.endDate
        }
      });

      totalRechargeAmount = rechargeTransactions.reduce((sum, recharge) => sum + recharge.amount, 0);

    } catch (error) {
      console.log('Could not fetch advance/recharge data:', error);
    }

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
    const paidDate = payroll.payment?.paidDate;
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

    const dedAll = [
      ['Advance Payment', totalAdvanceAmount, true],
      ['Mobile Recharge', totalRechargeAmount, true],
      ['Provident Fund', payroll.deductions.pf],
      ['ESI', payroll.deductions.esi],
      ['TDS', payroll.deductions.tds],
      ['Absent Deduction', payroll.deductions.absentDeduction],
      ['Late Deduction', payroll.deductions.lateDeduction],
      ['Loan', payroll.deductions.loan],
      ['Other Deductions', payroll.deductions.other],
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

    // ---- Net salary band ----
    const netSalary = totalEarnings - totalDeductions;
    const netGrad = doc.linearGradient(PAGE_X, currentY, PAGE_X + PAGE_W, currentY + 54);
    netGrad.stop(0, green).stop(1, greenLite);
    doc.roundedRect(PAGE_X, currentY, PAGE_W, 54, 10).fill(netGrad);
    doc.fillColor(white).font('Helvetica-Bold').fontSize(13)
      .text('NET SALARY', PAGE_X + 18, currentY + 13);
    doc.fillColor('#D1FAE5').font('Helvetica').fontSize(8.5)
      .text(`Payable for ${payroll.payrollPeriodDisplay}`, PAGE_X + 18, currentY + 31);
    doc.fillColor(white).font('Helvetica-Bold').fontSize(20)
      .text(fmt(netSalary), PAGE_X, currentY + 17, { width: PAGE_W - 18, align: 'right' });
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
// @access  Private (Admin/System Admin only)
export const approvePayroll = async (req, res) => {
  try {
    if (!canManagePayroll(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
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
    if (!canManagePayroll(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Access denied."
      });
    }

    const { paymentMethod, transactionId, bankDetails } = req.body;

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

    const paymentDetails = {
      method: paymentMethod,
      transactionId,
      bankDetails
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
    if (!canManagePayroll(req.user)) {
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
