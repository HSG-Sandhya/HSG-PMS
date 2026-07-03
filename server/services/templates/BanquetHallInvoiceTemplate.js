import BaseInvoiceTemplate from './BaseInvoiceTemplate.js';

/**
 * Banquet Hall Invoice Template
 * Specialized template for banquet hall bookings
 */
class BanquetHallInvoiceTemplate extends BaseInvoiceTemplate {
  constructor() {
    super();
    this.templateName = 'BanquetHallInvoice';
    this.version = '1.0.0';
  }

  /**
   * Get initials from customer name
   * @param {string} name - Customer name
   * @returns {string} Initials (e.g., "Ansh Raj" -> "AR")
   */
  getInitials(name) {
    if (!name) return 'XX';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2)
      .padEnd(2, 'X');
  }

  /**
   * Get next serial number for invoice
   * @returns {Promise<number>} Next serial number
   */
  async getNextSerialNumber() {
    try {
      // Try to get from database if available
      if (global.db && global.db.collection) {
        const counterCollection = global.db.collection('invoiceCounters');
        
        // Find and update the counter atomically (separate counter for banquet bookings)
        const result = await counterCollection.findOneAndUpdate(
          { _id: 'banquetInvoiceSerial' },
          { $inc: { sequence: 1 } },
          { 
            upsert: true, 
            returnDocument: 'after',
            projection: { sequence: 1 }
          }
        );
        
        return result.sequence || 10001;
      }
    } catch (error) {
      // Silent error handling
    }
    
    // Fallback: use timestamp-based serial for uniqueness
    const now = new Date();
    const timeSerial = now.getTime() % 100000; // Last 5 digits of timestamp
    return 10000 + timeSerial;
  }

  /**
   * Generate invoice number with format: BHB{initials}{5-digit-number}
   * @param {Object} booking - Booking data
   * @returns {Promise<string>} Invoice number
   */
  async generateInvoiceNumber(booking) {
    const prefix = 'BHB';
    const initials = this.getInitials(booking.customerName);
    
    // Get next sequential serial number (starting from 10001)
    const serialNumber = await this.getNextSerialNumber();
    const serialStr = String(serialNumber).padStart(5, '0');
    
    return `${prefix}${initials}${serialStr}`;
  }

  /**
   * Validate banquet booking data
   * @param {Object} booking - Booking data
   * @returns {boolean} Validation result
   */
  validateData(booking) {
    if (!booking) return false;
    
    // Basic validation for required fields
    const requiredFields = ['customerName', 'eventDate', 'eventType'];
    return requiredFields.every(field => booking[field]);
  }

  /**
   * Calculate menu totals for banquet booking including new combo and beverage system
   * @param {Object} booking - Booking data
   * @returns {Object} Menu totals
   */
  calculateMenuTotals(booking) {
    let sideTotal = 0;
    let extraTotal = 0;
    let comboTotal = 0;
    let beverageTotal = 0;

    const guestCount = booking.guestCount || 1;

    // Define menu items (same as client-side)
    const SIDE_MENU = [
      { label: 'Pani Puri', value: 'paniPuri', cost: 25 },
      { label: 'Chaat', value: 'chaat', cost: 25 },
      { label: 'Chowmin', value: 'chowmin', cost: 25 },
      { label: 'Cold Drink', value: 'coldDrink', cost: 25 },
      { label: 'Tea (Disposal Glass)', value: 'teaDisposal', cost: 10 },
      { label: 'Tea (Cup)', value: 'teaCup', cost: 20 },
      { label: 'Coffee (Disposal)', value: 'coffeeDisposal', cost: 20 },
      { label: 'Coffee (Cup)', value: 'coffeeCup', cost: 40 },
    ];
    
    const EXTRA_MENU = [
      { label: 'Paneer Chilli (2 pcs)', value: 'paneerChilli', cost: 60 },
      { label: 'Veg Lollipop (2 pcs)', value: 'vegLollipop', cost: 60 },
      { label: 'Chicken Lollipop (2 pcs)', value: 'chickenLollipop', cost: 100 },
      { label: 'Mushroom Chilli (4 pcs)', value: 'mushroomChilli', cost: 100 },
      { label: 'Babycorn Crispy (4 pcs)', value: 'babycornCrispy', cost: 100 },
    ];

    // Define combo and beverage menus
    const COMBO_MENU = [
      { 
        label: 'Snack Combo (Pani Puri + Chowmin + Chaat)', 
        value: 'snackCombo', 
        cost: 90, // per guest
        items: ['Pani Puri', 'Chowmin', 'Chaat']
      }
    ];

    const BEVERAGE_MENU = [
      { label: 'Cold Drink', value: 'coldDrink', cost: 25 },
      { label: 'Tea (Disposal Glass)', value: 'teaDisposal', cost: 10 },
      { label: 'Tea (Cup)', value: 'teaCup', cost: 20 },
      { label: 'Coffee (Disposal)', value: 'coffeeDisposal', cost: 20 },
      { label: 'Coffee (Cup)', value: 'coffeeCup', cost: 40 },
    ];

    // Calculate combo totals (new system)
    if (booking.menu && booking.menu.combo) {
      COMBO_MENU.forEach(item => {
        if (booking.menu.combo[item.value]) {
          comboTotal += item.cost * guestCount;
        }
      });
    }

    // Calculate beverage totals (new system)
    if (booking.menu && booking.menu.beverages) {
      BEVERAGE_MENU.forEach(item => {
        if (booking.menu.beverages[item.value]) {
          beverageTotal += item.cost * guestCount;
        }
      });
    }

    // Calculate side menu totals (backward compatibility)
    if (booking.menu && booking.menu.side) {
      SIDE_MENU.forEach(item => {
        const quantity = booking.menu.side[item.value] ? parseInt(booking.menu.side[item.value]) || 0 : 0;
        if (quantity > 0) {
          const itemTotal = item.cost * quantity * guestCount;
          sideTotal += itemTotal;
        }
      });
    }

    // Calculate extra menu totals (now calculated at invoice time based on number of plates)
    if (booking.menu && booking.menu.extra) {
      const numberOfPlates = booking.menu.numberOfPlates ? parseInt(booking.menu.numberOfPlates) || 1 : 1;
      EXTRA_MENU.forEach(item => {
        const quantity = booking.menu.extra[item.value] ? parseInt(booking.menu.extra[item.value]) || 0 : 0;
        if (quantity > 0) {
          // Calculate based on number of plates at invoice time
          const itemTotal = item.cost * quantity * numberOfPlates;
          extraTotal += itemTotal;
        }
      });
    }

    return { sideTotal, extraTotal, comboTotal, beverageTotal };
  }

  /**
{{ ... }}
   * Format menu items for display including combo and beverages
   * @param {Object} booking - Booking data
   * @returns {string} HTML string for menu items
   */
  formatMenuItems(booking) {
    let menuHTML = '';
    let sideItems = [];
    let extraItems = [];
    let comboItems = [];
    let beverageItems = [];
    
    // Define menu items
    const SIDE_MENU = [
      { label: 'Pani Puri', value: 'paniPuri', cost: 25 },
      { label: 'Chaat', value: 'chaat', cost: 25 },
      { label: 'Chowmin', value: 'chowmin', cost: 25 },
      { label: 'Cold Drink', value: 'coldDrink', cost: 25 },
      { label: 'Tea (Disposal Glass)', value: 'teaDisposal', cost: 10 },
      { label: 'Tea (Cup)', value: 'teaCup', cost: 20 },
      { label: 'Coffee (Disposal)', value: 'coffeeDisposal', cost: 20 },
      { label: 'Coffee (Cup)', value: 'coffeeCup', cost: 40 },
    ];
    
    const EXTRA_MENU = [
      { label: 'Paneer Chilli (2 pcs)', value: 'paneerChilli', cost: 60 },
      { label: 'Veg Lollipop (2 pcs)', value: 'vegLollipop', cost: 60 },
      { label: 'Chicken Lollipop (2 pcs)', value: 'chickenLollipop', cost: 100 },
      { label: 'Mushroom Chilli (4 pcs)', value: 'mushroomChilli', cost: 100 },
      { label: 'Babycorn Crispy (4 pcs)', value: 'babycornCrispy', cost: 100 },
    ];

    const COMBO_MENU = [
      { 
        label: 'Snack Combo (Pani Puri + Chowmin + Chaat)', 
        value: 'snackCombo', 
        cost: 90,
        items: ['Pani Puri', 'Chowmin', 'Chaat']
      }
    ];

    const BEVERAGE_MENU = [
      { label: 'Cold Drink', value: 'coldDrink', cost: 25 },
      { label: 'Tea (Disposal Glass)', value: 'teaDisposal', cost: 10 },
      { label: 'Tea (Cup)', value: 'teaCup', cost: 20 },
      { label: 'Coffee (Disposal)', value: 'coffeeDisposal', cost: 20 },
      { label: 'Coffee (Cup)', value: 'coffeeCup', cost: 40 },
    ];
    
    // Process combo menu
    if (booking.menu && booking.menu.combo) {
      COMBO_MENU.forEach(item => {
        if (booking.menu.combo[item.value]) {
          comboItems.push(`${item.label} (₹${item.cost} × ${booking.guestCount} guests = ₹${item.cost * booking.guestCount})`);
        }
      });
    }

    // Process beverage menu
    if (booking.menu && booking.menu.beverages) {
      BEVERAGE_MENU.forEach(item => {
        if (booking.menu.beverages[item.value]) {
          beverageItems.push(`${item.label} (₹${item.cost} × ${booking.guestCount} guests = ₹${item.cost * booking.guestCount})`);
        }
      });
    }
    
    // Process side menu (backward compatibility)
    if (booking.menu && booking.menu.side) {
      SIDE_MENU.forEach(item => {
        const quantity = booking.menu.side[item.value] ? parseInt(booking.menu.side[item.value]) || 0 : 0;
        if (quantity > 0) {
          sideItems.push(`${item.label}`);
        }
      });
    }
    
    // Process extra menu (calculated at invoice time based on number of plates)
    if (booking.menu && booking.menu.extra) {
      const numberOfPlates = booking.menu.numberOfPlates ? parseInt(booking.menu.numberOfPlates) || 1 : 1;
      EXTRA_MENU.forEach(item => {
        const quantity = booking.menu.extra[item.value] ? parseInt(booking.menu.extra[item.value]) || 0 : 0;
        if (quantity > 0) {
          const totalCost = item.cost * quantity * numberOfPlates;
          extraItems.push(`${item.label} (${quantity} × ₹${item.cost} × ${numberOfPlates} plates = ₹${totalCost})`);
        }
      });
    }
    
    // Display menu items in a 2x2 grid
    if (comboItems.length > 0 || beverageItems.length > 0 || sideItems.length > 0 || extraItems.length > 0) {
      menuHTML += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">`;
      
      // Top Left - Combo Items
      if (comboItems.length > 0) {
        menuHTML += `<div>
          <div style="margin-bottom: 4px;"><strong style="color: #10b981; font-size: 10px;">🍽️ Combo Items:</strong></div>`;
        comboItems.forEach(item => {
          menuHTML += `<div style="margin-left: 6px; margin-bottom: 1px; font-size: 8px; color: #374151;">• ${item}</div>`;
        });
        menuHTML += `</div>`;
      } else {
        menuHTML += `<div></div>`;
      }
      
      // Top Right - Beverage Items
      if (beverageItems.length > 0) {
        menuHTML += `<div>
          <div style="margin-bottom: 4px;"><strong style="color: #f59e0b; font-size: 10px;">🥤 Beverages:</strong></div>`;
        beverageItems.forEach(item => {
          menuHTML += `<div style="margin-left: 6px; margin-bottom: 1px; font-size: 8px; color: #374151;">• ${item}</div>`;
        });
        menuHTML += `</div>`;
      } else {
        menuHTML += `<div></div>`;
      }
      
      menuHTML += `</div>`;
      
      // Add legacy side and extra items if they exist
      if (sideItems.length > 0 || extraItems.length > 0) {
        menuHTML += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">`;
        
        // Bottom Left - Side Menu Items (Legacy)
        if (sideItems.length > 0) {
          menuHTML += `<div>
            <div style="margin-bottom: 4px;"><strong style="color: #6366F1; font-size: 10px;">Side Menu Items (Legacy):</strong></div>`;
          sideItems.forEach(item => {
            menuHTML += `<div style="margin-left: 6px; margin-bottom: 1px; font-size: 8px; color: #374151;">• ${item}</div>`;
          });
          menuHTML += `</div>`;
        } else {
          menuHTML += `<div></div>`;
        }
        
        // Bottom Right - Extra Menu Items
        if (extraItems.length > 0) {
          menuHTML += `<div>
            <div style="margin-bottom: 4px;"><strong style="color: #d97706; font-size: 10px;">🍴 Extra Menu Items (Invoice Time):</strong></div>`;
          extraItems.forEach(item => {
            menuHTML += `<div style="margin-left: 6px; margin-bottom: 1px; font-size: 8px; color: #374151;">• ${item}</div>`;
          });
          menuHTML += `</div>`;
        } else {
          menuHTML += `<div></div>`;
        }
        
        menuHTML += `</div>`;
      }
    }
    
    return menuHTML;
  }

  /**
   * Get banquet-specific CSS styles
   * @returns {string} CSS styles
   */
  getBanquetStyles() {
    return `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 2px solid #6366F1;
      }
      
      .hotel-info {
        flex: 1;
      }
      
      .hotel-name {
        font-size: 20px;
        font-weight: bold;
        color: #6366F1;
        margin-bottom: 3px;
      }
      
      .hotel-subtitle {
        font-size: 12px;
        color: #64748B;
        margin-bottom: 5px;
      }
      
      .hotel-details {
        font-size: 9px;
        color: #64748B;
        line-height: 1.2;
      }
      
      .invoice-info {
        text-align: right;
        font-size: 10px;
        color: #374151;
        line-height: 1.3;
      }
      
      .invoice-info div {
        margin-bottom: 2px;
      }
      
      .invoice-title {
        font-size: 16px;
        font-weight: bold;
        text-align: center;
        color: #6366F1;
        margin: 8px 0 6px 0;
        padding: 6px;
        background: rgba(99,102,241,0.1);
        border-radius: 4px;
      }
      
      .booking-details {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .detail-section {
        background: #f8fafc;
        padding: 6px;
        border-radius: 3px;
        border-left: 2px solid #6366F1;
      }
      
      .detail-section h3 {
        color: #6366F1;
        margin-bottom: 4px;
        font-size: 10px;
        font-weight: bold;
      }
      
      .detail-item {
        margin-bottom: 2px;
        font-size: 8px;
        line-height: 1.2;
      }
      
      .detail-label {
        font-weight: bold;
        color: #374151;
        display: inline-block;
        width: 60px;
      }
      
      .cost-breakdown {
        margin: 8px 0;
        background: #f8fafc;
        padding: 8px;
        border-radius: 3px;
        border: 1px solid #e5e7eb;
      }
      
      .cost-breakdown h3 {
        color: #6366F1;
        margin-bottom: 6px;
        font-size: 12px;
        text-align: center;
      }
      
      .cost-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 3px;
        padding: 2px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 9px;
        line-height: 1.2;
      }
      
      .cost-item:last-child {
        border-bottom: none;
        font-weight: bold;
        font-size: 10px;
        color: #6366F1;
        background: rgba(99,102,241,0.1);
        padding: 4px;
        border-radius: 3px;
        margin-top: 4px;
      }
      
      .footer {
        margin-top: 8px;
        text-align: center;
        padding-top: 6px;
        border-top: 1px solid #e5e7eb;
      }
      
      .thank-you {
        font-size: 11px;
        color: #6366F1;
        font-weight: bold;
        margin-bottom: 3px;
      }
      
      .footer-note {
        font-size: 8px;
        color: #64748B;
        font-style: italic;
        line-height: 1.2;
      }
      
      .watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 120px;
        font-weight: bold;
        color: rgba(99, 102, 241, 0.08);
        z-index: 0;
        pointer-events: none;
        user-select: none;
        font-family: 'Arial Black', Arial, sans-serif;
        letter-spacing: 8px;
        text-shadow: 2px 2px 4px rgba(99, 102, 241, 0.05);
      }
      
      .watermark-secondary {
        position: absolute;
        top: 30%;
        right: 15%;
        transform: rotate(15deg);
        font-size: 40px;
        font-weight: bold;
        color: rgba(99, 102, 241, 0.06);
        z-index: 0;
        pointer-events: none;
        user-select: none;
        font-family: 'Arial', sans-serif;
      }
      
      .watermark-tertiary {
        position: absolute;
        bottom: 20%;
        left: 10%;
        transform: rotate(-15deg);
        font-size: 35px;
        font-weight: bold;
        color: rgba(99, 102, 241, 0.05);
        z-index: 0;
        pointer-events: none;
        user-select: none;
        font-family: 'Arial', sans-serif;
      }
      
      .invoice-content {
        position: relative;
        z-index: 1;
      }

      @media print {
        .watermark, .watermark-secondary, .watermark-tertiary {
          opacity: 0.8;
        }
      }
    `;
  }

  /**
   * Generate banquet hall invoice HTML
   * @param {Object} booking - Booking data
   * @param {Object} hotelInfo - Hotel information
   * @param {Object} sideTotal - Side menu total
   * @param {Object} extraTotal - Extra menu total
   * @returns {string} HTML string
   */
  async generateHTML(booking, hotelInfo = null, sideTotal = 0, extraTotal = 0) {
    console.log('BanquetHallInvoiceTemplate: generateHTML called with updated template'); // Debug log
    if (!this.validateData(booking)) {
      throw new Error('Invalid booking data provided');
    }

    const hotel = hotelInfo || this.getDefaultHotelInfo();
    const { sideTotal: calculatedSideTotal, extraTotal: calculatedExtraTotal, comboTotal, beverageTotal } = this.calculateMenuTotals(booking);
    
    // Use provided totals or calculated ones
    const finalSideTotal = sideTotal || calculatedSideTotal;
    const finalExtraTotal = extraTotal || calculatedExtraTotal;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(booking);
    console.log('Generated invoice number:', invoiceNumber); // Debug log

    // Calculate base menu cost based on number of plates
    let baseCost = 0;
    if (booking.menu && booking.menu.hasMeals && booking.menu.mealType && booking.menu.numberOfPlates) {
      const numberOfPlates = parseInt(booking.menu.numberOfPlates) || 0;
      const MEAL_OPTIONS = [
        { label: 'Standard Meals', value: 'standard', cost: 400 },
        { label: 'Standard Meals + Chicken', value: 'chicken', cost: 550 },
        { label: 'Standard Meals + Fish', value: 'fish', cost: 550 },
        { label: 'Standard Meals + Mutton', value: 'mutton', cost: 800 },
      ];
      
      const selectedMeal = MEAL_OPTIONS.find(meal => meal.value === booking.menu.mealType);
      if (selectedMeal) {
        baseCost = selectedMeal.cost * numberOfPlates;
      }
    }
    
    // Update booking object with calculated base cost for template use
    booking.baseCost = baseCost;

    // Calculate menu items count for cost breakdown
    let sideItemsCount = 0;
    let extraItemsCount = 0;
    
    const SIDE_MENU = [
      { label: 'Pani Puri', value: 'paniPuri', cost: 25 },
      { label: 'Chaat', value: 'chaat', cost: 25 },
      { label: 'Chowmin', value: 'chowmin', cost: 25 },
      { label: 'Cold Drink', value: 'coldDrink', cost: 25 },
      { label: 'Tea (Disposal Glass)', value: 'teaDisposal', cost: 10 },
      { label: 'Tea (Cup)', value: 'teaCup', cost: 20 },
      { label: 'Coffee (Disposal)', value: 'coffeeDisposal', cost: 20 },
      { label: 'Coffee (Cup)', value: 'coffeeCup', cost: 40 },
    ];
    
    const EXTRA_MENU = [
      { label: 'Paneer Chilli (2 pcs)', value: 'paneerChilli', cost: 60 },
      { label: 'Veg Lollipop (2 pcs)', value: 'vegLollipop', cost: 60 },
      { label: 'Chicken Lollipop (2 pcs)', value: 'chickenLollipop', cost: 100 },
      { label: 'Mushroom Chilli (4 pcs)', value: 'mushroomChilli', cost: 100 },
      { label: 'Babycorn Crispy (4 pcs)', value: 'babycornCrispy', cost: 100 },
    ];

    // Count selected side menu items
    if (booking.menu && booking.menu.side) {
      SIDE_MENU.forEach(item => {
        const quantity = booking.menu.side[item.value] ? parseInt(booking.menu.side[item.value]) || 0 : 0;
        if (quantity > 0) {
          sideItemsCount++;
        }
      });
    }

    // Count selected extra menu items
    if (booking.menu && booking.menu.extra) {
      EXTRA_MENU.forEach(item => {
        const quantity = booking.menu.extra[item.value] ? parseInt(booking.menu.extra[item.value]) || 0 : 0;
        if (quantity > 0) {
          extraItemsCount++;
        }
      });
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Banquet Hall Booking Invoice</title>
    <style>
        ${this.getCommonStyles()}
        ${this.getBanquetStyles()}
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Creative Watermarks -->
        <div class="watermark">SANDHYA GRAND</div>
        <div class="watermark-secondary">PREMIUM</div>
        <div class="watermark-tertiary">BANQUET</div>
        
        <div class="invoice-content">
        <div class="header">
            <div class="hotel-info">
                <div class="hotel-name">${hotel.name}</div>
                <div class="hotel-subtitle">Marriage Hall & Banquet Services</div>
                <div class="hotel-details">
                    ${hotel.address ? `<div>${hotel.address}</div>` : ''}
                    ${hotel.contact.phone ? `<div>Phone: ${hotel.contact.phone}</div>` : ''}
                    ${hotel.contact.email ? `<div>Email: ${hotel.contact.email}</div>` : ''}
                    <div>Web: ${hotel.contact.website || 'www.sandhyagrand.in'}</div>
                </div>
            </div>
            <div class="invoice-info">
                ${hotel.gstin ? `<div><strong>GSTIN:</strong> ${hotel.gstin}</div>` : ''}
                <div><strong>Invoice Number:</strong> ${invoiceNumber}</div>
                <div><strong>Date:</strong> ${this.formatDate(new Date())}</div>
            </div>
        </div>
        
        <div class="invoice-title">BANQUET HALL BOOKING INVOICE</div>
        
        <div class="booking-details">
            <div class="detail-section">
                <h3>Booking Information</h3>
                <div class="detail-item">
                    <span class="detail-label">Event Date:</span>
                    ${this.formatDate(booking.eventDate)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Event Type:</span>
                    ${booking.eventType || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Guests:</span>
                    ${booking.guestCount || booking.numberOfGuests || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Start Time:</span>
                    ${this.formatTime(booking.startTime)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Event End Date:</span>
                    ${booking.eventEndDate ? this.formatDate(booking.eventEndDate) : (booking.eventDate ? this.formatDate(booking.eventDate) : 'N/A')}
                </div>
                <div class="detail-item">
                    <span class="detail-label">End Time:</span>
                    ${this.formatTime(booking.endTime)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    ${booking.status || 'Confirmed'}
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Customer Details</h3>
                <div class="detail-item">
                    <span class="detail-label">Name:</span>
                    ${booking.customerName || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone:</span>
                    ${booking.customerPhone || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Email:</span>
                    ${booking.customerEmail || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Alt Phone:</span>
                    ${booking.alternatePhone || 'N/A'}
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Floor & Services</h3>
                <div class="detail-item">
                    <span class="detail-label">Floor:</span>
                    ${booking.hallId?.floor || booking.floor || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Description:</span>
                    ${booking.hallId?.description || booking.description || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Menu Type:</span>
                    ${booking.menuType || 'N/A'}
                </div>
            </div>
        </div>
        
        ${(() => {
          const hasSelectedSideItems = booking.menu && booking.menu.side && Object.values(booking.menu.side).some(qty => parseInt(qty) > 0);
          const hasSelectedExtraItems = booking.menu && booking.menu.extra && Object.values(booking.menu.extra).some(qty => parseInt(qty) > 0);
          return (hasSelectedSideItems || hasSelectedExtraItems) ? `
        <div class="detail-section" style="margin-bottom: 6px; grid-column: 1 / -1;">
            <h3>Selected Menu Items</h3>
            <div style="background: #fff; padding: 4px; border-radius: 3px; border: 1px solid #e5e7eb; font-size: 8px; max-height: 80px; overflow-y: auto;">
                ${this.formatMenuItems(booking)}
            </div>
        </div>
        ` : '';
        })()}
        
        <div class="cost-breakdown">
            <h3>Cost Breakdown</h3>
            <div class="cost-item">
                <span>Floor Cost (first second,third fourth):</span>
                <span>${this.formatCurrency(booking.floorCost || 0)}</span>
            </div>
            <div class="cost-item">
                <span>Decoration Cost (Premium):</span>
                <span>${this.formatCurrency(booking.decorationCost || 0)}</span>
            </div>
            ${(Array.isArray(booking.cateringItems) ? booking.cateringItems : [])
    .filter((it) => it && (it.name || Number(it.perPlate) > 0 || Number(it.plates) > 0))
    .map((it) => {
      const amt = Number(it.amount) || (Number(it.perPlate) || 0) * (Number(it.plates) || 0) * (Number(it.days) || 1);
      const days = Number(it.days) || 1;
      return `<div class="cost-item">
                <span>Catering — ${it.name || 'Package'}${it.category ? ` (${it.category})` : ''} (₹${Number(it.perPlate) || 0} × ${Number(it.plates) || 0} plates${days > 1 ? ` × ${days} days` : ''}):</span>
                <span>${this.formatCurrency(amt)}</span>
            </div>`;
    }).join('')}
            <div class="cost-item">
                <span>Base Menu (₹${(() => {
                  if (booking.menu && booking.menu.mealType) {
                    const MEAL_OPTIONS = [
                      { value: 'standard', cost: 400 },
                      { value: 'chicken', cost: 550 },
                      { value: 'fish', cost: 550 },
                      { value: 'mutton', cost: 800 },
                    ];
                    const meal = MEAL_OPTIONS.find(m => m.value === booking.menu.mealType);
                    return meal ? meal.cost : 550;
                  }
                  return 550;
                })()} per plate × ${booking.menu?.numberOfPlates || 0} plates × 1 days):</span>
                <span>${this.formatCurrency(booking.baseCost || 0)}</span>
            </div>
            <div class="cost-item">
                <span>Combo Items (Calculated at Invoice Time):</span>
                <span>${this.formatCurrency(comboTotal)}</span>
            </div>
            <div class="cost-item">
                <span>Beverages (Calculated at Invoice Time):</span>
                <span>${this.formatCurrency(beverageTotal)}</span>
            </div>
            <div class="cost-item">
                <span>Side Menu Items (${sideItemsCount} items selected):</span>
                <span>${this.formatCurrency(finalSideTotal)}</span>
            </div>
            <div class="cost-item">
                <span>Extra Menu Items (Calculated at Invoice Time):</span>
                <span>${this.formatCurrency(finalExtraTotal)}</span>
            </div>
            <div class="cost-item">
                <span>Booking Total Amount:</span>
                <span>${this.formatCurrency(booking.totalAmount || 0)}</span>
            </div>
            <div class="cost-item">
                <span>Additional Items (Combo, Beverages & Extra Menu):</span>
                <span>${this.formatCurrency(comboTotal + beverageTotal + finalExtraTotal)}</span>
            </div>
            <div class="cost-item" style="background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: bold;">
                <span>Final Total Amount:</span>
                <span>${this.formatCurrency((booking.totalAmount || 0) + comboTotal + beverageTotal + finalExtraTotal)}</span>
            </div>
            <div class="cost-item">
                <span>Advance Amount:</span>
                <span>${this.formatCurrency(booking.advanceAmount || 0)}</span>
            </div>
            <div class="cost-item" style="color: #dc2626; background: rgba(220, 38, 38, 0.1);">
                <span>Remaining Amount (Including All Additional Items):</span>
                <span>${this.formatCurrency(((booking.totalAmount || 0) + comboTotal + beverageTotal + finalExtraTotal) - (booking.advanceAmount || 0))}</span>
            </div>
        </div>
        
        <div class="footer">
            <div class="thank-you">Thank you for choosing ${hotel.name}!</div>
            <div class="footer-note">
                We look forward to making your event memorable.<br>
                For any queries, please contact us at ${hotel.contact.phone || 'our reception'}.<br>
                <strong>Booking Date:</strong> ${this.formatDate(new Date())} | <strong>Invoice Generated:</strong> ${new Date().toLocaleString()}
            </div>
        </div>
        </div> <!-- End invoice-content -->
    </div>
</body>
</html>`;
  }
}

export default BanquetHallInvoiceTemplate;
