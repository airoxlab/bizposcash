/**
 * Daily Serial Number Manager
 * Generates and manages daily-resetting serial numbers for orders
 * Serial numbers start from 1 each day and reset at midnight
 * These are UI-only and not stored in the database
 */

class DailySerialManager {
  constructor() {
    this.storageKey = 'daily_serial_data';
    // Only initialize on client-side (browser)
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * Initialize or reset the daily serial counter
   */
  initialize() {
    // Skip on server-side
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

    const today = this.getTodayDate();
    const data = this.getStoredData();

    // Check if we need to reset (new day)
    if (!data || data.date !== today) {
      this.resetForNewDay(today);
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Get stored data from localStorage
   */
  getStoredData() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error reading daily serial data:', error);
      return null;
    }
  }

  /**
   * Save data to localStorage
   */
  saveData(data) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving daily serial data:', error);
    }
  }

  /**
   * Reset counter for a new day
   */
  resetForNewDay(date) {
    const data = {
      date: date,
      counter: 0,
      orderMap: {} // Maps order_number to serial number
    };
    this.saveData(data);
  }

  /**
   * Generate next serial number for a new order
   * @param {string} orderNumber - The actual order number (ORD...)
   * @returns {number} The daily serial number
   */
  getNextSerial(orderNumber) {
    this.initialize(); // Ensure we're on the correct day

    const data = this.getStoredData();

    // Check if this order already has a serial (in case of re-rendering)
    if (data.orderMap[orderNumber]) {
      return data.orderMap[orderNumber];
    }

    // Increment counter and assign serial
    data.counter += 1;
    data.orderMap[orderNumber] = data.counter;

    this.saveData(data);

    return data.counter;
  }

  /**
   * Get serial number for an existing order
   * @param {string} orderNumber - The actual order number (ORD...)
   * @returns {number|null} The serial number or null if not found
   */
  getSerial(orderNumber) {
    this.initialize();

    const data = this.getStoredData();
    return data.orderMap[orderNumber] || null;
  }

  /**
   * Get serial number for an order, or generate if doesn't exist
   * @param {string} orderNumber - The actual order number (ORD...)
   * @returns {number} The serial number
   */
  getOrCreateSerial(orderNumber) {
    const existing = this.getSerial(orderNumber);
    if (existing) {
      return existing;
    }
    return this.getNextSerial(orderNumber);
  }

  /**
   * Batch assign serial numbers to multiple orders in chronological order
   * This ensures sequential assignment based on creation time
   * @param {Array} orderNumbers - Array of order numbers in chronological order
   * @returns {Object} Map of order_number to serial number
   */
  batchAssignSerials(orderNumbers) {
    if (!Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      return {};
    }

    this.initialize();
    const data = this.getStoredData();
    const assignments = {};

    // Process each order number
    orderNumbers.forEach(orderNumber => {
      if (!orderNumber) return;

      // Check if already has a serial
      if (data.orderMap[orderNumber]) {
        assignments[orderNumber] = data.orderMap[orderNumber];
      } else {
        // Assign next serial
        data.counter += 1;
        data.orderMap[orderNumber] = data.counter;
        assignments[orderNumber] = data.counter;
      }
    });

    // Save all changes at once
    this.saveData(data);

    return assignments;
  }

  /**
   * Format serial number for display
   * @param {number} serial - The serial number
   * @returns {string} Formatted serial (e.g., "#001")
   */
  formatSerial(serial) {
    if (!serial) return '';
    return `#${serial.toString().padStart(3, '0')}`;
  }

  /**
   * Get full display string with both serial and order number
   * @param {string} orderNumber - The actual order number (ORD...)
   * @param {number} serial - The serial number (optional, will fetch if not provided)
   * @returns {string} Formatted string (e.g., "#001 - ORD123456")
   */
  getFullDisplay(orderNumber, serial = null) {
    if (!orderNumber) return '';

    const serialNum = serial || this.getOrCreateSerial(orderNumber);
    const formattedSerial = this.formatSerial(serialNum);

    return `${formattedSerial} - ${orderNumber}`;
  }

  /**
   * Get current counter value (for debugging)
   */
  getCurrentCounter() {
    const data = this.getStoredData();
    return data ? data.counter : 0;
  }

  /**
   * Manually reset (for testing purposes)
   */
  manualReset() {
    const today = this.getTodayDate();
    this.resetForNewDay(today);
    console.log('✅ Daily serial counter has been reset to 0');
  }

  /**
   * Debug: Log current state
   */
  debugState() {
    this.initialize();
    const data = this.getStoredData();
    console.log('📊 Daily Serial Manager State:');
    console.log('  Date:', data.date);
    console.log('  Counter:', data.counter);
    console.log('  Total Orders Mapped:', Object.keys(data.orderMap).length);
    console.log('  Order Map:', data.orderMap);
    return data;
  }
}

// Export singleton instance
const dailySerialManager = new DailySerialManager();

export default dailySerialManager;
