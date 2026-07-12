import Booking from '../models/Booking.js';
import Order from '../models/Order.js';
import Room from '../models/Room.js';
import Settings from '../models/Settings.js';
import GuestPrintFormTemplate from './templates/GuestPrintFormTemplate.js';

class GuestPrintService {
  /**
   * Fetch hotel information from database settings
   * @returns {Object} Hotel information object
   */
  static async getHotelInfo() {
    try {
      const settings = await Settings.getSection('hotelProfile');
      
      // Extract hotel information from settings
      const hotelInfo = {
        name: settings.hotelName || 'Hotel Sandhya Grand & Marriage Hall',
        contact: {
          phone: settings.contact?.phone || '+91 9431419196',
          email: settings.contact?.email || 'reservations@sandhyagrand.in'
        },
        address: settings.address?.full || 
                 `${settings.address?.street || ''}, ${settings.address?.city || ''}, ${settings.address?.state || ''}, ${settings.address?.pincode || ''}`.replace(/^,\s*|,\s*$/g, '') ||
                 '0021, Bari Bazaar, Near Punjab National Bank, Monghyr, Bihar-811201',
        gstin: settings.businessRegistration?.gstNumber || '10ASQPM7914B3ZW'
      };
      
      return hotelInfo;
    } catch (error) {
      
      // Fallback to default hotel information
      return {
        name: 'Hotel Sandhya Grand & Marriage Hall',
        contact: {
          phone: '+91 9431419196',
          email: 'reservations@sandhyagrand.in'
        },
        address: '0021, Bari Bazaar, Near Punjab National Bank, Monghyr, Bihar-811201',
        gstin: '10ASQPM7914B3ZW'
      };
    }
  }

  /**
   * Generate guest print form for a booking
   * @param {string} bookingId - Booking ID
   * @param {Object} options - Additional options (signatures, notes, etc.)
   * @returns {string} HTML string for guest print form
   */
  static async generateGuestPrintForm(bookingId, options = {}) {
    try {
      
      // Fetch booking with room details
      const booking = await Booking.findById(bookingId)
        .populate('roomId');
      
      if (!booking) {
        throw new Error('Booking not found');
      }


      // Fetch room details if not populated
      let room = booking.roomId;
      if (!room && booking.roomId) {
        room = await Room.findById(booking.roomId);
      }

      // Fetch restaurant orders for this booking
      const restaurantOrders = await Order.find({ roomId: bookingId })
        .populate('items.itemId')
        .sort({ createdAt: 1 });


      // Fetch hotel information from database
      const hotelInfo = await this.getHotelInfo();

      // Use Guest Print Form Template
      const guestTemplate = new GuestPrintFormTemplate();
      const templateOptions = {
        ...options,
        restaurantOrders
      };
      
      const guestFormHtml = guestTemplate.generateHTML(booking, room, templateOptions, hotelInfo);
      
      return guestFormHtml;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get guest data for form generation
   * @param {string} bookingId - Booking ID
   * @returns {Object} Guest and booking data
   */
  static async getGuestData(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('roomId');

      if (!booking) {
        return null;
      }

      // Fetch restaurant orders
      const restaurantOrders = await Order.find({ roomId: bookingId })
        .populate('items.itemId')
        .sort({ createdAt: 1 });

      // Calculate restaurant charges
      const restaurantCharges = restaurantOrders.reduce((total, order) => {
        return total + (order.totalAmount || 0);
      }, 0);

      return {
        booking,
        room: booking.roomId,
        restaurantOrders,
        restaurantCharges,
        totalWithRestaurant: (booking.totalAmount || 0) + restaurantCharges
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Legacy method - for backward compatibility with database hotel info
   * @param {Object} booking - Booking data
   * @param {Object} room - Room data
   * @param {Object} options - Additional options
   * @returns {string} HTML string
   */
  static async generateGuestFormHTML(booking, room, options = {}) {
    try {
      // Try to fetch hotel info from database
      const hotelInfo = await this.getHotelInfo();
      const guestTemplate = new GuestPrintFormTemplate();
      return guestTemplate.generateHTML(booking, room, options, hotelInfo);
    } catch (error) {
      // Fallback to template default hotel info
      const guestTemplate = new GuestPrintFormTemplate();
      return guestTemplate.generateHTML(booking, room, options);
    }
  }
}

export default GuestPrintService;
