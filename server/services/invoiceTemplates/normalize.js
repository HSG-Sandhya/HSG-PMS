const GST_RATE = 0.05; // 5% (2.5 CGST + 2.5 SGST) — base inclusive

const calculateNights = (booking) => {
  if (!booking) return 1;
  if (booking.nights) return Number(booking.nights) || 1;
  if (booking.checkIn && booking.checkOut) {
    const ms = new Date(booking.checkOut) - new Date(booking.checkIn);
    const nights = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    return nights;
  }
  return 1;
};

const buildHotelItems = (booking) => {
  const items = [];
  const totalAmount = Number(booking.totalAmount || 0);
  const nights = calculateNights(booking);
  const rate = booking.roomId?.pricePerNight
    || booking.baseAmount
    || (totalAmount && nights ? totalAmount / nights : 0);

  const roomLabel = booking.roomId?.roomNumber
    ? `Room ${booking.roomId.roomNumber}${booking.roomId.roomType ? ` · ${booking.roomId.roomType}` : ''}`
    : 'Accommodation';

  items.push({
    description: roomLabel,
    detail: `${nights} night${nights > 1 ? 's' : ''}`,
    quantity: nights,
    rate,
    amount: rate * nights,
    category: 'room',
  });

  const orders = Array.isArray(booking.restaurantOrders) ? booking.restaurantOrders : [];
  orders.forEach((order, idx) => {
    const orderLabel = order.orderNumber
      ? `Restaurant order ${order.orderNumber}`
      : `Restaurant order #${idx + 1}`;
    const detail = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : '';
    items.push({
      description: orderLabel,
      detail,
      quantity: order.items?.length || 1,
      rate: Number(order.totalAmount || 0),
      amount: Number(order.totalAmount || 0),
      category: 'restaurant',
    });
  });

  const lateFee = Number(booking.lateCheckoutFee || 0);
  if (lateFee > 0) {
    items.push({
      description: 'Late checkout fee',
      detail: '',
      quantity: 1,
      rate: lateFee,
      amount: lateFee,
      category: 'extra',
    });
  }

  return items;
};

const SIDE_MENU = [
  { value: 'paniPuri', label: 'Pani Puri', cost: 25 },
  { value: 'chaat', label: 'Chaat', cost: 25 },
  { value: 'chowmin', label: 'Chowmin', cost: 25 },
  { value: 'coldDrink', label: 'Cold Drink', cost: 25 },
  { value: 'teaDisposal', label: 'Tea (Disposal Glass)', cost: 10 },
  { value: 'teaCup', label: 'Tea (Cup)', cost: 20 },
  { value: 'coffeeDisposal', label: 'Coffee (Disposal)', cost: 20 },
  { value: 'coffeeCup', label: 'Coffee (Cup)', cost: 40 },
];

const EXTRA_MENU = [
  { value: 'paneerChilli', label: 'Paneer Chilli (2 pcs)', cost: 60 },
  { value: 'vegLollipop', label: 'Veg Lollipop (2 pcs)', cost: 60 },
  { value: 'chickenLollipop', label: 'Chicken Lollipop (2 pcs)', cost: 100 },
  { value: 'mushroomChilli', label: 'Mushroom Chilli (4 pcs)', cost: 100 },
  { value: 'babycornCrispy', label: 'Babycorn Crispy (4 pcs)', cost: 100 },
];

const MEAL_OPTIONS = [
  { value: 'standard', label: 'Standard Meals', cost: 400 },
  { value: 'chicken', label: 'Standard + Chicken', cost: 550 },
  { value: 'fish', label: 'Standard + Fish', cost: 550 },
  { value: 'mutton', label: 'Standard + Mutton', cost: 800 },
];

const buildBanquetItems = (booking) => {
  const items = [];
  const hallName = booking.hallId?.name || booking.hallName || 'Banquet Hall';

  // Venue / floor charges — prefer the explicit floorCost captured on the
  // booking form, then any hall base charge used by other flows.
  const venueAmount = Number(booking.floorCost || 0)
    || Number(booking.hallCharges || booking.baseAmount || 0);
  if (venueAmount > 0) {
    const floors = Array.isArray(booking.floorSelection)
      ? booking.floorSelection.filter((f) => f && f !== 'none')
      : [];
    items.push({
      description: floors.length ? `Venue · ${floors.join(', ')}` : hallName,
      detail: 'Venue / hall booking',
      quantity: 1,
      rate: venueAmount,
      amount: venueAmount,
      category: 'hall',
    });
  }

  // Reserved guest rooms billed apart from the floor package (banquet per-room
  // rate). roomsCost is computed + stored on the booking form.
  const roomsCost = Number(booking.roomsCost || 0);
  if (roomsCost > 0) {
    const reserved = Array.isArray(booking.rooms) ? booking.rooms.length : 0;
    const complimentary = Number(booking.complimentaryRooms || 0);
    const chargeable = Math.max(0, reserved - complimentary) || reserved || 1;
    const perRoom = Math.round(roomsCost / chargeable);
    items.push({
      description: `Reserved guest rooms · ${chargeable} room${chargeable > 1 ? 's' : ''}`,
      detail: 'Guest rooms (outside floor package)',
      quantity: chargeable,
      rate: perRoom,
      amount: roomsCost,
      category: 'rooms',
    });
  }

  // Decoration package.
  const decorationCost = Number(booking.decorationCost || 0);
  if (decorationCost > 0) {
    items.push({
      description: `Decoration${booking.decorationType ? ` · ${booking.decorationType}` : ''}`,
      detail: 'Decoration package',
      quantity: 1,
      rate: decorationCost,
      amount: decorationCost,
      category: 'decoration',
    });
  }

  // Catering packages — the source of truth for food/menu charges. Each entry
  // is priced perPlate × plates × days (falls back to the stored amount).
  const cateringItems = Array.isArray(booking.cateringItems) ? booking.cateringItems : [];
  cateringItems.forEach((it) => {
    const perPlate = Number(it.perPlate) || 0;
    const days = Number(it.days) || 1;
    // After the event the bill is finalised on the actual plates consumed; until
    // then the quoted estimate applies. actualPlates != null ⇒ finalised.
    const hasActual = it.actualPlates !== null && it.actualPlates !== undefined && it.actualPlates !== '';
    const plates = hasActual ? Number(it.actualPlates) || 0 : Number(it.plates) || 0;
    const amount = perPlate * plates * days || Number(it.amount) || 0;
    if (amount > 0 || plates > 0) {
      items.push({
        description: it.name || 'Catering Package',
        detail: `${it.category ? `${it.category} · ` : ''}${plates} plate${plates > 1 ? 's' : ''}${days > 1 ? ` × ${days} days` : ''}${hasActual ? ' · actual' : ''}`,
        quantity: plates || 1,
        rate: perPlate,
        amount,
        category: 'catering',
      });
    }
  });

  // Legacy meal package — only when no structured catering items exist, so we
  // never double-count food.
  const menu = booking.menu || {};
  if (!cateringItems.length && menu.hasMeals && menu.mealType && menu.numberOfPlates) {
    const meal = MEAL_OPTIONS.find((m) => m.value === menu.mealType);
    const plates = Number(menu.numberOfPlates) || 0;
    if (meal && plates > 0) {
      items.push({
        description: meal.label,
        detail: `${plates} plate${plates > 1 ? 's' : ''} × ${meal.cost}`,
        quantity: plates,
        rate: meal.cost,
        amount: meal.cost * plates,
        category: 'meals',
      });
    }
  }

  if (menu.side) {
    SIDE_MENU.forEach((item) => {
      const qty = Number(menu.side[item.value] || 0);
      if (qty > 0) {
        items.push({
          description: item.label,
          detail: 'Side menu',
          quantity: qty,
          rate: item.cost,
          amount: item.cost * qty,
          category: 'side',
        });
      }
    });
  }

  if (menu.extra) {
    EXTRA_MENU.forEach((item) => {
      const qty = Number(menu.extra[item.value] || 0);
      if (qty > 0) {
        items.push({
          description: item.label,
          detail: 'Extras',
          quantity: qty,
          rate: item.cost,
          amount: item.cost * qty,
          category: 'extra',
        });
      }
    });
  }

  // Photography / videography and entertainment extras (priced add-ons).
  const photo = Number(booking.photographyAmount || 0);
  if (photo > 0) {
    items.push({
      description: `Photography${booking.photographyVendor ? ` · ${booking.photographyVendor}` : ''}`,
      detail: 'Photography & videography',
      quantity: 1,
      rate: photo,
      amount: photo,
      category: 'extra',
    });
  }
  const entertainment = Number(booking.entertainmentCost || 0);
  if (entertainment > 0) {
    items.push({
      description: `Entertainment${booking.entertainmentVendor ? ` · ${booking.entertainmentVendor}` : ''}`,
      detail: 'Entertainment',
      quantity: 1,
      rate: entertainment,
      amount: entertainment,
      category: 'extra',
    });
  }

  if (!items.length) {
    items.push({
      description: hallName,
      detail: 'Banquet booking',
      quantity: 1,
      rate: Number(booking.totalAmount || 0),
      amount: Number(booking.totalAmount || 0),
      category: 'hall',
    });
  }

  return items;
};

const computeTotals = (items, booking) => {
  const itemsTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const declaredTotal = Number(booking.totalAmount || 0)
    + Number(booking.restaurantCharges || 0);
  const grandTotal = declaredTotal || itemsTotal;
  const taxable = grandTotal / (1 + GST_RATE);
  const taxAmount = grandTotal - taxable;
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;
  // Banquet bookings track money received as advanceAmount (sum of payments);
  // room bookings use paidAmount. Honour whichever is present.
  const paid = Number(booking.paidAmount || booking.amountPaid || booking.advanceAmount || 0);
  const balance = Math.max(0, grandTotal - paid);

  return {
    subtotal: Math.round(taxable * 100) / 100,
    cgst: Math.round(cgst * 100) / 100,
    sgst: Math.round(sgst * 100) / 100,
    igst: 0,
    discount: Number(booking.discount || 0),
    total: Math.round(grandTotal * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    balance: Math.round(balance * 100) / 100,
    status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
  };
};

const buildInvoiceNumber = (booking, type) => {
  if (booking.invoiceNumber) return booking.invoiceNumber;
  const prefix = type === 'banquet' ? 'BQT' : 'INV';
  const year = new Date().getFullYear();
  const seed = booking._id ? String(booking._id).slice(-6).toUpperCase() : Date.now().toString().slice(-6);
  return `${prefix}-${year}-${seed}`;
};

export const normalizeInvoiceContext = ({ booking, hotel, type, payment = null }) => {
  const safeBooking = booking || {};
  const isBanquet = type === 'banquet';
  const items = isBanquet ? buildBanquetItems(safeBooking) : buildHotelItems(safeBooking);
  const totals = computeTotals(items, safeBooking);

  const customerName = safeBooking.customerName
    || safeBooking.guestName
    || safeBooking.customerId?.name
    || (safeBooking.firstName || safeBooking.lastName
      ? `${safeBooking.firstName || ''} ${safeBooking.lastName || ''}`.trim()
      : '')
    || 'Guest';

  const customer = {
    name: customerName,
    phone: safeBooking.phone || safeBooking.customerPhone || safeBooking.customerId?.phone || '',
    email: safeBooking.email || safeBooking.customerEmail || safeBooking.customerId?.email || '',
    address: safeBooking.address || safeBooking.customerId?.address || '',
    gstin: safeBooking.customerGstin || safeBooking.customerId?.gstin || '',
  };

  const stay = !isBanquet ? {
    roomNumber: safeBooking.roomId?.roomNumber || safeBooking.roomNumber || '',
    roomType: safeBooking.roomId?.roomType || safeBooking.roomType || '',
    checkIn: safeBooking.checkIn,
    checkOut: safeBooking.checkOut,
    nights: calculateNights(safeBooking),
    adults: Number(safeBooking.adults || 1),
    children: Number(safeBooking.children || 0),
  } : null;

  const event = isBanquet ? {
    hallName: safeBooking.hallId?.name || safeBooking.hallName || '',
    date: safeBooking.eventDate || safeBooking.bookingDate,
    type: safeBooking.eventType || safeBooking.functionType || '',
    guests: safeBooking.guestCount || safeBooking.numberOfGuests || safeBooking.menu?.numberOfPlates || 0,
    startTime: safeBooking.startTime || '',
    endTime: safeBooking.endTime || '',
  } : null;

  const issuedOn = new Date();
  const dueOn = new Date(issuedOn.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    type: isBanquet ? 'banquet' : 'hotel',
    invoice: {
      number: buildInvoiceNumber(safeBooking, isBanquet ? 'banquet' : 'hotel'),
      issuedOn,
      dueOn,
    },
    hotel: {
      name: hotel?.name || 'Hotel Sandhya Grand & Marriage Hall',
      logo: hotel?.logo || '',
      address: hotel?.address || '',
      phone: hotel?.contact?.phone || '',
      email: hotel?.contact?.email || '',
      website: hotel?.contact?.website || 'www.sandhyagrand.in',
      gstin: hotel?.gstin || '',
      panNumber: hotel?.panNumber || '',
    },
    customer,
    stay,
    event,
    items,
    totals,
    // Per-booking contract terms (banquet). Shown on the quotation above the
    // standard boilerplate; blank fields are simply omitted.
    terms: isBanquet ? {
      cancellation: safeBooking.cancellationPolicy || '',
      refund: safeBooking.refundPolicy || '',
      damage: safeBooking.damageCharges || '',
      overtime: safeBooking.overtimeCharges || '',
      outsideVendor: safeBooking.outsideVendorPolicy || '',
    } : null,
    payment: payment || (safeBooking.paymentMethod ? {
      method: safeBooking.paymentMethod,
      reference: safeBooking.paymentReference || '',
      paidOn: safeBooking.paymentDate || null,
    } : null),
    notes: safeBooking.notes || safeBooking.invoiceNotes || '',
  };
};
