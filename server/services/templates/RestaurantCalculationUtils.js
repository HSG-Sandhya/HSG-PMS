/**
 * Restaurant Calculation Utilities
 * Common calculation logic for restaurant orders across all invoice templates
 */
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
    
    // Determine which calculation method to use
    let finalSubtotal, finalGstAmount, finalTotal;
    let calculationMethod = 'none';
    
    if (calculatedSubtotal > 0) {
      // Use calculated amounts from detailed items (most accurate)
      finalSubtotal = calculatedSubtotal;
      finalGstAmount = Math.round(calculatedSubtotal * 0.05 * 100) / 100;
      finalTotal = finalSubtotal + finalGstAmount;
      calculationMethod = 'calculated';
      
      
    } else if (restaurantCharges > 0) {
      // Fallback: determine if restaurantCharges is subtotal or total
      // If restaurantCharges seems to be subtotal (common case), treat it as such
      const potentialTotal = restaurantCharges * 1.05;
      const potentialSubtotal = (restaurantCharges * 100) / 105;
      
      // Heuristic: if restaurantCharges is a round number and close to calculated subtotal,
      // it's likely the subtotal, not the total
      if (Math.abs(restaurantCharges - calculatedSubtotal) < 1 || restaurantCharges % 10 === 0) {
        // Treat restaurantCharges as subtotal
        finalSubtotal = restaurantCharges;
        finalGstAmount = Math.round(restaurantCharges * 0.05 * 100) / 100;
        finalTotal = finalSubtotal + finalGstAmount;
        calculationMethod = 'subtotal_provided';
        
      } else {
        // Treat restaurantCharges as total (extract GST)
        finalTotal = restaurantCharges;
        finalSubtotal = Math.round(potentialSubtotal);
        finalGstAmount = Math.round((finalSubtotal * 5) / 100 * 100) / 100;
        calculationMethod = 'total_provided';
        
      }
      
    } else {
      // No data available
      finalSubtotal = 0;
      finalGstAmount = 0;
      finalTotal = 0;
      calculationMethod = 'empty';
    }
    
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
