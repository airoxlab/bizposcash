'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Printer,
  Check,
  Coffee,
  User,
  Phone,
  Clock,
  DollarSign,
  History,
  ChefHat,
  MoreVertical,
  Truck,
  Gift,
  XCircle,
  RotateCcw,
  Package,
  Plus,
  X,
  RefreshCw,
  CreditCard
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { authManager } from '../../lib/authManager'
import { usePermissions } from '../../lib/permissionManager'
import dailySerialManager from '../../lib/utils/dailySerialManager'
import InlinePaymentSection from '../pos/InlinePaymentSection'
import ConvertToDeliveryModal from '../delivery/ConvertToDeliveryModal'
import { cacheManager } from '../../lib/cacheManager'
import { useRouter } from 'next/navigation'

export default function WalkinOrderDetails({
  order,
  classes,
  isDark,
  onPrint,
  onPrintToken,
  onMarkReady,
  onComplete,
  onPaymentRequired, // New prop for handling unpaid orders
  onClose, // Callback to close the details view
  orderType = 'walkin', // 'walkin' or 'takeaway'
  onConvertToDelivery // New prop for refreshing after conversion
}) {
  const [orderItems, setOrderItems] = useState([])
  const [orderHistory, setOrderHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPaymentView, setShowPaymentView] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [loyaltyRedemption, setLoyaltyRedemption] = useState(null)
  const [paymentTransactions, setPaymentTransactions] = useState([])
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedCancelReason, setSelectedCancelReason] = useState('')
  const [customCancelReason, setCustomCancelReason] = useState('')
  const router = useRouter()
  const permissions = usePermissions()

  useEffect(() => {
    if (order?.id) {
      fetchOrderDetails()
    }
  }, [order?.id])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)

      console.log('📦 Order Details:', { id: order.id, order_number: order.order_number, order })

      // Check if order has items already (from cache/localStorage)
      // The order object may have 'items' or 'order_items' property from cache
      const cachedItems = order.items || order.order_items

      if (cachedItems && cachedItems.length > 0) {
        // Use cached items (works offline)
        console.log('Using cached order items:', cachedItems.length)
        setOrderItems(cachedItems)

        // Try to fetch history and loyalty if online
        if (navigator.onLine) {
          try {
            const history = await authManager.getOrderHistory(order.id)
            setOrderHistory(history || [])

            // Fetch loyalty redemption
            console.log('🔍 Fetching loyalty for order_number:', order.order_number)
            const { data: redemption, error: loyaltyError } = await supabase
              .from('loyalty_redemptions')
              .select('points_used, discount_applied')
              .eq('order_id', order.order_number)
              .maybeSingle()

            console.log('🎯 Loyalty redemption result:', { redemption, loyaltyError })

            if (loyaltyError) {
              console.error('❌ Error fetching loyalty:', loyaltyError)
            } else if (redemption) {
              console.log('✓ Setting loyalty redemption:', redemption)
              setLoyaltyRedemption(redemption)
            } else {
              console.log('⚠️ No loyalty redemption found for order:', order.order_number)
            }

            // Fetch payment transactions for split payments
            if (order.payment_method === 'Split') {
              console.log('💳 [WalkinOrderDetails] Order has Split payment, order ID:', order.id)
              console.log('💳 [WalkinOrderDetails] Online status:', navigator.onLine)

              // Try cache first (for offline support)
              const cachedTransactions = cacheManager.getPaymentTransactions(order.id)
              console.log('💳 [WalkinOrderDetails] Cache returned:', cachedTransactions.length, 'transactions')

              if (cachedTransactions && cachedTransactions.length > 0) {
                console.log('✅ [WalkinOrderDetails] Using cached payment transactions:', cachedTransactions)
                setPaymentTransactions(cachedTransactions)
              } else if (navigator.onLine) {
                // Fetch from database if online and not cached
                const { data: transactions, error: transactionsError } = await supabase
                  .from('order_payment_transactions')
                  .select('*')
                  .eq('order_id', order.id)
                  .order('created_at', { ascending: true })

                if (transactionsError) {
                  console.error('❌ Error fetching payment transactions:', transactionsError)
                  setPaymentTransactions([])
                } else {
                  console.log('✓ Payment transactions:', transactions)
                  if (transactions && transactions.length > 0) {
                    cacheManager.setPaymentTransactions(order.id, transactions)
                  }
                  setPaymentTransactions(transactions || [])
                }
              } else {
                console.log('📴 Offline: No cached payment transactions found')
                setPaymentTransactions([])
              }
            } else {
              setPaymentTransactions([])
            }
          } catch (historyError) {
            console.log('Could not fetch order history or loyalty:', historyError)
            // Try cache even if online fetch fails
            const cachedHistory = cacheManager.getOrderHistory(order.id)
            setOrderHistory(cachedHistory || [])
            setPaymentTransactions([])
          }
        } else {
          // Offline - use cached history and check for cached loyalty data
          console.log('📴 [WalkinOrderDetails] Offline - loading history from cache')
          const cachedHistory = cacheManager.getOrderHistory(order.id)
          setOrderHistory(cachedHistory || [])
          console.log(`📴 [WalkinOrderDetails] Loaded ${cachedHistory?.length || 0} history entries from cache`)

          // Check for cached loyalty data in the order object
          console.log('📴 [WalkinOrderDetails] Offline: Checking order for loyalty data')
          const loyaltyData = {
            points_used: order.loyalty_points_redeemed || order.loyaltyPointsRedeemed || 0,
            discount_applied: order.loyalty_discount_amount || order.loyaltyDiscountAmount || 0
          }

          if (loyaltyData.points_used > 0 || loyaltyData.discount_applied > 0) {
            console.log('✅ [WalkinOrderDetails] Found cached loyalty data:', loyaltyData)
            setLoyaltyRedemption(loyaltyData)
          } else {
            console.log('⚠️ [WalkinOrderDetails] No loyalty data in cached order')
            setLoyaltyRedemption(null)
          }
          // Payment transactions already handled above
        }
      } else if (navigator.onLine) {
        // Online: Fetch order items from Supabase
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at')

        if (itemsError) throw itemsError
        setOrderItems(items || [])

        // Fetch order history (authManager will cache it automatically)
        const history = await authManager.getOrderHistory(order.id)
        setOrderHistory(history || [])

        // Fetch loyalty redemption
        console.log('🔍 Fetching loyalty for order_number:', order.order_number)
        const { data: redemption, error: loyaltyError } = await supabase
          .from('loyalty_redemptions')
          .select('points_used, discount_applied')
          .eq('order_id', order.order_number)
          .maybeSingle()

        console.log('🎯 Loyalty redemption result:', { redemption, loyaltyError })

        if (loyaltyError) {
          console.error('❌ Error fetching loyalty:', loyaltyError)
        } else if (redemption) {
          console.log('✓ Setting loyalty redemption:', redemption)
          setLoyaltyRedemption(redemption)
        } else {
          console.log('⚠️ No loyalty redemption found for order:', order.order_number)
        }

        // Fetch payment transactions for split payments
        if (order.payment_method === 'Split') {
          console.log('💳 [WalkinOrderDetails-Online] Order has Split payment, order ID:', order.id)
          console.log('💳 [WalkinOrderDetails-Online] Online status:', navigator.onLine)

          // Try cache first (for offline support)
          const cachedTransactions = cacheManager.getPaymentTransactions(order.id)
          console.log('💳 [WalkinOrderDetails-Online] Cache returned:', cachedTransactions.length, 'transactions')

          if (cachedTransactions && cachedTransactions.length > 0) {
            console.log('✅ [WalkinOrderDetails-Online] Using cached payment transactions:', cachedTransactions)
            setPaymentTransactions(cachedTransactions)
          } else if (navigator.onLine) {
            // Fetch from database if online and not cached
            const { data: transactions, error: transactionsError } = await supabase
              .from('order_payment_transactions')
              .select('*')
              .eq('order_id', order.id)
              .order('created_at', { ascending: true })

            if (transactionsError) {
              console.error('❌ Error fetching payment transactions:', transactionsError)
              setPaymentTransactions([])
            } else {
              console.log('✓ Payment transactions:', transactions)
              if (transactions && transactions.length > 0) {
                cacheManager.setPaymentTransactions(order.id, transactions)
              }
              setPaymentTransactions(transactions || [])
            }
          } else {
            console.log('📴 Offline: No cached payment transactions found')
            setPaymentTransactions([])
          }
        } else {
          setPaymentTransactions([])
        }
      } else {
        // Offline and no cached items
        console.log('📴 Offline: No cached items available for order', order.id)
        setOrderItems([])

        // Still try to load history from cache
        const cachedHistory = cacheManager.getOrderHistory(order.id)
        setOrderHistory(cachedHistory || [])
        console.log(`📴 Loaded ${cachedHistory?.length || 0} history entries from cache (no items path)`)
      }

    } catch (error) {
      console.error('Error fetching order details:', error)
      // Fallback to cached items if available
      const cachedItems = order.items || order.order_items
      if (cachedItems && cachedItems.length > 0) {
        setOrderItems(cachedItems)
      }
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return isDark
          ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700'
          : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
      case 'Preparing':
        return isDark
          ? 'bg-blue-900/30 text-blue-400 border border-blue-700'
          : 'bg-blue-100 text-blue-700 border border-blue-300'
      case 'Ready':
        return isDark
          ? 'bg-purple-900/30 text-purple-400 border border-purple-700'
          : 'bg-purple-100 text-purple-700 border border-purple-300'
      case 'Completed':
        return isDark
          ? 'bg-green-900/30 text-green-400 border border-green-700'
          : 'bg-green-100 text-green-700 border border-green-300'
      default:
        return isDark
          ? 'bg-gray-700 text-gray-300'
          : 'bg-gray-100 text-gray-600'
    }
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return isDark ? 'text-green-400' : 'text-green-600'
      case 'Pending':
        return isDark ? 'text-yellow-400' : 'text-yellow-600'
      default:
        return classes.textSecondary
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatOrderNumber = (orderNumber) => {
    if (!orderNumber) return ''
    return `#${orderNumber}`
  }

  const formatOrderDisplay = (order) => {
    if (!order || !order.order_number) return ''

    // Only show serial for today's orders
    if (order.daily_serial) {
      const formattedSerial = dailySerialManager.formatSerial(order.daily_serial)
      return `${formattedSerial} - ${formatOrderNumber(order.order_number)}`
    }

    // For old orders, just show order number
    return formatOrderNumber(order.order_number)
  }

  const formatHistoryTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  if (!order) {
    return (
      <div className={`flex-1 flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <Coffee className={`w-16 h-16 ${classes.textSecondary} mx-auto mb-4`} />
          <p className={`${classes.textSecondary}`}>Select an order to view details</p>
        </div>
      </div>
    )
  }

  // Show payment view if payment is pending and user clicked complete
  if (showPaymentView && order.payment_status === 'Pending') {
    return (
      <InlinePaymentSection
        order={order}
        onPaymentComplete={(paymentData) => {
          setShowPaymentView(false)
          onPaymentRequired?.(order, paymentData)
        }}
        onCancel={() => setShowPaymentView(false)}
        classes={classes}
        isDark={isDark}
      />
    )
  }

  // Cancel order handlers
  const handleCancelOrder = () => {
    setShowCancelModal(true)
  }

  const confirmCancelOrder = async () => {
    const finalReason = selectedCancelReason === 'Other' ? customCancelReason : selectedCancelReason
    if (!finalReason) return

    try {
      await updateOrderStatus(order.id, 'Cancelled', finalReason)
      setShowCancelModal(false)
      setSelectedCancelReason('')
      setCustomCancelReason('')

      // Show success notification
      toast.success(`Order ${order.order_number} cancelled`, { duration: 2000 })

      // Close the details view after a short delay
      setTimeout(() => {
        if (onClose) {
          onClose()
        }
      }, 500)
    } catch (error) {
      console.error('Error cancelling order:', error)
      toast.error('Failed to cancel order')
    }
  }

  // Reopen order handler
  const handleReopenOrder = () => {
    console.log('🔄 Reopening order:', order)
    console.log('🔄 Order items:', orderItems)

    if (!orderItems || orderItems.length === 0) {
      console.error('❌ No order items available to reopen')
   //   alert('Unable to reopen order. Order items not loaded.')
      return
    }

    try {
      // Prepare order data for reopening
      const orderData = {
        cart: orderItems.map(item => ({
        id: `${item.product_id}-${item.variant_id || 'base'}-${Date.now()}`,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        variantName: item.variant_name,
        basePrice: item.base_price,
        variantPrice: item.variant_price || 0,
        finalPrice: item.final_price,
        quantity: item.quantity,
        totalPrice: item.total_price,
        isDeal: item.is_deal,
        dealId: item.deal_id,
        dealName: item.is_deal ? item.product_name : null,
        dealProducts: item.is_deal && item.deal_products ?
          (typeof item.deal_products === 'string' ? JSON.parse(item.deal_products) : item.deal_products) : null
      })),
      customer: order.customers,
      orderInstructions: order.order_instructions || '',
      discount: order.discount_percentage || 0,
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      total: order.total_amount,
      orderType: order.order_type,
      existingOrderId: order.id,
      existingOrderNumber: order.order_number,
      isModifying: true,
      originalState: {
        items: orderItems.map(item => ({
          productName: item.product_name,
          variantName: item.variant_name,
          quantity: item.quantity,
          price: item.final_price,
          totalPrice: item.total_price
        })),
        subtotal: order.subtotal,
        discountAmount: order.discount_amount,
        total: order.total_amount,
        itemCount: orderItems.length
      }
    }

    const orderTypePrefix = order.order_type
    localStorage.setItem(`${orderTypePrefix}_cart`, JSON.stringify(orderData.cart))
    localStorage.setItem(`${orderTypePrefix}_customer`, JSON.stringify(orderData.customer))
    localStorage.setItem(`${orderTypePrefix}_instructions`, orderData.orderInstructions)
    localStorage.setItem(`${orderTypePrefix}_discount`, orderData.discount.toString())
    localStorage.setItem(`${orderTypePrefix}_modifying_order`, order.id)
    localStorage.setItem(`${orderTypePrefix}_modifying_order_number`, order.order_number)
    localStorage.setItem(`${orderTypePrefix}_original_state`, JSON.stringify(orderData.originalState))
    // Save original order status so editing doesn't revert it back to Pending
    localStorage.setItem(`${orderTypePrefix}_original_order_status`, order.order_status || 'Pending')
    // 🆕 Save original payment information for modified order payment calculation
    localStorage.setItem(`${orderTypePrefix}_original_payment_status`, order.payment_status || 'Pending')
    localStorage.setItem(`${orderTypePrefix}_original_amount_paid`, (order.amount_paid || order.total_amount || 0).toString())
    localStorage.setItem(`${orderTypePrefix}_original_payment_method`, order.payment_method || 'Cash')
    // 🆕 Save permission flag for quantity decrease control
    localStorage.setItem(`${orderTypePrefix}_can_decrease_qty`, permissions.hasPermission('MODIFY_REOPEN_DECREASE_QTY').toString())

    if (order.order_type === 'delivery') {
      if (order.delivery_charges) {
        localStorage.setItem('delivery_charges', order.delivery_charges.toString())
      }
      if (order.delivery_time) {
        const deliveryDate = new Date(order.delivery_time)
        const hours = deliveryDate.getHours().toString().padStart(2, '0')
        const minutes = deliveryDate.getMinutes().toString().padStart(2, '0')
        localStorage.setItem('delivery_time', `${hours}:${minutes}`)
      }
    }

    if (order.order_type === 'takeaway' && order.takeaway_time) {
      localStorage.setItem('takeaway_time', order.takeaway_time)
    }

    const currentCashier = authManager.getCashier()
    const currentRole = authManager.getRole()
    const reopenedBy = currentRole === 'cashier' && currentCashier?.name ? currentCashier.name : 'Admin'

    authManager.logOrderAction(
      order.id,
      'reopened',
      { order_number: order.order_number },
      `Order reopened for modification by ${reopenedBy}`
    )

      console.log('✅ Order data saved to localStorage')

      // Dispatch a custom event to trigger cart reload
      window.dispatchEvent(new CustomEvent('reloadCart', {
        detail: { orderType: order.order_type }
      }))

      const routes = {
        walkin: '/walkin',
        takeaway: '/takeaway',
        delivery: '/delivery'
      }

      // Navigate to the appropriate page
      const targetRoute = routes[order.order_type] || '/walkin'
      router.push(targetRoute)
    } catch (error) {
      console.error('❌ Error reopening order:', error)
   //   alert('Failed to reopen order: ' + error.message)
    }
  }

  // Update order status helper
  const updateOrderStatus = async (orderId, newStatus, cancelReason = null) => {
    try {
      const additionalData = {}
      if (cancelReason) {
        additionalData.cancellation_reason = cancelReason
      }

      const userRole = authManager.getRole()
      if (userRole === 'cashier') {
        const cashier = authManager.getCashier()
        if (cashier) {
          additionalData.modified_by_cashier_id = cashier.id
        }
      }

      const result = await cacheManager.updateOrderStatus(orderId, newStatus, additionalData)

      if (!result.success) {
        throw new Error('Failed to update order status')
      }

      if (!result.isOffline) {
        await authManager.logOrderAction(
          orderId,
          `status_changed_to_${newStatus.toLowerCase()}`,
          { from_status: order.order_status, to_status: newStatus },
          cancelReason ? `Cancelled: ${cancelReason}` : `Status changed to ${newStatus}`
        )
      }

      // Refresh parent component
      if (onComplete) {
        onComplete()
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      throw error
    }
  }

  return (
    <div className={`flex-1 flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'} overflow-hidden`}>
      {/* Header */}
      <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border-b p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center`}>
              <Coffee className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-sm font-bold ${classes.textPrimary}`}>
                  {formatOrderDisplay(order)}
                </h1>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(order.order_status)}`}>
                  {order.order_status}
                </span>
              </div>
              <p className={`${classes.textSecondary} text-xs`}>
                {formatDate(order.order_date)} at {formatTime(order.order_time)} • {orderType === 'walkin' ? 'Walkin' : orderType === 'takeaway' ? 'Takeaway' : 'Delivery'} Order
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPrint?.(order, loyaltyRedemption)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs"
            >
              <Printer className="w-3 h-3" />
              Print
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onPrintToken?.(order, loyaltyRedemption)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors text-xs"
            >
              <Printer className="w-3 h-3" />
              Print Token
            </motion.button>
            {order.order_status === 'Preparing' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onMarkReady?.(order)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors text-xs"
              >
                <ChefHat className="w-3 h-3" />
                Mark Ready
              </motion.button>
            )}
            {/* Convert to Delivery button - show for walkin/takeaway in Pending, Preparing, Ready */}
            {['walkin', 'takeaway'].includes(orderType) &&
             ['Pending', 'Preparing', 'Ready'].includes(order.order_status) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowConvertModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs"
              >
                <Truck className="w-3 h-3" />
                Convert to Delivery
              </motion.button>
            )}
            {/* Reopen button - with permission check */}
            {permissions.hasPermission('REOPEN_ORDER') && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleReopenOrder}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs"
              >
                <RotateCcw className="w-3 h-3" />
                Reopen
              </motion.button>
            )}
            {/* Cancel button - with permission check */}
            {permissions.hasPermission('CANCEL_ORDER') && (
              <motion.button
                whileHover={{ scale: order.order_status === 'Cancelled' ? 1 : 1.02 }}
                whileTap={{ scale: order.order_status === 'Cancelled' ? 1 : 0.98 }}
                onClick={handleCancelOrder}
                disabled={order.order_status === 'Cancelled'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors text-xs ${
                  order.order_status === 'Cancelled'
                    ? 'bg-gray-400 cursor-not-allowed opacity-50'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <XCircle className="w-3 h-3" />
                Cancel
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                // Check if payment is pending/unpaid
                // BUT: If payment_method is 'Account', complete directly (customer ledger, no payment needed)
                const needsPayment = order.payment_status === 'Pending' && order.payment_method !== 'Account'

                if (needsPayment) {
                  setShowPaymentView(true)
                } else {
                  onComplete?.(order)
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-xs"
            >
              <Check className="w-3 h-3" />
              Complete
            </motion.button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <div className="grid grid-cols-4 gap-2">
          {/* Order Info Cards */}
          <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-md ${isDark ? 'bg-cyan-900/30' : 'bg-cyan-100'} flex items-center justify-center`}>
                <User className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
              </div>
              <div>
                <p className={`text-[10px] ${classes.textSecondary}`}>Created By</p>
                <p className={`font-semibold ${classes.textPrimary} text-xs`}>
                  {order.cashier_id
                    ? (order.cashiers?.name || 'Cashier')
                    : (order.users?.customer_name || 'Admin')}
                </p>
              </div>
            </div>
          </div>

          <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-md ${isDark ? 'bg-green-900/30' : 'bg-green-100'} flex items-center justify-center`}>
                <DollarSign className={`w-3.5 h-3.5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              </div>
              <div>
                <p className={`text-[10px] ${classes.textSecondary}`}>Total Amount</p>
                <p className={`font-bold ${classes.textPrimary} text-xs`}>Rs {order.total_amount}</p>
              </div>
            </div>
          </div>

          <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-md ${isDark ? 'bg-purple-900/30' : 'bg-purple-100'} flex items-center justify-center`}>
                <DollarSign className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <div>
                <p className={`text-[10px] ${classes.textSecondary}`}>Payment</p>
                <p className={`font-semibold ${classes.textPrimary} text-xs`}>{order.payment_method}</p>
                <p className={`text-[10px] ${getPaymentStatusColor(order.payment_status)}`}>{order.payment_status}</p>
              </div>
            </div>
          </div>

          <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-md ${isDark ? 'bg-orange-900/30' : 'bg-orange-100'} flex items-center justify-center`}>
                <Coffee className={`w-3.5 h-3.5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
              </div>
              <div>
                <p className={`text-[10px] ${classes.textSecondary}`}>Items</p>
                <p className={`font-semibold ${classes.textPrimary} text-xs`}>{orderItems.length} items</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items and Customer Info */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {/* Order Items - Takes 2 columns */}
          <div className={`col-span-2 ${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`font-bold ${classes.textPrimary} text-xs`}>Order Items</h3>
              <span className={`text-[10px] ${classes.textSecondary} px-1.5 py-0.5 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {orderItems.length} items
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className={`p-2 rounded-md ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} animate-pulse`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-md ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}></div>
                      <div className="flex-1">
                        <div className={`h-3 w-24 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded mb-1`}></div>
                        <div className={`h-2 w-16 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded`}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {orderItems.map((item, index) => {
                  // Parse deal products if this is a deal
                  let dealProducts = [];
                  if (item.is_deal && item.deal_products) {
                    try {
                      dealProducts = typeof item.deal_products === 'string'
                        ? JSON.parse(item.deal_products)
                        : item.deal_products;
                    } catch (e) {
                      console.error('Failed to parse deal_products:', e);
                    }
                  }

                  return (
                    <div key={item.id || `item-${index}`} className={`p-2 rounded-md ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-md ${item.is_deal ? (isDark ? 'bg-orange-900/30' : 'bg-orange-100') : (isDark ? 'bg-purple-900/30' : 'bg-purple-100')} flex items-center justify-center`}>
                          {item.is_deal ? (
                            <Gift className={`w-4 h-4 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                          ) : (
                            <span className={`text-xs font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                              {item.product_name?.charAt(0) || 'P'}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          {item.is_deal && (
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <Gift className={`w-2.5 h-2.5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                              <span className={`text-[9px] font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'} uppercase`}>DEAL</span>
                            </div>
                          )}
                          <div className={`font-semibold ${classes.textPrimary} text-xs`}>
                            {item.product_name}
                          </div>
                          {item.variant_name && !item.is_deal && (
                            <div className={`text-[10px] ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                              Size: {item.variant_name}
                            </div>
                          )}
                          {/* Display deal products breakdown */}
                          {item.is_deal && dealProducts.length > 0 && (
                            <div className="mt-0.5 space-y-0">
                              {dealProducts.map((dp, dpIndex) => {
                                const flavorName = dp.variant ||
                                  (dp.flavor ?
                                    (typeof dp.flavor === 'object' ? dp.flavor.name || dp.flavor.flavor_name : dp.flavor)
                                    : null);
                                return (
                                  <p key={dpIndex} className={`text-[9px] ${classes.textSecondary}`}>
                                    • {dp.quantity}x {dp.name}
                                    {flavorName && (
                                      <span className={`ml-0.5 ${isDark ? 'text-green-400' : 'text-green-600'} font-semibold`}>
                                        ({flavorName}
                                        {dp.priceAdjustment > 0 && ` +Rs ${dp.priceAdjustment}`})
                                      </span>
                                    )}
                                  </p>
                                );
                              })}
                            </div>
                          )}
                          <div className={`text-[10px] ${classes.textSecondary} ${item.is_deal && dealProducts.length > 0 ? 'mt-0.5' : ''}`}>
                            Qty: {item.quantity} × Rs {item.final_price} each
                          </div>
                        </div>
                        <div className={`font-bold ${classes.textPrimary} text-xs`}>
                          Rs {item.total_price?.toFixed(2) || (item.quantity * item.final_price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Customer Info and Payment Summary - Takes 1 column */}
          <div className="space-y-2">
            {/* Customer Information */}
            <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
              <div className="flex items-center gap-1.5 mb-2">
                <User className={`w-3 h-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'} text-[10px]`}>Customer Information</h3>
              </div>
              <div className="space-y-1">
                <p className={`font-semibold ${classes.textPrimary} text-xs`}>
                  {order.customers?.full_name || 'Walk-in Customer'}
                </p>
                {order.customers?.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className={`w-2.5 h-2.5 ${classes.textSecondary}`} />
                    <span className={`text-[10px] ${classes.textSecondary}`}>{order.customers.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Summary */}
            <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5 ${isDark ? 'bg-green-900/10' : 'bg-green-50'}`}>
              <h3 className={`font-bold ${classes.textPrimary} mb-2 text-[10px]`}>Payment Summary</h3>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className={`text-[10px] ${classes.textSecondary}`}>Subtotal:</span>
                  <span className={`text-[10px] ${classes.textPrimary}`}>Rs {order.subtotal?.toFixed(2) || order.total_amount}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between">
                    <span className={`text-[10px] ${classes.textSecondary}`}>Discount:</span>
                    <span className={`text-[10px] text-red-500`}>-Rs {order.discount_amount}</span>
                  </div>
                )}
                {loyaltyRedemption && loyaltyRedemption.discount_applied > 0 && (
                  <div className="flex justify-between">
                    <span className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Loyalty ({loyaltyRedemption.points_used} pts):</span>
                    <span className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>-Rs {loyaltyRedemption.discount_applied}</span>
                  </div>
                )}
                {order.delivery_charges > 0 && (
                  <div className="flex justify-between">
                    <span className={`text-[10px] ${classes.textSecondary}`}>Delivery Charges:</span>
                    <span className={`text-[10px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>+Rs {order.delivery_charges}</span>
                  </div>
                )}
                <div className={`flex justify-between pt-1.5 border-t ${classes.border}`}>
                  <span className={`font-bold ${classes.textPrimary} text-xs`}>Total:</span>
                  <span className={`font-bold ${isDark ? 'text-green-400' : 'text-green-600'} text-xs`}>Rs {order.total_amount}</span>
                </div>

                {/* Split Payment Details */}
                {order.payment_method === 'Split' && paymentTransactions.length > 0 && (
                  <div className={`pt-1.5 mt-1.5 border-t ${classes.border}`}>
                    <div className="flex items-center gap-1 mb-1.5">
                      <CreditCard className={`w-2.5 h-2.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Split Payment:</span>
                    </div>
                    <div className="space-y-1 pl-2">
                      {paymentTransactions.map((transaction, idx) => (
                        <div key={transaction.id || idx} className="flex justify-between">
                          <span className={`text-[10px] ${classes.textSecondary}`}>
                            {transaction.payment_method}:
                          </span>
                          <span className={`text-[10px] font-semibold ${classes.textPrimary}`}>
                            Rs {parseFloat(transaction.amount).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Order History */}
            <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border rounded-lg p-2.5`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <History className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <h3 className={`font-bold ${isDark ? 'text-purple-400' : 'text-purple-600'} text-[10px]`}>Order History & Changes</h3>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                  {orderHistory.length} event{orderHistory.length !== 1 ? 's' : ''}
                </span>
              </div>

              {orderHistory.length === 0 ? (
                <p className={`text-[10px] ${classes.textSecondary}`}>No history available</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {orderHistory.map((event, index) => {
                    const isModified = event.action_type === 'modified'
                    const isReopened = event.action_type === 'reopened'
                    const hasItemChanges = event.order_item_changes && event.order_item_changes.length > 0
                    const priceDiff = event.new_total && event.old_total ? parseFloat(event.new_total) - parseFloat(event.old_total) : null

                    return (
                      <motion.div
                        key={event.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className={`p-2 rounded-lg ${isDark ? 'bg-purple-900/20' : 'bg-purple-50'}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <p className={`text-[10px] font-medium ${classes.textPrimary}`}>
                              {event.cashier?.name || event.user?.customer_name || 'System'}
                            </p>
                            <p className={`text-[9px] ${classes.textSecondary}`}>
                              {formatHistoryTime(event.created_at)}
                            </p>
                          </div>
                        </div>

                        <p className={`text-[10px] font-semibold ${classes.textPrimary}`}>
                          {isModified && '📝 Items & pricing modified'}
                          {isReopened && '🔄 Order reopened'}
                          {event.action_type === 'payment_completed' && '💰 Payment completed'}
                          {event.action_type === 'status_changed_to_completed' && '✅ Completed'}
                          {event.action_type === 'status_changed_to_preparing' && '👨‍🍳 Preparing'}
                          {event.action_type === 'status_changed_to_ready' && '✓ Ready'}
                          {event.action_type === 'status_changed_to_cancelled' && '❌ Cancelled'}
                        </p>

                        {/* Item Changes */}
                        {hasItemChanges && (
                          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-700/30' : 'border-purple-200'}`}>
                            <div className={`text-[10px] font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'} uppercase mb-1.5 flex items-center`}>
                              <Package className="w-2.5 h-2.5 mr-1" />
                              Item Changes
                            </div>

                            <div className="space-y-1">
                              {event.order_item_changes.map((change, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-between p-1.5 rounded text-[10px] ${
                                    change.change_type === 'added'
                                      ? isDark ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-700'
                                      : change.change_type === 'removed'
                                      ? isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'
                                      : isDark ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {change.change_type === 'added' && <Plus className="w-2.5 h-2.5 flex-shrink-0" />}
                                    {change.change_type === 'removed' && <X className="w-2.5 h-2.5 flex-shrink-0" />}
                                    {change.change_type === 'quantity_changed' && <RefreshCw className="w-2.5 h-2.5 flex-shrink-0" />}
                                    <span className="truncate font-medium">
                                      {change.product_name}
                                      {change.variant_name && ` (${change.variant_name})`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] mt-0.5 font-semibold">
                                      {change.change_type === 'added' && `+${change.new_quantity}`}
                                      {change.change_type === 'removed' && `-${change.old_quantity}`}
                                      {change.change_type === 'quantity_changed' && `${change.old_quantity}→${change.new_quantity}`}
                                    </span>
                                    <span className="font-semibold">
                                      {change.change_type === 'added' && `+Rs${change.new_total?.toFixed(0)}`}
                                      {change.change_type === 'removed' && `-Rs${change.old_total?.toFixed(0)}`}
                                      {change.change_type === 'quantity_changed' && `Rs${change.new_total?.toFixed(0)}`}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Price Summary */}
                        {isModified && (event.old_total || event.new_total) && (
                          <div className={`mt-2 pt-2 border-t ${isDark ? 'border-purple-700/30' : 'border-purple-200'}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                Total: Rs{event.old_total?.toFixed(0)} → Rs{event.new_total?.toFixed(0)}
                              </span>
                              {priceDiff !== null && priceDiff !== 0 && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  priceDiff > 0
                                    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                                    : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                                }`}>
                                  {priceDiff > 0 ? '+' : ''}Rs{Math.abs(priceDiff).toFixed(0)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Convert to Delivery Modal */}
      <ConvertToDeliveryModal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        order={order}
        onSuccess={() => {
          setShowConvertModal(false)
          onConvertToDelivery?.()
          onClose?.()
        }}
      />

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`${classes.card} ${classes.shadow} shadow-xl rounded-xl p-6 max-w-md w-full mx-4`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-bold ${classes.textPrimary}`}>Cancel Order</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className={`p-1 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className={`${classes.textSecondary} mb-4 text-sm`}>
              Cancel Order {dailySerialManager.formatSerial(order.daily_serial)} - #{order.order_number}
            </p>

            <p className={`${classes.textPrimary} mb-4 text-sm font-medium`}>
              Please select a reason for cancelling this order
            </p>

            <div className="space-y-2 mb-6">
              {['Customer Request', 'Out of Stock', 'Wrong Order', 'Payment Issue', 'Other'].map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedCancelReason === reason
                      ? isDark ? 'bg-red-900/30 border-2 border-red-600' : 'bg-red-50 border-2 border-red-500'
                      : isDark ? 'bg-gray-700/50 border border-gray-600 hover:bg-gray-700' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={selectedCancelReason === reason}
                    onChange={(e) => setSelectedCancelReason(e.target.value)}
                    className="mr-3"
                  />
                  <span className={`text-sm ${classes.textPrimary}`}>{reason}</span>
                </label>
              ))}
            </div>

            {selectedCancelReason === 'Other' && (
              <div className="mb-6">
                <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                  Please specify reason
                </label>
                <textarea
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg ${classes.border} border ${isDark ? 'bg-gray-700 text-white' : 'bg-white'} focus:outline-none focus:ring-2 focus:ring-red-500`}
                  rows="3"
                  placeholder="Enter cancellation reason..."
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} ${classes.textPrimary} font-medium transition-colors`}
              >
                Keep Order
              </button>
              <button
                onClick={confirmCancelOrder}
                disabled={!selectedCancelReason || (selectedCancelReason === 'Other' && !customCancelReason)}
                className={`flex-1 px-4 py-2 rounded-lg ${
                  !selectedCancelReason || (selectedCancelReason === 'Other' && !customCancelReason)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white font-medium transition-colors`}
              >
                Cancel Order
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
