import { useState, useEffect } from 'react';
import api from '../api';

// Set of room IDs (as strings) held by a non-cancelled banquet/marriage event
// over [checkIn, checkOut). Backed by GET /bookings/banquet-blocked, which reuses
// the exact function the server's 409 check uses — so what the UI greys out and
// what the server rejects can never disagree. Refetches whenever the dates change.
export const useBanquetBlocked = (checkIn, checkOut) => {
  const [blockedIds, setBlockedIds] = useState(() => new Set());

  useEffect(() => {
    if (!checkIn || !checkOut) { setBlockedIds(new Set()); return undefined; }
    let cancelled = false;
    api.bookings.getBanquetBlocked(checkIn, checkOut)
      .then((res) => { if (!cancelled) setBlockedIds(new Set((res.data?.blockedRoomIds || []).map(String))); })
      .catch(() => { if (!cancelled) setBlockedIds(new Set()); });
    return () => { cancelled = true; };
  }, [checkIn, checkOut]);

  return blockedIds;
};

export default useBanquetBlocked;
