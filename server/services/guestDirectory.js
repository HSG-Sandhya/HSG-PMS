import Guest from '../models/Guest.js';
import { normalizePhone } from '../utils/phone.js';

// Single entry point for writing into the guest directory. Matching on the
// normalized phone key means the same person entered with or without a country
// code (e.g. "9872383268" vs "+91 9872383268") updates one record instead of
// spawning a duplicate. The Guest pre-hooks fill phoneKey from `phone`.
export async function upsertGuest(fields = {}) {
  // Drop empty/blank values so we never overwrite a saved field with "" and never
  // store "" into an enum field (e.g. gender) where it isn't a valid member.
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== '' && v != null)
  );
  const phoneKey = normalizePhone(clean.phone);
  if (!phoneKey) {
    // No usable phone to key on — never drop the record, just create it.
    return Guest.create(clean);
  }
  return Guest.findOneAndUpdate(
    { phoneKey },
    { $set: clean },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

export default upsertGuest;
