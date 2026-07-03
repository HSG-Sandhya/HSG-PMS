import ExcelJS from 'exceljs';

/**
 * Thin helpers around exceljs so report controllers stay declarative:
 * build a workbook, add styled sheets from plain column/row definitions, and
 * stream the result back as an .xlsx download.
 */

export const createWorkbook = () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hotel Sandhya Grand';
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
