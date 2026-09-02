import ExcelJS from 'exceljs';
import Settings from '../models/Settings.js';
import { currentTenantName } from '../db/tenantContext.js';

/**
 * Thin helpers around exceljs so report controllers stay declarative:
 * build a workbook, add styled sheets from plain column/row definitions, and
 * stream the result back as an .xlsx download.
 */

/**
 * The creator recorded in the file's metadata is the hotel the export belongs
 * to, not whoever the code was written for. Read from this tenant's settings,
 * falling back to the tenant registry name and then to a generic label — never
 * to another hotel's name.
 */
export const createWorkbook = async () => {
  const workbook = new ExcelJS.Workbook();
  let name = '';
  try {
    const settings = await Settings.findOne({}, { hotelProfile: 1, hotelName: 1 }).lean();
    name = settings?.hotelProfile?.hotelName || settings?.hotelName || '';
  } catch {
    name = ''; // a database hiccup must not fail an export over metadata
  }
  workbook.creator = name || currentTenantName() || 'Hotel PMS';
  workbook.created = new Date();
  return workbook;
};

/**
 * Add a worksheet from a column spec and an array of row objects.
 * @param {ExcelJS.Workbook} workbook
 * @param {string} name                       Sheet tab name.
 * @param {Array<{header:string,key:string,width?:number}>} columns
 * @param {Array<object>} rows                 Row objects keyed by column `key`.
 * @returns {ExcelJS.Worksheet}
 */
export const addSheet = (workbook, name, columns, rows = []) => {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF1F2937' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  headerRow.alignment = { vertical: 'middle' };

  rows.forEach((row) => sheet.addRow(row));
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
};

/**
 * Stream a workbook to the response as a file download.
 */
export const sendWorkbook = async (res, workbook, filename) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  await workbook.xlsx.write(res);
  res.end();
};
