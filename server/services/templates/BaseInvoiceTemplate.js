/**
 * Base Invoice Template Class
 * Provides common functionality for all invoice templates
 */
class BaseInvoiceTemplate {
  constructor() {
    this.templateName = 'BaseTemplate';
    this.version = '1.0.0';
  }

  /**
   * Get default hotel information
   * @returns {Object} Default hotel information
   */
  getDefaultHotelInfo() {
    return {
      name: 'Hotel Sandhya Grand & Marriage Hall',
      contact: {
        phone: '9431419106',
        email: 'info@sandhyagrand.com'
      },
      address: 'Bari Bazaar, Near Punjab National Bank, Town Hall, Munger, Bihar, 811201',
      gstin: '10ASQPM7914B3ZW'
    };
  }

  /**
   * Format currency amount
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  }

  /**
   * Format date
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-GB');
    } catch (error) {
      return 'N/A';
    }
  }

  /**
   * Format time from 24-hour to 12-hour format
   * @param {string} time - Time in HH:MM format
   * @returns {string} Formatted time string
   */
  formatTime(time) {
    if (!time) return 'N/A';
    
    try {
      if (time.includes(':') && !time.includes('AM') && !time.includes('PM')) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      }
      return time; // Return as-is if already formatted
    } catch (error) {
      return time;
    }
  }

  /**
   * Get common CSS styles for invoice templates
   * @returns {string} CSS styles
   */
  getCommonStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.4;
        color: #333;
        background: #fff;
        margin: 0;
        padding: 0;
      }
      
      .invoice-container {
        max-width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 8mm;
        border: none;
        background: #fff;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        font-size: 12px;
      }
      
      @media print {
        body { 
          margin: 0; 
          padding: 0; 
        }
        .invoice-container { 
          margin: 0;
          padding: 10mm;
          border: none;
          border-radius: 0;
          box-shadow: none;
          max-width: none;
          min-height: auto;
          position: relative;
          overflow: hidden;
        }
        @page {
          size: A4;
          margin: 0;
        }
      }
    `;
  }

  /**
   * Generate invoice HTML - to be implemented by child classes
   * @param {Object} data - Invoice data
   * @returns {string} HTML string
   */
  generateHTML(data) {
    throw new Error('generateHTML method must be implemented by child classes');
  }

  /**
   * Validate required data - to be implemented by child classes
   * @param {Object} data - Data to validate
   * @returns {boolean} Validation result
   */
  validateData(data) {
    return true; // Base validation - always passes
  }
}

export default BaseInvoiceTemplate;
