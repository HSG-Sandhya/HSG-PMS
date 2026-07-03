import api from '../api';
import { currencySym } from '../utils/billing';

// Invoice service for banquet hall + booking invoices.
// Uses the server-side renderer so the selected template applies everywhere.
class InvoiceService {
  /**
   * Print banquet hall booking invoice. Tries the server template renderer
   * first; falls back to the local HTML if the server is unreachable.
   */
  static async printBanquetInvoice(booking, paymentDetails = null, settings = {}, docType = 'invoice') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Unable to open print window. Please allow popups for this site.');
    }

    try {
      let html = null;
      if (booking?._id) {
        try {
          const response = await api.post(`/invoices/booking/${booking._id}`, {
            template: 'banquet_hall_booking',
            docType: docType === 'quotation' ? 'quotation' : 'invoice',
          });
          if (typeof response.data === 'string' && response.data.trim().length > 0) {
            html = response.data;
          }
        } catch (err) {
          console.warn('Server invoice render failed, falling back to local template', err?.message);
        }
      }
      if (!html) {
        html = this.generateBanquetInvoiceHTML(booking, paymentDetails, settings);
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      };

      return { success: true };
    } catch (error) {
      printWindow.close();
      console.error('Error printing banquet invoice:', error);
      throw error;
    }
  }

  /**
   * Generate banquet hall booking invoice HTML
   * @param {Object} booking - Booking data
   * @param {Object} paymentDetails - Payment details
   * @param {Object} settings - Hotel settings
   * @returns {string} HTML string for invoice
   */
  static generateBanquetInvoiceHTML(booking, paymentDetails, settings) {
    const hotelName = settings?.hotelProfile?.hotelName || 'Hotel Sandhya Grand';
    const hotelAddress = settings?.hotelProfile?.address || {};
    const hotelContact = settings?.hotelProfile?.contact || {};
    
    const addressLine = [
      hotelAddress.line1,
      hotelAddress.line2,
      hotelAddress.area,
      hotelAddress.city,
      hotelAddress.state,
      hotelAddress.postalCode
    ].filter(Boolean).join(', ');

    // Helper function to format menu items based on booking form structure
    const formatMenuItems = (booking) => {
      let menuHTML = '';
      let sideItems = [];
      let extraItems = [];
      
      // Define menu items from booking form
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
      
      // Process side menu from booking.menu.side object
      if (booking.menu && booking.menu.side) {
        SIDE_MENU.forEach(item => {
          const quantity = booking.menu.side[item.value] ? parseInt(booking.menu.side[item.value]) || 0 : 0;
          if (quantity > 0) {
            sideItems.push(`${item.label}`);
          }
        });
      }
      
      // Process extra menu from booking.menu.extra object
      if (booking.menu && booking.menu.extra) {
        EXTRA_MENU.forEach(item => {
          const quantity = booking.menu.extra[item.value] ? parseInt(booking.menu.extra[item.value]) || 0 : 0;
          if (quantity > 0) {
            extraItems.push(`${item.label}`);
          }
        });
      }
      
      // Display menu items side by side
      if (sideItems.length > 0 || extraItems.length > 0) {
        menuHTML += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">`;
        
        // Left column - Side Menu Items
        if (sideItems.length > 0) {
          menuHTML += `<div>
            <div style="margin-bottom: 4px;"><strong style="color: var(--app-primary); font-size: 10px;">Side Menu Items:</strong></div>`;
          sideItems.forEach(item => {
            menuHTML += `<div style="margin-left: 6px; margin-bottom: 1px; font-size: 8px; color: #374151;">• ${item}</div>`;
          });
          menuHTML += `</div>`;
        } else {
          menuHTML += `<div></div>`;
        }
        
        // Right column - Extra Menu Items
        if (extraItems.length > 0) {
          menuHTML += `<div>
            <div style="margin-bottom: 4px;"><strong style="color: var(--app-primary); font-size: 10px;">Extra Menu Items:</strong></div>`;
          extraItems.forEach(item => {
            menuHTML += `<div style="margin-left: 6px; margin-bottom: 1px; font-size: 8px; color: #374151;">• ${item}</div>`;
          });
          menuHTML += `</div>`;
        } else {
          menuHTML += `<div></div>`;
        }
        
        menuHTML += `</div>`;
      }
      
      return menuHTML || '<div style="font-style: italic; color: #64748B; font-size: 10px;">No menu items selected</div>';
    };
    
    // Helper function to calculate menu totals based on booking structure
    const calculateMenuTotals = (booking) => {
      let sideTotal = 0;
      let extraTotal = 0;
      let sideItemCount = 0;
      let extraItemCount = 0;
      
      // Define menu items from booking form
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
      
      // Calculate side menu totals
      if (booking.menu && booking.menu.side) {
        SIDE_MENU.forEach(item => {
          const quantity = booking.menu.side[item.value] ? parseInt(booking.menu.side[item.value]) || 0 : 0;
          if (quantity > 0) {
            const itemTotal = item.cost * quantity * (booking.guestCount || 1);
            sideTotal += itemTotal;
            sideItemCount++;
          }
        });
      }
      
      // Calculate extra menu totals using numberOfPlates
      if (booking.menu && booking.menu.extra) {
        const numberOfPlates = (booking.menu?.numberOfPlates && parseInt(booking.menu.numberOfPlates) > 0) 
          ? parseInt(booking.menu.numberOfPlates) 
          : booking.guestCount || 1;
        EXTRA_MENU.forEach(item => {
          const quantity = booking.menu.extra[item.value] ? parseInt(booking.menu.extra[item.value]) || 0 : 0;
          if (quantity > 0) {
            const itemTotal = item.cost * quantity * numberOfPlates;
            extraTotal += itemTotal;
            extraItemCount++;
          }
        });
      }
      
      return { 
        sideTotal, 
        extraTotal, 
        sideItemCount,
        extraItemCount,
        totalMenuItems: sideTotal + extraTotal 
      };
    };

    // Helper function to format additional services
    const formatAdditionalServices = (services) => {
      if (!services || !Array.isArray(services) || services.length === 0) {
        return '<div style="font-style: italic; color: #64748B;">No additional services</div>';
      }
      
      return services.map(service => `
        <div style="padding: 4px 0;">• ${typeof service === 'string' ? service : service.name || service}</div>
      `).join('');
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Banquet Hall Booking Invoice</title>
    <style>
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
            padding: 12mm;
            border: none;
            background: #fff;
            box-sizing: border-box;
        }
        
        .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid var(--app-primary);
        }
        
        .hotel-name {
            font-size: 24px;
            font-weight: bold;
            color: var(--app-primary);
            margin-bottom: 5px;
        }
        
        .hotel-subtitle {
            font-size: 14px;
            color: #64748B;
            margin-bottom: 8px;
        }
        
        .hotel-details {
            font-size: 11px;
            color: #64748B;
            line-height: 1.3;
        }
        
        .invoice-title {
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            color: var(--app-primary);
            margin: 15px 0 10px 0;
            padding: 8px;
            background: rgba(var(--app-primary-rgb),0.1);
            border-radius: 4px;
        }
        
        .booking-details {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .detail-section {
            background: #f8fafc;
            padding: 8px;
            border-radius: 4px;
            border-left: 3px solid var(--app-primary);
        }
        
        .detail-section h3 {
            color: var(--app-primary);
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .detail-item {
            margin-bottom: 3px;
            font-size: 10px;
        }
        
        .detail-label {
            font-weight: bold;
            color: #374151;
            display: inline-block;
            width: 70px;
        }
        
        .cost-breakdown {
            margin: 15px 0;
            background: #f8fafc;
            padding: 12px;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
        }
        
        .cost-breakdown h3 {
            color: var(--app-primary);
            margin-bottom: 10px;
            font-size: 14px;
            text-align: center;
        }
        
        .cost-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            padding: 4px 0;
            border-bottom: 1px solid #e5e7eb;
            font-size: 11px;
        }
        
        .cost-item:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 13px;
            color: var(--app-primary);
            background: rgba(var(--app-primary-rgb),0.1);
            padding: 8px;
            border-radius: 4px;
            margin-top: 8px;
        }
        
        .footer {
            margin-top: 15px;
            text-align: center;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
        }
        
        .thank-you {
            font-size: 13px;
            color: var(--app-primary);
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .footer-note {
            font-size: 10px;
            color: #64748B;
            font-style: italic;
        }
        
        .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            font-weight: bold;
            color: rgba(var(--app-primary-rgb), 0.08);
            z-index: 0;
            pointer-events: none;
            user-select: none;
            font-family: 'Arial Black', Arial, sans-serif;
            letter-spacing: 8px;
            text-shadow: 2px 2px 4px rgba(var(--app-primary-rgb), 0.05);
        }
        
        .watermark-secondary {
            position: absolute;
            top: 30%;
            right: 15%;
            transform: rotate(15deg);
            font-size: 40px;
            font-weight: bold;
            color: rgba(var(--app-primary-rgb), 0.06);
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
            color: rgba(var(--app-primary-rgb), 0.05);
            z-index: 0;
            pointer-events: none;
            user-select: none;
            font-family: 'Arial', sans-serif;
        }
        
        .invoice-container {
            position: relative;
            overflow: hidden;
        }
        
        .invoice-content {
            position: relative;
            z-index: 1;
        }

        @media print {
            body { margin: 0; }
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
            .watermark, .watermark-secondary, .watermark-tertiary {
                opacity: 0.8;
            }
            @page {
                size: A4;
                margin: 0;
            }
        }
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
            <div class="hotel-name">${hotelName}</div>
            <div class="hotel-subtitle">Marriage Hall & Banquet Services</div>
            <div class="hotel-details">
                ${addressLine ? `<div>${addressLine}</div>` : ''}
                ${hotelContact.phone ? `<div>Phone: ${hotelContact.phone}</div>` : ''}
                ${hotelContact.email ? `<div>Email: ${hotelContact.email}</div>` : ''}
            </div>
        </div>
        
        <div class="invoice-title">BANQUET HALL BOOKING INVOICE</div>
        
        <div class="booking-details">
            <div class="detail-section">
                <h3>Booking Information</h3>
                <div class="detail-item">
                    <span class="detail-label">Event Date:</span>
                    ${booking.eventDate ? new Date(booking.eventDate).toLocaleDateString() : 'N/A'}
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
                    ${booking.startTime || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Event End Date:</span>
                    ${booking.eventEndDate ? new Date(booking.eventEndDate).toLocaleDateString() : (booking.eventDate ? new Date(booking.eventDate).toLocaleDateString() : 'N/A')}
                </div>
                <div class="detail-item">
                    <span class="detail-label">End Time:</span>
                    ${booking.endTime || 'N/A'}
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
                    ${booking.floorSelection || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Decoration:</span>
                    ${booking.decorationType || booking.decorationPackage || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Menu Type:</span>
                    ${booking.menuType || 'Standard Meals + Mutton'}
                </div>
                ${booking.specialRequests ? `
                <div class="detail-item">
                    <span class="detail-label">Special:</span>
                    ${booking.specialRequests.substring(0, 50)}${booking.specialRequests.length > 50 ? '...' : ''}
                </div>
                ` : ''}
            </div>
        </div>
        
        ${(() => {
          const hasSelectedSideItems = booking.menu && booking.menu.side && Object.values(booking.menu.side).some(qty => parseInt(qty) > 0);
          const hasSelectedExtraItems = booking.menu && booking.menu.extra && Object.values(booking.menu.extra).some(qty => parseInt(qty) > 0);
          return (hasSelectedSideItems || hasSelectedExtraItems) ? `
        <div class="detail-section" style="margin-bottom: 12px; grid-column: 1 / -1;">
            <h3>Selected Menu Items</h3>
            <div style="background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb; font-size: 10px; max-height: 120px; overflow-y: auto;">
                ${formatMenuItems(booking)}
            </div>
        </div>
        ` : '';
        })()}
        
        ${booking.decorationDetails ? `
        <div class="detail-section" style="margin-bottom: 30px; grid-column: 1 / -1;">
            <h3>Decoration Details</h3>
            <div style="background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                <div class="detail-item">
                    <span class="detail-label">Package:</span>
                    ${booking.decorationPackage || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Theme:</span>
                    ${booking.decorationTheme || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Colors:</span>
                    ${booking.decorationColors || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Special Items:</span>
                    ${booking.decorationSpecialItems || 'N/A'}
                </div>
            </div>
        </div>
        ` : ''}
        
        ${booking.cateringDetails ? `
        <div class="detail-section" style="margin-bottom: 30px; grid-column: 1 / -1;">
            <h3>Catering Details</h3>
            <div style="background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                <div class="detail-item">
                    <span class="detail-label">Package:</span>
                    ${booking.cateringPackage || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Cuisine Type:</span>
                    ${booking.cuisineType || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Service Style:</span>
                    ${booking.serviceStyle || 'N/A'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Special Dietary:</span>
                    ${booking.specialDietary || 'None'}
                </div>
            </div>
        </div>
        ` : ''}
        
        ${booking.additionalServices && booking.additionalServices.length > 0 ? `
        <div class="detail-section" style="margin-bottom: 30px; grid-column: 1 / -1;">
            <h3>Additional Services</h3>
            <div style="background: #fff; padding: 15px; border-radius: 6px; border: 1px solid #e5e7eb;">
                ${formatAdditionalServices(booking.additionalServices)}
            </div>
        </div>
        ` : ''}
        
        <div class="cost-breakdown">
            <h3>💰 Detailed Cost Breakdown</h3>
            <div style="background: #f8fafc; padding: 8px; border-radius: 4px; margin-bottom: 10px; border-left: 3px solid var(--app-primary);">
              <div style="font-size: 11px; color: var(--app-primary); font-weight: bold; margin-bottom: 4px;">📋 Booking Time Costs (Fixed at booking)</div>
            </div>
            ${booking.floorCost ? `
            <div class="cost-item">
                <span>Floor Cost (${booking.floorSelection || 'Selected Floor'}):</span>
                <span>${currencySym()}${booking.floorCost?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${booking.decorationCost || booking.decorationType || booking.decorationPackage ? `
            <div class="cost-item">
                <span>Decoration Cost (${booking.decorationPackage || booking.decorationType || 'Package'}):</span>
                <span>${currencySym()}${(booking.decorationCost || booking.decorationPrice || 25000)?.toLocaleString()}</span>
            </div>
            ` : ''}
            ${booking.menuCost ? `
            <div class="cost-item">
                <span>Base Menu - Booking Time (Guest-based calculation):</span>
                <span>${currencySym()}${booking.menuCost?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            <div style="background: #f0fdf4; padding: 8px; border-radius: 4px; margin: 10px 0; border-left: 3px solid #10b981;">
              <div style="font-size: 11px; color: #10b981; font-weight: bold; margin-bottom: 4px;">🍽️ Invoice Time Costs (Calculated at invoice generation)</div>
            </div>
            ${booking.menuCost ? `
            ${(() => {
              // Calculate base menu cost using numberOfPlates
              let numberOfPlates = 0;
              let displayText = '';
              
              if (booking.menu?.numberOfPlates && parseInt(booking.menu.numberOfPlates) > 0) {
                // New booking with numberOfPlates field
                numberOfPlates = parseInt(booking.menu.numberOfPlates);
                displayText = `${numberOfPlates} plates`;
              } else {
                // Legacy booking without numberOfPlates - show warning and use guest count
                numberOfPlates = booking.guestCount || 0;
                displayText = `${numberOfPlates} guests (Legacy - Please update booking to specify plates)`;
              }
              
              const mealType = booking.menu?.mealType || 'chicken';
              
              // Define meal costs to match frontend
              const MEAL_OPTIONS = [
                { value: 'standard', cost: 400 },
                { value: 'chicken', cost: 550 },
                { value: 'fish', cost: 550 },
                { value: 'mutton', cost: 800 },
              ];
              
              const selectedMeal = MEAL_OPTIONS.find(meal => meal.value === mealType);
              const perPlateRate = selectedMeal ? selectedMeal.cost : 550;
              const baseCost = perPlateRate * numberOfPlates * (booking.days || 1);
              
              return `
              <div class="cost-item" style="background: #f0fdf4; border-left: 3px solid #10b981; padding: 8px; margin: 4px 0;">
                <span><strong>Base Menu - Invoice Time (${currencySym()}${perPlateRate} per plate × ${displayText} × ${booking.days || '1'} days):</strong></span>
                <span style="color: #10b981; font-weight: bold;">${currencySym()}${baseCost.toLocaleString()}</span>
              </div>
              `;
            })()}
            ` : ''}
            ${(() => {
              const menuTotals = calculateMenuTotals(booking);
              return menuTotals.sideTotal > 0 ? `
              <div class="cost-item">
                <span>Side Menu Items (${menuTotals.sideItemCount} items selected):</span>
                <span>${currencySym()}${menuTotals.sideTotal.toLocaleString()}</span>
              </div>
              ` : '';
            })()}
            ${(() => {
              const menuTotals = calculateMenuTotals(booking);
              return menuTotals.extraTotal > 0 ? `
              <div class="cost-item">
                <span>Extra Menu Items (${menuTotals.extraItemCount} items selected):</span>
                <span>${currencySym()}${menuTotals.extraTotal.toLocaleString()}</span>
              </div>
              ` : '';
            })()}
            ${booking.entertainmentCost ? `
            <div class="cost-item">
                <span>Entertainment Services:</span>
                <span>${currencySym()}${booking.entertainmentCost?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${(booking.photographyAmount || booking.photographyCost) ? `
            <div class="cost-item">
                <span>Photography & Videography${booking.photographyVendor ? ` (${booking.photographyVendor})` : ''}:</span>
                <span>${currencySym()}${(booking.photographyAmount || booking.photographyCost)?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${booking.transportationCost ? `
            <div class="cost-item">
                <span>Transportation Services:</span>
                <span>${currencySym()}${booking.transportationCost?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${booking.additionalServices && booking.additionalServices.length > 0 ? `
            <div class="cost-item">
                <span>Additional Services:</span>
                <span style="font-weight: normal; font-size: 11px; color: #475569;">${booking.additionalServices.join(', ')}</span>
            </div>
            ` : ''}
            ${booking.discount ? `
            <div class="cost-item" style="color: #059669;">
                <span>Discount Applied:</span>
                <span>-${currencySym()}${booking.discount?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${booking.taxes ? `
            <div class="cost-item">
                <span>Taxes & Service Charges:</span>
                <span>${currencySym()}${booking.taxes?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${booking.advancePaid ? `
            <div class="cost-item" style="color: #059669;">
                <span>Advance Paid:</span>
                <span>-${currencySym()}${booking.advancePaid?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            <div class="cost-item">
                <span><strong>Total Amount:</strong></span>
                <span><strong>${currencySym()}${booking.totalAmount?.toLocaleString() || booking.totalCost?.toLocaleString() || '0'}</strong></span>
            </div>
            ${booking.advanceAmount ? `
            <div class="cost-item" style="color: #059669;">
                <span>Advance Amount:</span>
                <span>${currencySym()}${booking.advanceAmount?.toLocaleString() || '0'}</span>
            </div>
            ` : ''}
            ${booking.remainingAmount ? `
            <div class="cost-item" style="background: rgba(239, 68, 68, 0.1); color: #dc2626;">
                <span><strong>Remaining Amount:</strong></span>
                <span><strong>${currencySym()}${booking.remainingAmount?.toLocaleString() || '0'}</strong></span>
            </div>
            ` : ''}
        </div>
        
        ${booking.notes || booking.internalNotes ? `
        <div class="detail-section" style="margin-bottom: 12px;">
            <h3>Additional Notes</h3>
            <div style="font-size: 10px; line-height: 1.4; color: #64748B;">
                ${booking.notes || booking.internalNotes}
            </div>
        </div>
        ` : ''}
        
        <div class="detail-section" style="margin-bottom: 15px;">
            <h3>Payment Terms</h3>
            <div style="font-size: 10px; line-height: 1.3;">
                • 50% advance required • Balance due 7 days before event • Cancellation charges apply
            </div>
        </div>
        
        <div class="footer">
            <div class="thank-you">Thank you for choosing ${hotelName}!</div>
            <div class="footer-note">
                We look forward to making your event memorable.<br>
                For any queries, please contact us at ${hotelContact.phone || 'our reception'}.<br>
                <strong>Booking Date:</strong> ${new Date().toLocaleDateString()} | <strong>Invoice Generated:</strong> ${new Date().toLocaleString()}
            </div>
        </div>
        </div> <!-- End invoice-content -->
    </div>
    <script>
    // Keep the invoice on a single A4 sheet (see server invoiceTemplates/index.js).
    (function () {
      function fit() {
        var b = document.body; if (!b) return;
        var outer = document.getElementById('__invFitOuter');
        if (!outer) {
          outer = document.createElement('div'); outer.id = '__invFitOuter';
          var inner = document.createElement('div'); inner.id = '__invFitInner';
          while (b.firstChild) { inner.appendChild(b.firstChild); }
          outer.appendChild(inner); b.appendChild(outer);
        }
        var inner = document.getElementById('__invFitInner');
        inner.style.transform = 'none'; outer.style.height = ''; outer.style.overflow = 'visible';
        var available = 1015;
        var h = inner.scrollHeight;
        if (h > available) {
          var s = available / h;
          inner.style.transformOrigin = 'top center';
          inner.style.transform = 'scale(' + s + ')';
          outer.style.height = Math.floor(h * s) + 'px';
          outer.style.overflow = 'hidden';
        }
      }
      function run() { try { fit(); } catch (e) {} }
      if (document.readyState === 'complete') run(); else window.addEventListener('load', run);
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
    })();
    </script>
</body>
</html>`;
  }
}

export default InvoiceService;
