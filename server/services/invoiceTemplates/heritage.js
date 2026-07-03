import BanquetHallInvoiceTemplate from '../templates/BanquetHallInvoiceTemplate.js';
import HotelRoomInvoiceTemplate from '../templates/HotelRoomInvoiceTemplate.js';

export const meta = {
  id: 'heritage',
  name: 'Heritage',
  description: 'The original Sandhya invoice layout, kept for continuity.',
};

export const render = async (_ctx, { booking, hotel, type }) => {
  if (type === 'banquet') {
    const template = new BanquetHallInvoiceTemplate();
    const { sideTotal, extraTotal } = template.calculateMenuTotals(booking);
    return template.generateHTML(booking, hotel, sideTotal, extraTotal);
  }
  const template = new HotelRoomInvoiceTemplate();
  return template.generateHTML(booking, hotel);
};
