const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const thousands = ['', 'Thousand', 'Lakh', 'Crore'];

function convertHundreds(num) {
  let result = '';
  
  if (num > 99) {
    result += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  
  if (num > 19) {
    result += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num > 9) {
    result += teens[num - 10] + ' ';
    return result;
  }
  
  if (num > 0) {
    result += ones[num] + ' ';
  }
  
  return result;
}

export function numberToWords(num) {
  if (num === 0) return 'Zero';
  
  let numStr = num.toString();
  let result = '';
  let groupIndex = 0;
  
  // Handle Indian numbering system (lakhs and crores)
  while (numStr.length > 0) {
    let groupSize = groupIndex === 0 ? 3 : 2; // First group is 3 digits, rest are 2
    if (groupIndex === 0 && numStr.length < 3) {
      groupSize = numStr.length;
    }
    
    let group = parseInt(numStr.slice(-groupSize));
    numStr = numStr.slice(0, -groupSize);
    
    if (group !== 0) {
      let groupWords = convertHundreds(group);
      if (thousands[groupIndex]) {
        groupWords += thousands[groupIndex] + ' ';
      }
      result = groupWords + result;
    }
    
    groupIndex++;
    if (groupIndex >= thousands.length) break;
  }
  
  return result.trim();
}

export default numberToWords;
