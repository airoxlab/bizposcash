import { supabase } from './supabase'

class CustomerLedgerManager {
  constructor() {
    this.userId = null
  }

  setUserId(userId) {
    this.userId = userId
  }

  /**
   * Get customer's current ledger balance
   */
  async getCustomerBalance(customerId) {
    try {
      if (!this.userId) {
        throw new Error('User ID not set in CustomerLedgerManager')
      }

      // Get the most recent ledger entry to find current balance
      const { data, error } = await supabase
        .from('customer_ledger')
        .select('balance_after')
        .eq('customer_id', customerId)
        .eq('user_id', this.userId)
        .order('transaction_date', { ascending: false })
        .order('transaction_time', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching customer balance:', error)
        return 0
      }

      return data?.balance_after || 0
    } catch (error) {
      console.error('Error in getCustomerBalance:', error)
      return 0
    }
  }

  /**
   * Create a debit entry (customer owes money)
   */
  async createDebitEntry(customerId, orderId, amount, description, notes = null) {
    try {
      if (!this.userId) {
        throw new Error('User ID not set in CustomerLedgerManager')
      }

      if (!customerId) {
        throw new Error('Customer ID is required for ledger entry')
      }

      // Get current balance
      const balanceBefore = await this.getCustomerBalance(customerId)
      const balanceAfter = balanceBefore + amount // Debit increases what they owe

      console.log('💳 [Ledger] Creating debit entry:', {
        customerId,
        orderId,
        amount,
        balanceBefore,
        balanceAfter
      })

      // Create ledger entry
      const { data, error } = await supabase
        .from('customer_ledger')
        .insert({
          user_id: this.userId,
          customer_id: customerId,
          transaction_type: 'debit',
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          order_id: orderId,
          description: description,
          notes: notes,
          created_by: this.userId
        })
        .select()
        .single()

      if (error) throw error

      console.log('✅ [Ledger] Debit entry created:', data)

      return {
        success: true,
        ledgerEntry: data,
        previousBalance: balanceBefore,
        newBalance: balanceAfter
      }
    } catch (error) {
      console.error('❌ [Ledger] Failed to create debit entry:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Create a credit entry (customer pays money)
   */
  async createCreditEntry(customerId, paymentId, amount, description, notes = null) {
    try {
      if (!this.userId) {
        throw new Error('User ID not set in CustomerLedgerManager')
      }

      if (!customerId) {
        throw new Error('Customer ID is required for ledger entry')
      }

      // Get current balance
      const balanceBefore = await this.getCustomerBalance(customerId)
      const balanceAfter = balanceBefore - amount // Credit decreases what they owe

      console.log('💳 [Ledger] Creating credit entry:', {
        customerId,
        paymentId,
        amount,
        balanceBefore,
        balanceAfter
      })

      // Create ledger entry
      const { data, error } = await supabase
        .from('customer_ledger')
        .insert({
          user_id: this.userId,
          customer_id: customerId,
          transaction_type: 'credit',
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          payment_id: paymentId,
          description: description,
          notes: notes,
          created_by: this.userId
        })
        .select()
        .single()

      if (error) throw error

      console.log('✅ [Ledger] Credit entry created:', data)

      return {
        success: true,
        ledgerEntry: data,
        previousBalance: balanceBefore,
        newBalance: balanceAfter
      }
    } catch (error) {
      console.error('❌ [Ledger] Failed to create credit entry:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Create an adjustment entry (manual correction)
   */
  async createAdjustmentEntry(customerId, amount, isIncrease, description, notes = null) {
    try {
      if (!this.userId) {
        throw new Error('User ID not set in CustomerLedgerManager')
      }

      if (!customerId) {
        throw new Error('Customer ID is required for ledger entry')
      }

      // Get current balance
      const balanceBefore = await this.getCustomerBalance(customerId)
      const balanceAfter = isIncrease ? balanceBefore + amount : balanceBefore - amount

      console.log('💳 [Ledger] Creating adjustment entry:', {
        customerId,
        amount,
        isIncrease,
        balanceBefore,
        balanceAfter
      })

      // Create ledger entry
      const { data, error } = await supabase
        .from('customer_ledger')
        .insert({
          user_id: this.userId,
          customer_id: customerId,
          transaction_type: 'adjustment',
          amount: Math.abs(amount),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: description,
          notes: notes,
          created_by: this.userId
        })
        .select()
        .single()

      if (error) throw error

      console.log('✅ [Ledger] Adjustment entry created:', data)

      return {
        success: true,
        ledgerEntry: data,
        previousBalance: balanceBefore,
        newBalance: balanceAfter
      }
    } catch (error) {
      console.error('❌ [Ledger] Failed to create adjustment entry:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get customer ledger history
   */
  async getCustomerLedger(customerId, limit = 50) {
    try {
      if (!this.userId) {
        throw new Error('User ID not set in CustomerLedgerManager')
      }

      const { data, error } = await supabase
        .from('customer_ledger')
        .select('*')
        .eq('customer_id', customerId)
        .eq('user_id', this.userId)
        .order('transaction_date', { ascending: false })
        .order('transaction_time', { ascending: false })
        .limit(limit)

      if (error) throw error

      return {
        success: true,
        ledger: data || []
      }
    } catch (error) {
      console.error('❌ [Ledger] Failed to fetch customer ledger:', error)
      return {
        success: false,
        error: error.message,
        ledger: []
      }
    }
  }

  /**
   * Get ledger summary for a customer
   */
  async getCustomerLedgerSummary(customerId) {
    try {
      if (!this.userId) {
        throw new Error('User ID not set in CustomerLedgerManager')
      }

      // Get current balance
      const currentBalance = await this.getCustomerBalance(customerId)

      // Get total debits (what they owe)
      const { data: debitsData } = await supabase
        .from('customer_ledger')
        .select('amount')
        .eq('customer_id', customerId)
        .eq('user_id', this.userId)
        .eq('transaction_type', 'debit')

      const totalDebits = debitsData?.reduce((sum, entry) => sum + parseFloat(entry.amount), 0) || 0

      // Get total credits (what they paid)
      const { data: creditsData } = await supabase
        .from('customer_ledger')
        .select('amount')
        .eq('customer_id', customerId)
        .eq('user_id', this.userId)
        .eq('transaction_type', 'credit')

      const totalCredits = creditsData?.reduce((sum, entry) => sum + parseFloat(entry.amount), 0) || 0

      return {
        success: true,
        summary: {
          currentBalance,
          totalDebits,
          totalCredits,
          totalOrders: debitsData?.length || 0,
          totalPayments: creditsData?.length || 0
        }
      }
    } catch (error) {
      console.error('❌ [Ledger] Failed to fetch ledger summary:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// Create singleton instance
const customerLedgerManager = new CustomerLedgerManager()

export default customerLedgerManager
