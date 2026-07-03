// Builds the WiFi + food-menu "welcome" message a guest receives on check-in,
// plus a ready-to-send WhatsApp (wa.me) link and the room-service menu URL the
// QR encodes. Pure/stateless so it can be unit-reasoned and reused.

// Normalise a phone number into a wa.me-friendly form: digits only, with the
// country code prefixed (wa.me wants no '+'). Indian 10-digit numbers get the
// configured country code (default 91); numbers that already include it pass through.
export const normalizeWhatsappNumber = (phone, countryCode = '91') => {
  let digits = String(phone || '').replace(/\D/g, '');
  const cc = String(countryCode || '').replace(/\D/g, '') || '91';
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  // drop a single leading trunk 0 (e.g. 09931… -> 9931…)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) return cc + digits;
  if (digits.startsWith(cc)) return digits;
  return digits;
};

// Does a room number match a "rooms covered" spec? The spec may be an array
// (room picker) or a string with rooms separated by commas, spaces or newlines,
// with or without a "Room " prefix — e.g. all of these match room "R-308":
//   ['R-308','R-309'] · 'R-308, R-309' · 'Room R-308 Room R-309' · '306-310' · '308'
export const roomMatchesSpec = (roomNumber, spec) => {
  const rn = String(roomNumber || '').trim().toLowerCase().replace(/^room\s*/, '');
  if (!rn || spec == null || spec === '') return false;
  const rnDigits = rn.replace(/\D/g, '');
  const rnNum = rnDigits ? Number(rnDigits) : NaN;

  const tokens = (Array.isArray(spec) ? spec : String(spec).split(/[,\n]+/))
    .flatMap((s) => String(s).split(/\s+/))
    .map((s) => s.trim().toLowerCase().replace(/^room\s*/, ''))
    .filter((s) => s && s !== 'room');

  return tokens.some((tok) => {
    const m = tok.match(/^(\d+)\s*-\s*(\d+)$/); // numeric range, e.g. 101-110
    if (m && Number.isFinite(rnNum)) {
      const lo = Math.min(Number(m[1]), Number(m[2]));
      const hi = Math.max(Number(m[1]), Number(m[2]));
      return rnNum >= lo && rnNum <= hi;
    }
    if (tok === rn) return true; // exact, e.g. 'r-308' === 'r-308'
    // forgiving numeric match: bare '308' also matches room 'R-308'
    return /^\d+$/.test(tok) && Number.isFinite(rnNum) && Number(tok) === rnNum;
  });
};

// Choose the WiFi network nearest to a room: first network whose room list
// matches, else the one flagged default, else the first; falls back to the
// legacy single ssid/password when no networks are configured.
export const pickWifi = (roomNumber, gm = {}) => {
  const nets = Array.isArray(gm.wifiNetworks)
    ? gm.wifiNetworks.filter((n) => n && (n.ssid || n.password))
    : [];
  if (nets.length) {
    const matched = nets.find((n) => roomMatchesSpec(roomNumber, n.rooms));
    const chosen = matched || nets.find((n) => n.isDefault) || nets[0];
    return { ssid: (chosen.ssid || '').trim(), password: (chosen.password || '').trim(), matched: !!matched };
  }
  return { ssid: (gm.wifiSsid || '').trim(), password: (gm.wifiPassword || '').trim(), matched: false };
};

const roomNumberOf = (booking, room) =>
  room?.roomNumber
  || booking?.roomNumber
  || (typeof booking?.roomId === 'object' ? booking?.roomId?.roomNumber : '')
  || '';

const applyTemplate = (tpl, vars) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));

export const buildGuestWelcome = ({ booking, room, settings }) => {
  const gm = settings?.guestMessaging || {};
  const hotelName = settings?.hotelProfile?.hotelName || settings?.hotelName || 'our hotel';
  const guestName = (booking?.guestName || '').trim() || 'Guest';
  const roomNumber = roomNumberOf(booking, room);

  const base = String(gm.websiteBaseUrl || '').trim().replace(/\/+$/, '');
  const websiteConfigured = !!base;
  const origin = base || (typeof window !== 'undefined' ? window.location.origin : '');
  const menuUrl = roomNumber ? `${origin}/room-service/${roomNumber}` : `${origin}/room-service`;

  const wifi = pickWifi(roomNumber, gm);
  const wifiSsid = wifi.ssid;
  const wifiPassword = wifi.password;
  const wifiConfigured = !!(wifiSsid || wifiPassword);
  const wifiMatched = wifi.matched;

  const vars = { guestName, hotelName, roomNumber, wifiSsid, wifiPassword, menuUrl };

  let message;
  if (gm.messageTemplate && gm.messageTemplate.trim()) {
    message = applyTemplate(gm.messageTemplate, vars);
  } else {
    const lines = [`Namaste ${guestName}! 🙏 Welcome to ${hotelName}.`, ''];
    if (wifiConfigured) {
      lines.push('📶 WiFi access for your stay:');
      if (wifiSsid) lines.push(`   Network: ${wifiSsid}`);
      if (wifiPassword) lines.push(`   Password: ${wifiPassword}`);
      lines.push('');
    }
    lines.push('🍽️ Our food menu & room service — browse and order right from your phone:');
    lines.push(menuUrl);
    lines.push('');
    lines.push('Need anything? Just reply to this message. Enjoy your stay!');
    message = lines.join('\n');
  }

  const phoneDigits = normalizeWhatsappNumber(booking?.phone, gm.countryCode);
  const waLink = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
    : '';

  return { roomNumber, menuUrl, message, waLink, phoneDigits, wifiSsid, wifiPassword, wifiConfigured, wifiMatched, websiteConfigured };
};
