'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Coffee, RefreshCw, ArrowLeft, Table2, ClipboardList, X, Truck, AlertCircle, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { authManager } from '../../lib/authManager'
import { cacheManager } from '../../lib/cacheManager'
import dailySerialManager from '../../lib/utils/dailySerialManager'

export default function WalkinOrdersSidebar({
  onOrderSelect,
  onClose,
  classes,
  isDark,
  selectedOrderId,
  onTableClick,
  selectedTable,
  onBackClick,
  orderType = 'walkin', // 'walkin' or 'takeaway'
  refreshTrigger = 0 // Increment to trigger a refresh
}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchPendingOrders()

    // 🆕 CRITICAL FIX: Listen for order updates from cache
    const handleOrdersUpdated = (event) => {
      console.log('📡 [WalkinOrdersSidebar] Orders updated event received:', event.detail)
      // Only refresh if the order type matches
      if (event.detail?.orderType === orderType) {
        console.log('🔄 [WalkinOrdersSidebar] Auto-refreshing orders due to cache update')
        fetchPendingOrders()
      }
    }

    window.addEventListener('ordersUpdated', handleOrdersUpdated)

    return () => {
      window.removeEventListener('ordersUpdated', handleOrdersUpdated)
    }
  }, [orderType])

  // Refresh orders when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchPendingOrders()
    }
  }, [refreshTrigger])

  const fetchPendingOrders = async () => {
    try {
      setRefreshing(true)
      const user = authManager.getCurrentUser()
      if (!user) return

      // Check if online - use both navigator.onLine and cacheManager for reliability
      const isOnline = navigator.onLine && cacheManager.isOnline
      console.log(`📡 [WalkinOrdersSidebar] Fetching orders - Online: ${isOnline}`)

      if (isOnline) {
        // Fetch from Supabase when online - include order_items for offline compatibility
        const { data, error} = await supabase
          .from('orders')
          .select(`
            *,
            customers (
              id,
              full_name,
              phone
            ),
            tables (
              id,
              table_number,
              table_name
            ),
            delivery_boys (
              id,
              name,
              phone,
              vehicle_type
            ),
            cashiers!orders_cashier_id_fkey (
              id,
              name
            ),
            users (
              id,
              customer_name
            ),
            order_items (
              id,
              product_id,
              variant_id,
              product_name,
              variant_name,
              base_price,
              variant_price,
              final_price,
              quantity,
              total_price,
              is_deal,
              deal_id,
              deal_products
            )
          `)
          .eq('user_id', user.id)
          .eq('order_type', orderType)
          .in('order_status', ['Pending', 'Preparing', 'Ready', 'Dispatched'])
          .order('created_at', { ascending: false })

        if (error) throw error

        // Also store items as 'items' property for consistency with cache
        const ordersWithItems = (data || []).map(order => ({
          ...order,
          items: order.order_items || []
        }))

        // Fetch payment transactions for split payment orders
        const splitOrders = ordersWithItems.filter(order => order.payment_method === 'Split')
        if (splitOrders.length > 0) {
          console.log(`💳 [WalkinOrdersSidebar] Fetching payment transactions for ${splitOrders.length} split orders`)

          const splitOrderIds = splitOrders.map(o => o.id)
          const { data: transactions, error: txError } = await supabase
            .from('order_payment_transactions')
            .select('*')
            .in('order_id', splitOrderIds)
            .order('created_at', { ascending: true })

          if (!txError && transactions) {
            // Cache transactions for offline use - set them in the Map WITHOUT saving yet
            const txByOrder = transactions.reduce((acc, tx) => {
              if (!acc[tx.order_id]) acc[tx.order_id] = []
              acc[tx.order_id].push(tx)
              return acc
            }, {})

            // Set all transactions in cache Map (without calling save each time)
            splitOrders.forEach(order => {
              const orderTx = txByOrder[order.id] || []
              if (orderTx.length > 0) {
                // Directly set in Map without saving
                cacheManager.cache.paymentTransactions.set(order.id, orderTx)
                console.log(`💾 [WalkinOrdersSidebar] Prepared ${orderTx.length} transactions for order ${order.id}`)
              }
            })

            console.log(`✅ [WalkinOrdersSidebar] Prepared payment transactions for ${Object.keys(txByOrder).length} split orders`)
          } else if (txError) {
            console.error('❌ [WalkinOrdersSidebar] Error fetching payment transactions:', txError)
          }
        }

        // Enrich with daily serial numbers
        const ordersWithSerials = cacheManager.enrichOrdersWithSerials(ordersWithItems)

        // IMPORTANT: Update cache with fetched orders so they're available offline
        // Only update orders that match our filter criteria (Pending/Preparing/Ready)
        const existingCachedOrders = cacheManager.getAllOrders()
        const fetchedOrderNumbers = new Set(ordersWithSerials.map(o => o.order_number))

        // Smart cache update strategy:
        // 1. Keep truly offline orders (not synced yet) - these are new orders created offline
        // 2. Remove any previously cached orders that match this order type but aren't in the fetch
        //    (they've likely been completed/cancelled and filtered out by the query)
        // 3. Add/update with freshly fetched orders
        const offlineOrders = existingCachedOrders.filter(o => !o._isSynced)
        const otherTypeOrders = existingCachedOrders.filter(o =>
          o._isSynced && o.order_type !== orderType
        )

        const updatedCache = [
          ...offlineOrders,
          ...otherTypeOrders,
          ...ordersWithSerials.map(o => ({ ...o, _isSynced: true, _isOffline: false }))
        ]

        console.log(`🧹 [WalkinOrdersSidebar] Cache cleanup:`)
        console.log(`  - Kept ${offlineOrders.length} offline orders`)
        console.log(`  - Kept ${otherTypeOrders.length} orders of other types`)
        console.log(`  - Added ${ordersWithSerials.length} fresh ${orderType} orders`)
        console.log(`  - Total: ${existingCachedOrders.length} → ${updatedCache.length} orders`)

        // Update the cache manually (since we're not using createOrder)
        cacheManager.cache.orders = updatedCache

        // Save everything (orders + payment transactions) to localStorage in one go
        await cacheManager.saveCacheToStorage()
        console.log(`💾 [WalkinOrdersSidebar] Saved ${ordersWithSerials.length} orders + ${cacheManager.cache.paymentTransactions.size} payment transaction entries to cache`)
        console.log(`📊 [WalkinOrdersSidebar] Cache now has ${cacheManager.cache.paymentTransactions.size} orders with payment transactions`)

        setOrders(ordersWithSerials)
        console.log(`📦 [Orders] Loaded ${data?.length || 0} ${orderType} orders from Supabase`)
      } else {
        // Use cached orders when offline
        console.log(`📴 [WalkinOrdersSidebar] OFFLINE MODE - Loading from cache`)
        const cachedOrders = cacheManager.getAllOrders()
        console.log(`📦 [WalkinOrdersSidebar] Cache has ${cachedOrders.length} total orders`)
        console.log(`💳 [WalkinOrdersSidebar] Cache has ${cacheManager.cache.paymentTransactions.size} orders with payment transactions`)

        const filteredOrders = cachedOrders.filter(order =>
          order.order_type === orderType &&
          ['Pending', 'Preparing', 'Ready', 'Dispatched'].includes(order.order_status)
        )
        console.log(`✅ [WalkinOrdersSidebar] Filtered to ${filteredOrders.length} ${orderType} pending orders`)

        // Get table info from cache for walkin orders
        if (orderType === 'walkin') {
          const tables = cacheManager.getAllTables()
          filteredOrders.forEach(order => {
            if (order.table_id) {
              const table = tables.find(t => t.id === order.table_id)
              if (table) {
                order.tables = {
                  id: table.id,
                  table_number: table.table_number,
                  table_name: table.table_name
                }
              }
            }
          })
        }

        // Get delivery boy info from cache for delivery orders
        if (orderType === 'delivery') {
          const deliveryBoys = cacheManager.getAllDeliveryBoys()
          filteredOrders.forEach(order => {
            if (order.delivery_boy_id) {
              const rider = deliveryBoys.find(r => r.id === order.delivery_boy_id)
              if (rider) {
                order.delivery_boys = {
                  id: rider.id,
                  name: rider.name,
                  phone: rider.phone,
                  vehicle_type: rider.vehicle_type
                }
              }
            }
          })
        }

        // Ensure order items are accessible (cached orders may have items or order_items)
        filteredOrders.forEach(order => {
          if (!order.items && order.order_items) {
            order.items = order.order_items
          }
          if (!order.order_items && order.items) {
            order.order_items = order.items
          }
        })

        // Enrich with daily serial numbers (cached orders already have daily_serial if created today)
        const ordersWithSerials = cacheManager.enrichOrdersWithSerials(filteredOrders)
        setOrders(ordersWithSerials)
        console.log(`📦 [Orders] Loaded ${filteredOrders.length} ${orderType} orders from cache (offline)`)
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error)

      // Fallback to cached orders on error
      const cachedOrders = cacheManager.getAllOrders()
      const filteredOrders = cachedOrders.filter(order =>
        order.order_type === orderType &&
        ['Pending', 'Preparing', 'Ready'].includes(order.order_status)
      )

      // Ensure order items are accessible
      filteredOrders.forEach(order => {
        if (!order.items && order.order_items) {
          order.items = order.order_items
        }
        if (!order.order_items && order.items) {
          order.order_items = order.items
        }
      })

      const ordersWithSerials = cacheManager.enrichOrdersWithSerials(filteredOrders)
      setOrders(ordersWithSerials)
      console.log(`📦 [Orders] Fallback to ${filteredOrders.length} cached orders due to error`)
    } finally {
      setLoading(false)
      setRefreshing(false)
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
      default:
        return isDark
          ? 'bg-gray-700 text-gray-300'
          : 'bg-gray-100 text-gray-600'
    }
  }

  const formatTime = (timeString) => {
    if (!timeString) return ''
    const [hours, minutes] = timeString.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const formatOrderNumber = (orderNumber) => {
    if (!orderNumber) return ''
    return `#${orderNumber.slice(-9)}`
  }

  const formatOrderDisplay = (order) => {
    if (!order || !order.order_number) return ''

    const formattedOrderNumber = formatOrderNumber(order.order_number)

    // Only show serial for today's orders
    if (order.daily_serial) {
      const formattedSerial = dailySerialManager.formatSerial(order.daily_serial)
      return `${formattedSerial} ${formattedOrderNumber}`
    }

    // For old orders, just show order number
    return formattedOrderNumber
  }

  return (
    <div className={`w-64 ${classes.card} ${classes.shadow} shadow-xl ${classes.border} border-r flex flex-col`}>
      {/* Header - Same as CategorySidebar */}
      <div className={`p-4 ${classes.border} border-b ${classes.card}`}>
        <motion.button
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBackClick}
          className={`flex items-center ${classes.textSecondary} hover:${classes.textPrimary} transition-colors mb-3 group`}
        >
          <div className={`w-8 h-8 rounded-full ${classes.button} group-hover:${classes.shadow} group-hover:shadow-sm flex items-center justify-center mr-3 transition-colors`}>
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm">Back to Dashboard</span>
        </motion.button>

        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className={`text-xl font-bold ${classes.textPrimary}`}>
              New Order
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Orders Icon - Active state */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className={`p-2.5 rounded-lg transition-all relative ${isDark ? 'bg-blue-600/30 border border-blue-500' : 'bg-blue-100 border border-blue-400'}`}
              title="View pending orders"
            >
              <ClipboardList className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            </motion.button>

            {/* Table Selection Icon - Only for walkin */}
            {orderType === 'walkin' && onTableClick && (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={onTableClick}
                className={`p-2.5 rounded-lg transition-all relative ${
                  selectedTable
                    ? (isDark ? 'bg-green-600/30 border border-green-500' : 'bg-green-100 border border-green-400')
                    : (isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200')
                }`}
                title={selectedTable ? `Table: ${selectedTable.table_name || selectedTable.table_number}` : 'Select Table'}
              >
                <Table2 className={`w-5 h-5 ${selectedTable ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-gray-300' : 'text-gray-600')}`} />
                {selectedTable && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"></div>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Orders Section Header */}
      <div className="p-3 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs font-semibold ${classes.textSecondary} uppercase tracking-wider`}>
            Active Orders
          </h3>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchPendingOrders}
              disabled={refreshing}
              className={`p-1.5 rounded-md transition-all ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
              title="Refresh orders"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''} ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className={`p-1.5 rounded-md transition-all ${isDark ? 'bg-red-900/40 hover:bg-red-900/60' : 'bg-red-50 hover:bg-red-100'}`}
              title="Close orders view"
            >
              <X className={`w-3.5 h-3.5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-scroll p-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {loading ? (
          // Loading skeletons
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} animate-pulse`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-gray-600' : 'bg-gray-200'} mr-2`}></div>
                    <div>
                      <div className={`h-4 w-24 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded mb-1`}></div>
                      <div className={`h-3 w-16 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded`}></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`h-4 w-14 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded mb-1`}></div>
                    <div className={`h-3 w-10 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded`}></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className={`h-3 w-20 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded`}></div>
                  <div className={`h-5 w-16 ${isDark ? 'bg-gray-600' : 'bg-gray-200'} rounded-full`}></div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          // Empty state
          <div className="text-center py-8">
            <div className={`w-16 h-16 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Coffee className={`w-8 h-8 ${classes.textSecondary}`} />
            </div>
            <p className={`${classes.textSecondary} text-sm`}>No active orders</p>
          </div>
        ) : (
          // Orders list
          <div className="space-y-2">
            {orders.map((order) => (
              <motion.button
                key={order.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onOrderSelect(order)}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                  selectedOrderId === order.id
                    ? isDark
                      ? 'bg-green-900/30 border border-green-700'
                      : 'bg-green-50 border border-green-300'
                    : isDark
                      ? 'bg-gray-700/50 hover:bg-gray-700'
                      : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'} flex items-center justify-center mr-2`}>
                      <Coffee className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <div>
                      <div className={`font-semibold ${classes.textPrimary} text-sm`}>
                        {formatOrderDisplay(order)}
                      </div>
                      <div className={`text-xs ${classes.textSecondary}`}>
                        {orderType === 'walkin' ? 'Walkin' : orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${isDark ? 'text-green-400' : 'text-green-600'} text-sm`}>
                      Rs {order.total_amount}
                    </div>
                    <div className={`text-xs ${classes.textSecondary}`}>
                      {formatTime(order.order_time)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className={`text-xs ${classes.textSecondary} truncate max-w-[120px]`}>
                    {order.customers?.full_name || 'Walk-in Customer'}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(order.order_status)}`}>
                    {order.order_status}
                  </span>
                </div>

                {/* Show table info for walkin orders */}
                {orderType === 'walkin' && order.tables && (
                  <div className={`flex items-center gap-1 mt-1.5 pt-1.5 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                    <Table2 className={`w-3 h-3 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                    <span className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'} font-medium`}>
                      {order.tables.table_name || `Table ${order.tables.table_number}`}
                    </span>
                  </div>
                )}

                {/* Show rider info for delivery orders */}
                {orderType === 'delivery' && (
                  <div className={`flex items-center gap-1 mt-1.5 pt-1.5 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                    {order.delivery_boys ? (
                      <>
                        <Truck className={`w-3 h-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'} font-medium`}>
                          {order.delivery_boys.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className={`w-3 h-3 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                        <span className={`text-xs ${isDark ? 'text-orange-400' : 'text-orange-600'} font-medium`}>
                          No rider assigned
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Show cashier/admin info */}
                <div className={`flex items-center gap-1 mt-1.5 pt-1.5 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                  <User className={`w-3 h-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} font-medium`}>
                    {order.cashier_id
                      ? (order.cashiers?.name || 'Cashier')
                      : (order.users?.customer_name || 'Admin')}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
