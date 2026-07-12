import BanquetBooking from '../models/BanquetBooking.js';
import Booking from '../models/Booking.js';
import Order from '../models/Order.js';
import Room from '../models/Room.js';
import BanquetHall from '../models/BanquetHall.js';
import Settings from '../models/Settings.js';
import BanquetHallInvoiceTemplate from './templates/BanquetHallInvoiceTemplate.js';
import HotelRoomInvoiceTemplate from './templates/HotelRoomInvoiceTemplate.js';
import { renderInvoice, DEFAULT_TEMPLATE_ID } from './invoiceTemplates/index.js';
import { renderBanquetDocument, DEFAULT_BANQUET_TEMPLATE_ID } from './invoiceTemplates/banquetIndex.js';
import { resolveLogo } from '../utils/resolveLogo.js';

class InvoiceService {
  /**
   * Fetch hotel information from database settings
   * @returns {Object} Hotel information object
   */
  static async getHotelInfo() {
    try {
      const settings = await Settings.getSection('hotelProfile');
      
      // Extract hotel information from settings
      const hotelName = settings.hotelName || 'Hotel Sandhya Grand & Marriage Hall';
      const hotelGstin = settings.businessRegistration?.gstNumber || '10ASQPM7914B3ZW';
      const restaurant = settings.restaurant || {};
      // Inline the configured logo as a data URI so it renders in the detached
      // print window (a relative /api/images/<id> URL would not resolve there).
      const logo = await resolveLogo(settings.logo || '');
      const hotelInfo = {
        name: hotelName,
        logo,
        contact: {
          phone: settings.contact?.phone || '9431419196',
          email: settings.contact?.email || 'reservations@sandhyagrand.in'
        },
        address: settings.address?.full ||
                 `${settings.address?.street || ''}, ${settings.address?.city || ''}, ${settings.address?.state || ''}, ${settings.address?.pincode || ''}`.replace(/^,\s*|,\s*$/g, '') ||
                 'Bari Bazaar, Near Punjab National Bank, Town Hall, Munger, Bihar, 811201',
        gstin: hotelGstin,
        // Food bill prints under this identity when the restaurant has its
        // own GST registration; falls back to the hotel name + GSTIN.
        restaurant: {
          name: restaurant.name || hotelName,
          gstin: restaurant.gstNumber || hotelGstin,
          fssai: restaurant.fssaiNumber || settings.businessRegistration?.fssaiNumber || '',
        },
      };

      return hotelInfo;
    } catch (error) {
      
      // Fallback to default hotel information
      return {
        name: 'Hotel Sandhya Grand & Marriage Hall',
        contact: {
          phone: '9431419196',
          email: 'reservations@sandhyagrand.in'
        },
        address: 'Bari Bazaar, Near Punjab National Bank, Town Hall, Munger, Bihar, 811201',
        gstin: '10ASQPM7914B3ZW',
        restaurant: {
          name: 'Hotel Sandhya Grand & Marriage Hall',
          gstin: '10ASQPM7914B3ZW',
          fssai: '',
        },
      };
    }
  }

  static async generateBanquetInvoice(bookingId, docType = 'invoice') {
    try {

      // Try to fetch banquet booking first (customer fields are flat on the doc).
      let booking = await BanquetBooking.findById(bookingId).populate('hallId');

      let bookingType = 'banquet';

      // If not found, try regular hotel booking
      if (!booking) {
        booking = await Booking.findById(bookingId)
          .populate('roomId');
        bookingType = 'hotel';
      }

      if (!booking) {
        throw new Error('Booking not found');
      }


      // Fetch additional data based on booking type
      if (bookingType === 'hotel') {
        // Fetch restaurant orders for hotel bookings. Exclude cancelled orders
        // so the guest is never billed for food that was cancelled.
        const restaurantOrders = await Order.find({ roomId: bookingId, status: { $ne: 'Cancelled' } })
          .populate('items.itemId')
          .sort({ createdAt: 1 });
        booking.restaurantOrders = restaurantOrders;
        
        // Calculate total restaurant charges from orders
        let totalRestaurantCharges = 0;
        restaurantOrders.forEach(order => {
          totalRestaurantCharges += order.totalAmount || 0;
        });
        booking.restaurantCharges = totalRestaurantCharges;
        
        // Ensure room data is populated if not already
        if (booking.roomId && !booking.roomId.roomNumber) {
          const roomData = await Room.findById(booking.roomId);
          if (roomData) {
            booking.roomId = roomData;
          }
        }
      } else if (bookingType === 'banquet') {
        // Ensure banquet hall data is populated if not already
        if (booking.hallId && !booking.hallId.name) {
          const hallData = await BanquetHall.findById(booking.hallId);
          if (hallData) {
            booking.hallId = hallData;
          }
        }
      }

      // Fetch hotel information from database
      const hotelInfo = await this.getHotelInfo();

      const invoiceSection = await Settings.getSection('invoice').catch(() => ({}));

      // toObject() returns only schema fields — re-attach the restaurant
      // bundle we computed above so the template sees the food bill.
      const bookingObject = typeof booking.toObject === 'function'
        ? booking.toObject()
        : { ...booking };
      if (bookingType === 'hotel') {
        bookingObject.restaurantOrders = booking.restaurantOrders || [];
        bookingObject.restaurantCharges = booking.restaurantCharges || 0;
      }

      // Banquet documents use the dedicated banquet template set; the single
      // selection renders both the quotation and the invoice (docType switches).
      if (bookingType === 'banquet') {
        const banquetTemplateId = invoiceSection?.banquetTemplate || DEFAULT_BANQUET_TEMPLATE_ID;
        return renderBanquetDocument({
          booking: bookingObject,
          hotel: hotelInfo,
          templateId: banquetTemplateId,
          docType: docType === 'quotation' ? 'quotation' : 'invoice',
        });
      }

      // Hotel/room invoices use the room template set.
      const templateId = invoiceSection?.template
        || invoiceSection?.selectedTemplate
        || DEFAULT_TEMPLATE_ID;

      return renderInvoice({
        booking: bookingObject,
        hotel: hotelInfo,
        type: bookingType,
        templateId,
      });

    } catch (error) {
      throw error;
    }
  }

  static async getInvoiceData(bookingId) {
    try {
      const booking = await BanquetBooking.findById(bookingId).populate('hallId');

      if (!booking) {
        return null;
      }

      // Ensure banquet hall data is populated if not already
      if (booking.hallId && !booking.hallId.name) {
        const hallData = await BanquetHall.findById(booking.hallId);
        if (hallData) {
          booking.hallId = hallData;
        }
      }

      // Fetch hotel information from database
      const hotelInfo = await this.getHotelInfo();

      const banquetTemplate = new BanquetHallInvoiceTemplate();
      const { sideTotal, extraTotal } = banquetTemplate.calculateMenuTotals(booking);

      return {
        booking,
        hotelInfo,
        menuTotals: {
          sideTotal,
          extraTotal
        }
      };

    } catch (error) {
      throw error;
    }
  }

  // Legacy method - now delegates to template class
  static calculateMenuTotals(booking) {
    const banquetTemplate = new BanquetHallInvoiceTemplate();
    return banquetTemplate.calculateMenuTotals(booking);
  }

  // Legacy method - now delegates to template class with database hotel info
  static async generateBanquetInvoiceHTML(booking, hotelName, hotelContact, addressLine, sideTotal, extraTotal) {
    try {
      // Try to fetch hotel info from database first, fallback to provided parameters
      let hotelInfo;
      try {
        hotelInfo = await this.getHotelInfo();
      } catch (error) {
        hotelInfo = {
          name: hotelName || 'Hotel Sandhya Grand & Marriage Hall',
          contact: hotelContact || { phone: '9431419196', email: 'reservations@sandhyagrand.in' },
          address: addressLine || 'Bari Bazaar, Near Punjab National Bank, Town Hall, Munger, Bihar, 811201',
          gstin: '10ASQPM7914B3ZW'
        };
      }
      
      const banquetTemplate = new BanquetHallInvoiceTemplate();
      return await banquetTemplate.generateHTML(booking, hotelInfo, sideTotal, extraTotal);
    } catch (error) {
      throw error;
    }
  }

  // Legacy method - now delegates to template class with database hotel info
  static async generateHotelInvoiceHTML(booking, hotelName, hotelContact, addressLine) {
    try {
      // Try to fetch hotel info from database first, fallback to provided parameters
      let hotelInfo;
      try {
        hotelInfo = await this.getHotelInfo();
      } catch (error) {
        hotelInfo = {
          name: hotelName || 'Hotel Sandhya Grand & Marriage Hall',
          contact: hotelContact || { phone: '9431419196', email: 'reservations@sandhyagrand.in' },
          address: addressLine || 'Bari Bazaar, Near Punjab National Bank, Town Hall, Munger, Bihar, 811201',
          gstin: '10ASQPM7914B3ZW'
        };
      }
      
      const hotelTemplate = new HotelRoomInvoiceTemplate();
      return hotelTemplate.generateHTML(booking, hotelInfo);
    } catch (error) {
      throw error;
    }
  }
}

export default InvoiceService;
