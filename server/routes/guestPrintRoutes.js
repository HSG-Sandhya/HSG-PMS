import express from 'express';
import { objectIdParam } from '../middleware/validateObjectId.js';
import GuestPrintService from '../services/guestPrintService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Malformed :bookingId -> 400 instead of a Mongoose CastError 500.
router.param('bookingId', objectIdParam('booking ID'));

/**
 * @route GET /api/guest-print/:bookingId
 * @desc Generate guest print form HTML
 * @access Private
 */
router.get('/:bookingId', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { guestSignature, authorizedSignature, additionalNotes } = req.query;

    const options = {
      guestSignature: guestSignature || '',
      authorizedSignature: authorizedSignature || '',
      additionalNotes: additionalNotes || ''
    };

    const guestFormHtml = await GuestPrintService.generateGuestPrintForm(bookingId, options);
    
    res.set({
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    });
    
    res.send(guestFormHtml);
  } catch (error) {
    console.error('Error generating guest print form:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating guest print form',
      error: error.message
    });
  }
});

/**
 * @route POST /api/guest-print/:bookingId
 * @desc Generate guest print form HTML with POST data
 * @access Private
 */
router.post('/:bookingId', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { guestSignature, authorizedSignature, additionalNotes } = req.body;

    const options = {
      guestSignature: guestSignature || '',
      authorizedSignature: authorizedSignature || '',
      additionalNotes: additionalNotes || ''
    };

    const guestFormHtml = await GuestPrintService.generateGuestPrintForm(bookingId, options);
    
    res.set({
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    });
    
    res.send(guestFormHtml);
  } catch (error) {
    console.error('Error generating guest print form:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating guest print form',
      error: error.message
    });
  }
});

/**
 * @route GET /api/guest-print/data/:bookingId
 * @desc Get guest data for form generation
 * @access Private
 */
router.get('/data/:bookingId', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const guestData = await GuestPrintService.getGuestData(bookingId);
    
    if (!guestData) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    res.json({
      success: true,
      data: guestData
    });
  } catch (error) {
    console.error('Error getting guest data:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting guest data',
      error: error.message
    });
  }
});

export default router;
