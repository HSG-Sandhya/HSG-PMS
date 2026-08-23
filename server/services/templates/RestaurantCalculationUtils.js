/**
 * Restaurant Calculation Utilities
 * Common calculation logic for restaurant orders across all invoice templates
 */
// POS GST on food — 5% (2.5 CGST + 2.5 SGST), the same rate the rest of the
// invoice stack uses for restaurant lines.
const GST_RATE = 0.05;

class RestaurantCalculationUtils {
  /**
   * Calculate restaurant order totals with proper GST handling
   * @param {Array} restaurantOrders - Array of restaurant orders
   * @param {number} restaurantCharges - Total restaurant charges from booking
   * @returns {Object} Calculation results
   */
  static calculateRestaurantTotals(restaurantOrders = [], restaurantCharges = 0) {
    let calculatedSubtotal = 0;
    let totalItems = 0;
    let itemsBreakdown = [];
    
    // Process each restaurant order to get detailed breakdown
    restaurantOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const itemPrice = item.price || 0;
          const itemQuantity = item.quantity || 1;
          const itemTotal = itemPrice * itemQuantity;
          
          calculatedSubtotal += itemTotal;
          totalItems += itemQuantity;
          
          // Store item breakdown for detailed display
          itemsBreakdown.push({
            orderDate: order.createdAt,
            orderNumber: order.orderNumber,
            name: item.itemId?.name || item.name || 'Food Item',
            quantity: itemQuantity,
            rate: itemPrice,
            amount: itemTotal
          });
        });
      } else if (order.totalAmount) {
        // Fallback: use order total if items not available
        calculatedSubtotal += order.totalAmount;
        itemsBreakdown.push({
          orderDate: order.createdAt,
          orderNumber: order.orderNumber,
          name: 'Restaurant Order',
          quantity: 1,
          rate: order.totalAmount,
          amount: order.totalAmount
        });
      }
    });
    
    // ── GST follows the order's own convention ──────────────────────────────
    // Order.js: `totalAmount = itemsTotal + (gstIncluded ? 0 : gst)`. So a menu
    // price is the BASE and 5% is added on top, EXCEPT on orders flagged
    // gstIncluded (POS sales priced tax-in), where the item prices already
    // contain the tax and nothing may be added. Honour the flag per order —
    // guessing one convention for the whole bill is what produced wrong totals
    // before. `totalAmount` is the payable figure either way, so it is trusted
    // as the gross whenever the order carries it.
    const round2 = (n) => Math.round(n * 100) / 100;

    let grossTotal = 0;
    let baseTotal = 0;
    let anyInclusive = false;
    let anyExclusive = false;

    restaurantOrders.forEach((order) => {
      const itemsTotal = (order.items || []).reduce(
        (sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0,
      );
      const inclusive = !!order.gstIncluded;

      if (itemsTotal > 0) {
        if (inclusive) {
          anyInclusive = true;
          const gross = Number(order.totalAmount) || itemsTotal;
          grossTotal += gross;
          baseTotal += gross / (1 + GST_RATE);
        } else {
          anyExclusive = true;
          // Prefer the POS's own payable figure; fall back to base + 5%.
          const gross = Number(order.totalAmount) || itemsTotal * (1 + GST_RATE);
          grossTotal += gross;
          baseTotal += itemsTotal;
        }
      } else if (order.totalAmount) {
        // No item detail — totalAmount is the payable, so back the tax out.
        anyInclusive = true;
        grossTotal += Number(order.totalAmount);
        baseTotal += Number(order.totalAmount) / (1 + GST_RATE);
      }
    });

    let finalSubtotal, finalGstAmount, finalTotal;
    let calculationMethod = 'none';

    if (grossTotal > 0) {
      finalTotal = round2(grossTotal);
      finalSubtotal = round2(baseTotal);
      finalGstAmount = round2(finalTotal - finalSubtotal);
      calculationMethod = 'itemised';

    } else if (restaurantCharges > 0) {
      // Fallback: the booking's stored restaurantCharges, summed from
      // Order.totalAmount — the payable figure, so the tax is backed out of it.
      finalTotal = round2(restaurantCharges);
      finalSubtotal = round2(finalTotal / (1 + GST_RATE));
      finalGstAmount = round2(finalTotal - finalSubtotal);
      calculationMethod = 'order_totals';

    } else {
      // No data available
      finalSubtotal = 0;
      finalGstAmount = 0;
      finalTotal = 0;
      calculationMethod = 'empty';
    }

    // Whether the AMOUNTS PRINTED against each item already contain the tax —
    // drives the wording on the bill so the column always reconciles.
    const pricesIncludeGst = anyInclusive && !anyExclusive;

        return {
      // Calculated values
      subtotal: finalSubtotal,
      gstAmount: finalGstAmount,
      total: finalTotal,
      
      // Breakdown data
      itemsBreakdown,
      totalItems,
      totalOrders: restaurantOrders.length,
      
      // Metadata
      calculationMethod,
      pricesIncludeGst,
      originalRestaurantCharges: restaurantCharges,
      calculatedFromItems: calculatedSubtotal
    };
  }
  
  /**
   * Format currency for display
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency string
   */
  static formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '₹0';
    }
    
    // Format with Indian number system (lakhs, crores)
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    
    return formatter.format(amount);
  }
  
  /**
   * Format date and time for display
   * @param {Date} date - Date to format
   * @returns {string} Formatted date and time
   */
  static formatDateTime(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  
  /**
   * Validate restaurant calculation results
   * @param {Object} calculation - Calculation results
   * @returns {Object} Validation results
   */
  static validateCalculation(calculation) {
    const errors = [];
    const warnings = [];
    
    // Check for negative values
    if (calculation.subtotal < 0) errors.push('Subtotal cannot be negative');
    if (calculation.gstAmount < 0) errors.push('GST amount cannot be negative');
    if (calculation.total < 0) errors.push('Total cannot be negative');
    
    // Check GST calculation accuracy
    const expectedGst = Math.round(calculation.subtotal * 0.05 * 100) / 100;
    if (Math.abs(calculation.gstAmount - expectedGst) > 0.01) {
      warnings.push(`GST calculation may be inaccurate. Expected: ${expectedGst}, Got: ${calculation.gstAmount}`);
    }
    
    // Check total calculation accuracy
    const expectedTotal = calculation.subtotal + calculation.gstAmount;
    if (Math.abs(calculation.total - expectedTotal) > 0.01) {
      warnings.push(`Total calculation may be inaccurate. Expected: ${expectedTotal}, Got: ${calculation.total}`);
    }
    
    // Check if calculated total differs significantly from original charges
    if (calculation.originalRestaurantCharges > 0 && calculation.calculationMethod === 'calculated') {
      const difference = Math.abs(calculation.total - calculation.originalRestaurantCharges);
      // Only warn if the difference is significant and not explainable by GST
      const expectedGstDifference = Math.round(calculation.originalRestaurantCharges * 0.05);
      if (difference > 5 && Math.abs(difference - expectedGstDifference) > 2) {
        warnings.push(`Calculated total (${calculation.total}) differs significantly from restaurant charges (${calculation.originalRestaurantCharges}) by ₹${difference}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        method: calculation.calculationMethod,
        itemsProcessed: calculation.totalItems,
        ordersProcessed: calculation.totalOrders
      }
    };
  }
}

export default RestaurantCalculationUtils;
