/**
 * Who may see a colleague's PERSONAL detail, as opposed to just their name.
 *
 * The staff roster is the list behind several assignment pickers — housekeeping
 * task assignment, department head, the payroll screen — so the endpoints have
 * to stay reachable by people who are not HR. What they must not do is hand
 * every logged-in account, down to a cleaner, each colleague's salary, date of
 * birth, home address, emergency contact, Aadhaar number and the URLs of their
 * Aadhaar scans.
 *
 * A blanket 403 would break the pickers; returning the whole record leaks HR
 * data. So the endpoint stays open and the RECORD is reduced instead: a caller
 * without staff-detail rights gets what a picker needs and nothing more.
 *
 * Payroll and attendance grants count as staff-detail rights: those screens
 * legitimately show pay and contact data for the staff they cover.
 */
import { callerHasAnyPermission } from '../middleware/requireManage.js';

export const STAFF_DETAIL_PERMISSIONS = [
  'manage_staff', 'view_staff', 'create_staff', 'edit_staff', 'deactivate_staff',
  'manage_attendance', 'view_attendance',
  'manage_payroll', 'view_payroll',
];

export const callerMaySeeStaffDetail = (req) =>
  callerHasAnyPermission(req, STAFF_DETAIL_PERMISSIONS);

/**
 * Fields on a Staff record that a picker needs. Everything else — salary,
 * salaryType, dateOfBirth, address, emergencyContact, aadharNumber,
 * aadharFrontUrl/BackUrl/ImageUrl, performanceRating, personal phone and
 * email, bank details — is withheld.
 */
export const pickStaffSummary = (s) => ({
  _id: s._id,
  id: s.id ?? s._id,
  name: s.name,
  position: s.position,
  department: s.department,
  role: s.role,
  status: s.status,
  employeeId: s.employeeId,
  joiningDate: s.joiningDate,
  // A work photo is how a picker shows who someone is; the Aadhaar scans are not.
  photo: s.photo ?? s.avatar ?? undefined,
});

/** Reduce one document or an array of them unless the caller may see detail. */
export const limitStaffDetail = async (req, data) => {
  if (await callerMaySeeStaffDetail(req)) return data;
  const plain = (d) => (d && typeof d.toObject === 'function' ? d.toObject() : d);
  if (Array.isArray(data)) return data.map((d) => pickStaffSummary(plain(d)));
  return data ? pickStaffSummary(plain(data)) : data;
};
