/**
 * Helper function to get transaction type description
 * @param {number} type - Transaction type code
 * @returns {string} Human-readable transaction type description
 */
export const getTransactionTypeDescription = (type) => {
  const types = {
    0: 'Beginning Balance',
    1: 'Open PO',
    2: 'Open WO',
    3: 'Released WO',
    4: 'Open Sale',
    5: 'Planned Requirement',
    6: 'Issued',
    7: 'Quote',
    8: 'Min Balance'
  };
  return types[type] || 'Unknown';
};
/**
 * Round a number up to the nearest integer, no matter how small the decimal
 * @param {number|string} value - Value to round up
 * @returns {number} Rounded up integer
 */
export const ceilingRound = (value) => {
  const parsedValue = parseFloat(value);
  return !isNaN(parsedValue) ? Math.ceil(parsedValue) : value;
};
/**
 * Calculate lead time based on category code
 * Similar to your C# setOrderDate() function
 * @param {string} category - Category code
 * @returns {number} Lead time in days
 */
export const calculateLeadTime = (category) => {
  // Components
  if (['H', 'MI', 'OB', 'SM'].includes(category)) {
    return 45;
  }
  
  if (['LTM', 'SMT', 'TM'].includes(category)) {
    return 50;
  }
  
  if (['W', 'WC', 'WST', 'SMW', 'SM2', 'SM3', 'WC1', 'WC2', 'WC3', 'WS1', 'WS2', 'WS3'].includes(category)) {
    return 55;
  }
  
  // Wire harnesses
  if (['BH', 'BS', 'BSO', 'DC', 'EK', 'HH', 'MH', 'MO', 'NC', 'NH', 'NMP', 'PSC', 'PW', 'SAM', 'WH'].includes(category)) {
    return 60;
  }
  
  // Default
  return 50;
};



/**
 * Format date to MM/DD/YYYY string
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};

/**
 * Parse date string to Date object
 * @param {string} dateString - Date string in MM/DD/YYYY format
 * @returns {Date} Date object
 */
export const parseDate = (dateString) => {
  if (!dateString || dateString === '00/00/00') {
    return new Date();
  }
  
  const [month, day, year] = dateString.split('/');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
};

/**
 * Generate sample data for testing
 * @returns {Array} Array of sample stock items
 */
export const generateSampleData = () => {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(today.getMonth() + 1);
  
  return [
    {
      item: 'SAMPLE-001',
      startingBalance: 100,
      vendor: '123',
      category: 'W',
      transactions: [
        { type: 0, dueDate: today, quantity: 100, partNumber: '' },
        { type: 6, dueDate: nextMonth, quantity: 50, partNumber: 'WO-001' }
      ],
      workOrders: [
        { partNumber: 'WO-001', dueDate: nextMonth, quantity: 50, availableQuantity: 50 }
      ],
      openSales: [],
      purchaseOrders: [],
      orders: [],
      monthlyOrders: [],
      runningTotals: [
        { date: today, balance: 100, type: 0, description: 'Beginning Balance' },
        { date: nextMonth, balance: 50, type: 6, description: 'Issued' }
      ]
    }
  ];
};