import InvoiceService from '../services/invoiceService.js';

export const generateBanquetInvoice = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    // 'quotation' renders the estimate; anything else renders the tax invoice.
    const docType = req.body?.docType === 'quotation' ? 'quotation' : 'invoice';
    const invoiceHtml = await InvoiceService.generateBanquetInvoice(bookingId, docType);
    if (!invoiceHtml) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unable to generate invoice',
      });
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(invoiceHtml);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message,
    });
  }
};

export const getInvoiceData = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const invoiceData = await InvoiceService.getInvoiceData(bookingId);
    if (!invoiceData) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.json({ success: true, data: invoiceData });
  } catch (error) {
    console.error('Error getting invoice data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invoice data',
      error: error.message,
    });
  }
};
