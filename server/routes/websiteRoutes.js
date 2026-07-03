import express from 'express';
import {
  getPublicMenu,
  getPublicCategories,
  getBanquetHalls,
  getBanquetHallById,
  createBanquetBooking,
  getAvailability,
  getRoomTypes,
  getRoomTypeById,
  createRoomBooking,
  getBookingStatus,
  submitContact,
  getSpecialOffers,
  getHotelInfo,
  getGallery,
  getAmenities,
  getServices,
  getRoomsForWebsite,
  createRestaurantOrder,
  getRoomServiceContext,
  createRoomServiceOrder,
  getRoomServiceOrders,
  getPaymentConfig,
  createRazorpayOrder,
  verifyRazorpayPayment,
  processPayment,
  refundPayment,
  getPaymentDetails,
  handleRazorpayWebhook,
} from '../controllers/websiteController.js';

const router = express.Router();

// Public restaurant
router.get('/restaurant/menu', getPublicMenu);
router.get('/restaurant/categories', getPublicCategories);

// Banquet halls
router.get('/banquet-halls', getBanquetHalls);
router.get('/banquet-halls/:id', getBanquetHallById);
router.post('/banquet-bookings', createBanquetBooking);

// Room availability / booking
router.get('/availability', getAvailability);
router.get('/room-types', getRoomTypes);
router.get('/room-types/:id', getRoomTypeById);
router.post('/bookings', createRoomBooking);
router.get('/bookings/:id/status', getBookingStatus);

// Marketing
router.post('/contact', submitContact);
router.get('/special-offers', getSpecialOffers);
router.get('/hotel-info', getHotelInfo);
router.get('/gallery', getGallery);
router.get('/amenities', getAmenities);
router.get('/services', getServices);
router.get('/rooms', getRoomsForWebsite);

// Restaurant / room service
router.post('/restaurant-order', createRestaurantOrder);
router.get('/room-service/:roomNumber', getRoomServiceContext);
router.post('/room-service/:roomNumber/order', createRoomServiceOrder);
router.get('/room-service/:roomNumber/orders', getRoomServiceOrders);

// Payment
router.get('/payment/config', getPaymentConfig);
router.post('/create-razorpay-order', createRazorpayOrder);
router.post('/verify-razorpay-payment', verifyRazorpayPayment);
router.post('/process-payment', processPayment);
router.post('/refund-payment', refundPayment);
router.get('/payment/:paymentId', getPaymentDetails);
router.post('/webhook/razorpay', handleRazorpayWebhook);

export default router;
