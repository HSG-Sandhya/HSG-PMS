import { isValidObjectId } from '../utils/validation.js';

// Express `router.param` handler factory: rejects a malformed ObjectId param
// with a clean 400 instead of letting Mongoose throw a CastError that surfaces
// as a 500 (e.g. a stray GET /api/rooms/foo).
//
// Usage: router.param('id', objectIdParam('room ID'));
export const objectIdParam = (label = 'ID') => (req, res, next, value) => {
  if (!isValidObjectId(value)) {
    return res.status(400).json({ success: false, message: `Invalid ${label}` });
  }
  next();
};

export default objectIdParam;
