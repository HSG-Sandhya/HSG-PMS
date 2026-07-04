import Guest from '../models/Guest.js';
import { normalizePhone } from '../utils/phone.js';

// Single entry point for writing into the guest directory. Matching on the
// normalized phone key means the same person entered with or without a country
// code (e.g. "9872383268" vs "+91 9872383268") updates one record instead of
// spawning a duplicate. The Guest pre-hooks fill phoneKey from `phone`.
export async function upsertGuest(fields = {}) {
  const phoneKey = normalizePhone(fields.phone);
  if (!phoneKey) {
    // No usable phone to key on — never drop the record, just create it.
    return Guest.create(fields);
  }
  return Guest.findOneAndUpdate(
    { phoneKey },
    { $set: fields },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
}

export default upsertGuest;
