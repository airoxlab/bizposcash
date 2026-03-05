'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cacheManager } from '../../lib/cacheManager'
import { themeManager } from '../../lib/themeManager'
import { authManager } from '../../lib/authManager'
import { printerManager } from '../../lib/printerManager'
import { supabase } from '../../lib/supabase'
import { notify } from '../../components/ui/NotificationSystem'
import Modal from '../../components/ui/Modal'
import ProductGrid from '../../components/test/ProductGrid'
import VariantSelectionScreen from '../../components/test/VariantSelectionScreen'
import DealFlavorSelectionScreen from '../../components/test/DealFlavorSelectionScreen'
import CartSidebar from '../../components/test/CartSidebar'
import WalkinOrdersSidebar from '../../components/test/WalkinOrdersSidebar'
import WalkinOrderDetails from '../../components/test/WalkinOrderDetails'
import TableSelectionPanel from '../../components/test/TableSelectionPanel'
import { Users, ShoppingBag, Truck, FileText } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import SplitPaymentModal from '../../components/pos/SplitPaymentModal'

const ORDER_TABS = [
  {
    id: 'walkin',
    label: 'Walk-in',
    icon: Users,
    gradient: 'from-purple-500 to-indigo-600',
    activeColor: 'bg-gradient-to-b from-purple-500 to-indigo-600',
    storageKey: 'new_order_walkin'
  },
  {
    id: 'takeaway',
    label: 'Take Away',
    icon: ShoppingBag,
    gradient: 'from-orange-500 to-amber-500',
    activeColor: 'bg-gradient-to-b from-orange-500 to-amber-500',
    storageKey: 'new_order_takeaway'
  },
  {
    id: 'delivery',
    label: 'Delivery',
    icon: Truck,
    gradient: 'from-emerald-500 to-teal-600',
    activeColor: 'bg-gradient-to-b from-emerald-500 to-teal-600',
    storageKey: 'new_order_delivery'
  }
]

export default function NewOrderPage() {
  const router = useRouter()
  const productGridRef = useRef(null)
  const isInitialized = useRef(false)

  const [user, setUser] = useState(null)
  const [cashierData, setCashierData] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [categories, setCategories] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [deals, setDeals] = useState([])
  const [networkStatus, setNetworkStatus] = useState({ isOnline: true, unsyncedOrders: 0 })
  const [isDataReady, setIsDataReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [theme, setTheme] = useState('light')

  // Active order type tab
  const [activeOrderType, setActiveOrderType] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('new_order_active_type') || 'walkin') : 'walkin'
  )

  // Separate carts per order type
  const [carts, setCarts] = useState({ walkin: [], takeaway: [], delivery: [] })
  const [customers, setCustomers] = useState({ walkin: null, takeaway: null, delivery: null })
  const [instructions, setInstructions] = useState({ walkin: '', takeaway: '', delivery: '' })
  const [orderExtras, setOrderExtras] = useState({ walkin: {}, takeaway: {}, delivery: {} })

  // View state
  const [currentView, setCurrentView] = useState('products')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [productVariants, setProductVariants] = useState([])
  const [dealProducts, setDealProducts] = useState([])

  // Modals
  const [showExitModal, setShowExitModal] = useState(false)

  // Active orders sidebar
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [ordersRefreshTrigger, setOrdersRefreshTrigger] = useState(0)
  const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false)
  const [splitPaymentOrder, setSplitPaymentOrder] = useState(null)

  // Table selection (walkin only)
  const [selectedTable, setSelectedTable] = useState(null)

  const cart = carts[activeOrderType] || []
  const customer = customers[activeOrderType] || null
  const orderInstructions = instructions[activeOrderType] || ''

  // Persist carts to localStorage (also clear when empty to avoid stale data on reload)
  // Guard with isInitialized to avoid wiping localStorage before the mount restore runs
  useEffect(() => {
    if (!isInitialized.current) return
    ORDER_TABS.forEach(tab => {
      const c = carts[tab.id]
      if (c && c.length > 0) {
        localStorage.setItem(`${tab.storageKey}_cart`, JSON.stringify(c))
      } else {
        localStorage.removeItem(`${tab.storageKey}_cart`)
      }
    })
  }, [carts])

  useEffect(() => {
    if (!isInitialized.current) return
    ORDER_TABS.forEach(tab => {
      const instr = instructions[tab.id]
      if (instr) {
        localStorage.setItem(`${tab.storageKey}_instructions`, instr)
      } else {
        localStorage.removeItem(`${tab.storageKey}_instructions`)
      }
    })
  }, [instructions])

  useEffect(() => {
    if (!isInitialized.current) return
    ORDER_TABS.forEach(tab => {
      const c = customers[tab.id]
      if (c) {
        localStorage.setItem(`${tab.storageKey}_customer`, JSON.stringify(c))
      } else {
        localStorage.removeItem(`${tab.storageKey}_customer`)
      }
    })
  }, [customers])

  useEffect(() => {
    if (!isInitialized.current) return
    ORDER_TABS.forEach(tab => {
      const e = orderExtras[tab.id]
      if (e && Object.keys(e).length > 0) {
        localStorage.setItem(`${tab.storageKey}_extras`, JSON.stringify(e))
      } else {
        localStorage.removeItem(`${tab.storageKey}_extras`)
      }
    })
  }, [orderExtras])

  useEffect(() => {
    if (!isInitialized.current) return
    if (selectedTable) {
      localStorage.setItem('new_order_walkin_table', JSON.stringify(selectedTable))
    } else {
      localStorage.removeItem('new_order_walkin_table')
    }
  }, [selectedTable])

  useEffect(() => {
    localStorage.setItem('new_order_active_type', activeOrderType)
  }, [activeOrderType])

  // Load data on mount
  useEffect(() => {
    if (!authManager.isLoggedIn()) {
      router.push('/')
      return
    }

    const userData = authManager.getCurrentUser()
    const cashier = authManager.getCashier()
    const session = authManager.getCurrentSession()

    setUser(userData)
    setCashierData(cashier)
    setSessionId(session?.id)

    if (userData?.id) cacheManager.setUserId(userData.id)

    setTheme(themeManager.currentTheme)
    themeManager.applyTheme()

    // Restore carts, customers, instructions, extras, and table from localStorage
    const restoredCarts = { walkin: [], takeaway: [], delivery: [] }
    const restoredCustomers = { walkin: null, takeaway: null, delivery: null }
    const restoredInstructions = { walkin: '', takeaway: '', delivery: '' }
    const restoredExtras = { walkin: {}, takeaway: {}, delivery: {} }

    ORDER_TABS.forEach(tab => {
      const savedCart = localStorage.getItem(`${tab.storageKey}_cart`)
      const savedInstr = localStorage.getItem(`${tab.storageKey}_instructions`)
      const savedCustomer = localStorage.getItem(`${tab.storageKey}_customer`)
      const savedExtras = localStorage.getItem(`${tab.storageKey}_extras`)
      if (savedCart) try { restoredCarts[tab.id] = JSON.parse(savedCart) } catch {}
      if (savedInstr) restoredInstructions[tab.id] = savedInstr
      if (savedCustomer) try { restoredCustomers[tab.id] = JSON.parse(savedCustomer) } catch {}
      if (savedExtras) try { restoredExtras[tab.id] = JSON.parse(savedExtras) } catch {}
    })

    const savedTable = localStorage.getItem('new_order_walkin_table')
    if (savedTable) try { setSelectedTable(JSON.parse(savedTable)) } catch {}

    setCarts(restoredCarts)
    setCustomers(restoredCustomers)
    setInstructions(restoredInstructions)
    setOrderExtras(restoredExtras)
    isInitialized.current = true

    checkAndLoadData()

    const statusInterval = setInterval(() => {
      setNetworkStatus(cacheManager.getNetworkStatus())
    }, 1000)

    return () => clearInterval(statusInterval)
  }, [router])

  const checkAndLoadData = async () => {
    setIsLoading(true)
    try {
      if (cacheManager.isReady()) {
        loadCachedData()
        setIsDataReady(true)
        setIsLoading(false)
        return
      }

      const loadingId = notify.loading('Loading menu data...')
      let attempts = 0

      const checkInterval = setInterval(() => {
        attempts++
        if (cacheManager.isReady()) {
          clearInterval(checkInterval)
          notify.remove(loadingId)
          loadCachedData()
          setIsDataReady(true)
          setIsLoading(false)
        } else if (attempts >= 30) {
          clearInterval(checkInterval)
          notify.remove(loadingId)
          cacheManager.initializeCache().then(() => {
            if (cacheManager.isReady()) {
              loadCachedData()
              setIsDataReady(true)
            } else {
              notify.error('Failed to load menu data.')
            }
            setIsLoading(false)
          })
        }
      }, 500)
    } catch {
      setIsLoading(false)
    }
  }

  const loadCachedData = () => {
    setCategories(cacheManager.getCategories())
    setAllProducts(cacheManager.getProducts())
    setDeals(cacheManager.getDeals())
  }

  const handleTabSwitch = (tabId) => {
    setActiveOrderType(tabId)
    setCurrentView('products')
    setSelectedProduct(null)
    setSelectedDeal(null)
    setProductVariants([])
    setDealProducts([])
    setSelectedOrder(null)
  }

  const handleOrderSelect = (order) => {
    setSelectedOrder(order)
    setCurrentView('orders')
  }

  const handleTableClick = () => {
    if (currentView === 'tables') {
      setCurrentView('products')
    } else {
      setCurrentView('tables')
    }
  }

  const handleProductClick = (product) => {
    setSelectedProduct(product)
    const variants = cacheManager.getProductVariants(product.id)
    setProductVariants(variants)
    if (!variants || variants.length === 0) {
      handleAddToCart({
        id: `${product.id}-base-${Date.now()}`,
        productId: product.id,
        variantId: null,
        productName: product.name,
        variantName: null,
        basePrice: parseFloat(product.base_price),
        variantPrice: 0,
        finalPrice: parseFloat(product.base_price),
        quantity: 1,
        totalPrice: parseFloat(product.base_price),
        image: product.image_url
      })
    } else {
      setCurrentView('variant')
    }
  }

  const handleDealClick = (deal) => {
    if (deal?.scrollToDeals) {
      if (currentView !== 'products') {
        setCurrentView('products')
        setSelectedProduct(null)
        setSelectedDeal(null)
      }
      setTimeout(() => { if (productGridRef.current) productGridRef.current.scrollToDeals() }, 100)
      return
    }
    setSelectedDeal(deal)
    setDealProducts(cacheManager.getDealProducts(deal.id))
    setCurrentView('deal')
  }

  const handleAddToCart = (cartItem) => {
    setCarts(prev => {
      const currentCart = prev[activeOrderType] || []
      const existingIndex = currentCart.findIndex(item => {
        if (item.isDeal && cartItem.isDeal) return item.dealId === cartItem.dealId
        if (!item.isDeal && !cartItem.isDeal) return item.productId === cartItem.productId && item.variantId === cartItem.variantId
        return false
      })
      if (existingIndex !== -1) {
        const updated = [...currentCart]
        const existing = updated[existingIndex]
        const newQty = existing.quantity + cartItem.quantity
        updated[existingIndex] = { ...existing, quantity: newQty, totalPrice: existing.finalPrice * newQty }
        return { ...prev, [activeOrderType]: updated }
      }
      return { ...prev, [activeOrderType]: [...currentCart, cartItem] }
    })
    setCurrentView('products')
    setSelectedProduct(null)
    setSelectedDeal(null)
    setProductVariants([])
    setDealProducts([])
    const name = cartItem.isDeal ? cartItem.dealName : cartItem.productName
    toast.success(`${name} added!`, { duration: 1000 })
  }

  const updateCartItemQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) { removeCartItem(itemId); return }
    setCarts(prev => ({
      ...prev,
      [activeOrderType]: prev[activeOrderType].map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity, totalPrice: item.finalPrice * newQuantity } : item
      )
    }))
  }

  const updateItemInstruction = (itemId, instruction) => {
    setCarts(prev => ({
      ...prev,
      [activeOrderType]: prev[activeOrderType].map(item =>
        item.id === itemId ? { ...item, itemInstructions: instruction } : item
      )
    }))
  }

  const removeCartItem = (itemId) => {
    setCarts(prev => ({ ...prev, [activeOrderType]: prev[activeOrderType].filter(i => i.id !== itemId) }))
  }

  const handleClearCart = () => {
    setCarts(prev => ({ ...prev, [activeOrderType]: [] }))
  }

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + item.totalPrice, 0)
  const calculateTotal = () => calculateSubtotal()

  const handleBackClick = () => {
    if (currentView !== 'products') {
      setCurrentView('products')
      setSelectedProduct(null)
      setSelectedDeal(null)
      return
    }
    const hasAnyCart = Object.values(carts).some(c => c.length > 0)
    if (hasAnyCart) {
      setShowExitModal(true)
    } else {
      router.push('/dashboard/')
    }
  }

  const handleConfirmExit = () => {
    ORDER_TABS.forEach(tab => {
      localStorage.removeItem(`${tab.storageKey}_cart`)
      localStorage.removeItem(`${tab.storageKey}_customer`)
      localStorage.removeItem(`${tab.storageKey}_instructions`)
      localStorage.removeItem(`${tab.storageKey}_extras`)
    })
    localStorage.removeItem('new_order_walkin_table')
    setCarts({ walkin: [], takeaway: [], delivery: [] })
    setCustomers({ walkin: null, takeaway: null, delivery: null })
    setInstructions({ walkin: '', takeaway: '', delivery: '' })
    setOrderExtras({ walkin: {}, takeaway: {}, delivery: {} })
    setSelectedTable(null)
    notify.info('Order discarded')
    router.push('/dashboard/')
  }

  const handleOrderAndPay = () => {
    if (cart.length === 0) {
      notify.warning('Please add items to cart before proceeding')
      return
    }
    const tab = ORDER_TABS.find(t => t.id === activeOrderType)
    const extras = orderExtras[activeOrderType] || {}
    const orderData = {
      cart,
      customer,
      orderInstructions,
      subtotal: calculateSubtotal(),
      total: calculateTotal(),
      orderType: activeOrderType,
      cashierId: cashierData?.id || null,
      userId: user?.id,
      sessionId,
      tableId: activeOrderType === 'walkin' ? (selectedTable?.id || null) : null,
      tableName: activeOrderType === 'walkin' ? (selectedTable?.table_name || selectedTable?.table_number || null) : null,
      sourceStorageKey: tab?.storageKey || null,
      ...extras
    }
    localStorage.setItem('order_data', JSON.stringify(orderData))
    // Do NOT clear cart here — payment page clears it on success.
    // If user comes back from payment, cart is preserved.
    notify.info('Proceeding to payment...')
    router.push('/payment')
  }

  const classes = themeManager.getClasses()
  const isDark = themeManager.isDark()
  const activeTab = ORDER_TABS.find(t => t.id === activeOrderType)

  if (isLoading || !isDataReady) {
    return <div className={`h-screen w-screen ${classes.background}`} />
  }

  const tabBar = (
    <div className="flex items-center gap-2">
      {ORDER_TABS.map(tab => {
        const isActive = activeOrderType === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => handleTabSwitch(tab.id)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
              isActive
                ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md scale-105`
                : isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )

  const handlePrintOrder = async (order) => {
    try {
      if (!user?.id) { toast.error('User not logged in'); return }
      printerManager.setUserId(user.id)
      const printer = await printerManager.getPrinterForPrinting()
      if (!printer) { toast.error('No printer configured. Please configure a printer in settings.'); return }

      let orderItems = []
      if (order.id && navigator.onLine) {
        const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id)
        orderItems = data || []
      }
      if (!orderItems.length) orderItems = order.order_items || order.items || []

      const orderData = {
        orderNumber: order.order_number,
        dailySerial: order.daily_serial || null,
        orderType: order.order_type || 'walkin',
        customer: order.customers || { full_name: 'Guest' },
        deliveryAddress: order.delivery_address || order.customers?.addressline || order.customers?.address,
        orderInstructions: order.order_instructions,
        total: order.total_amount,
        subtotal: order.subtotal || order.total_amount,
        deliveryCharges: order.delivery_charges || 0,
        discountAmount: order.discount_amount || 0,
        loyaltyDiscountAmount: 0,
        loyaltyPointsRedeemed: 0,
        discountType: 'amount',
        cart: orderItems.map(item => item.is_deal
          ? { isDeal: true, dealId: item.deal_id, dealName: item.product_name, dealProducts: (() => { try { return typeof item.deal_products === 'string' ? JSON.parse(item.deal_products) : (item.deal_products || []) } catch(e) { return [] } })(), quantity: item.quantity, totalPrice: item.total_price, itemInstructions: item.item_instructions || null }
          : { isDeal: false, productName: item.product_name, variantName: item.variant_name, quantity: item.quantity, totalPrice: item.total_price, itemInstructions: item.item_instructions || null }
        ),
        paymentMethod: order.payment_method || 'Unpaid',
      }

      const userProfileRaw = JSON.parse(localStorage.getItem('user_profile') || localStorage.getItem('user') || '{}')
      const cashierName = order.cashier_id ? (order.cashiers?.name || 'Cashier') : (order.users?.customer_name || 'Admin')
      const userProfile = {
        store_name: userProfileRaw?.store_name || '',
        store_address: userProfileRaw?.store_address || '',
        phone: userProfileRaw?.phone || '',
        store_logo: localStorage.getItem('store_logo_local') || userProfileRaw?.store_logo || null,
        qr_code: localStorage.getItem('qr_code_local') || userProfileRaw?.qr_code || null,
        hashtag1: userProfileRaw?.hashtag1 || '',
        hashtag2: userProfileRaw?.hashtag2 || '',
        show_footer_section: userProfileRaw?.show_footer_section !== false,
        show_logo_on_receipt: userProfileRaw?.show_logo_on_receipt !== false,
        show_business_name_on_receipt: userProfileRaw?.show_business_name_on_receipt !== false,
        cashier_name: order.cashier_id ? cashierName : null,
        customer_name: !order.cashier_id ? cashierName : null,
      }

      const result = await printerManager.printReceipt(orderData, userProfile, printer)
      if (!result.success) throw new Error(result.error || 'Print failed')
    } catch (error) {
      console.error('Print error:', error)
      toast.error(`Print failed: ${error.message}`)
    }
  }

  const handlePrintToken = async (order) => {
    try {
      if (!user?.id) { toast.error('User not logged in'); return }
      printerManager.setUserId(user.id)
      const printer = await printerManager.getPrinterForPrinting()
      if (!printer) { toast.error('No printer configured. Please configure a printer in settings.'); return }

      let orderItems = []
      if (order.id && navigator.onLine) {
        const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id)
        orderItems = data || []
      }
      if (!orderItems.length) orderItems = order.order_items || order.items || []

      const mappedItems = orderItems.map(item => item.is_deal
        ? { isDeal: true, name: item.product_name, quantity: item.quantity, dealProducts: (() => { try { return typeof item.deal_products === 'string' ? JSON.parse(item.deal_products) : (item.deal_products || []) } catch(e) { return [] } })(), instructions: item.item_instructions || '' }
        : { isDeal: false, name: item.product_name, size: item.variant_name, quantity: item.quantity, instructions: item.item_instructions || '' }
      )

      const orderData = {
        orderNumber: order.order_number,
        dailySerial: order.daily_serial || null,
        orderType: order.order_type || 'walkin',
        customerName: order.customers?.full_name || '',
        customerPhone: order.customers?.phone || '',
        specialNotes: order.order_instructions || '',
        deliveryAddress: order.delivery_address || order.customers?.addressline || order.customers?.address || '',
        items: mappedItems,
      }

      const userProfileRaw = JSON.parse(localStorage.getItem('user_profile') || localStorage.getItem('user') || '{}')
      const cashierName = order.cashier_id ? (order.cashiers?.name || 'Cashier') : (order.users?.customer_name || 'Admin')
      const userProfile = {
        store_name: userProfileRaw?.store_name || 'KITCHEN',
        cashier_name: order.cashier_id ? cashierName : null,
        customer_name: !order.cashier_id ? cashierName : null,
      }

      const result = await printerManager.printKitchenToken(orderData, userProfile, printer)
      if (!result.success) throw new Error(result.error || 'Print failed')
    } catch (error) {
      console.error('Kitchen token print error:', error)
      toast.error(`Print failed: ${error.message}`)
    }
  }

  const handleOrderStatusUpdate = async (order, newStatus) => {
    try {
      const result = await cacheManager.updateOrderStatus(order.id, newStatus)
      if (!result.success) throw new Error(result.message || 'Failed to update order status')
      if (newStatus === 'Completed') {
        setSelectedOrder(null)
        setCurrentView('products')
        setOrdersRefreshTrigger(prev => prev + 1)
      } else {
        setOrdersRefreshTrigger(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      toast.error('Failed to update order status')
    }
  }

  const handlePaymentRequired = async (order, paymentData) => {
    try {
      // Split payment: open modal
      if (paymentData?.useSplitPayment) {
        setSplitPaymentOrder(order)
        setShowSplitPaymentModal(true)
        return
      }

      // Split payment results (array of {method, amount})
      if (Array.isArray(paymentData)) {
        const totalPaid = paymentData.reduce((sum, p) => sum + parseFloat(p.amount), 0)
        const transactions = paymentData.map(payment => ({
          order_id: order.id,
          payment_method: payment.method,
          amount: parseFloat(payment.amount),
          reference_number: payment.reference || null,
          notes: payment.notes || null,
          created_at: new Date().toISOString()
        }))

        if (navigator.onLine) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ payment_method: 'Split', payment_status: 'Paid', amount_paid: totalPaid, updated_at: new Date().toISOString() })
            .eq('id', order.id)
          if (updateError) throw updateError

          const { error: txError } = await supabase.from('order_payment_transactions').insert(transactions)
          if (txError) throw txError
          cacheManager.setPaymentTransactions?.(order.id, transactions)
        } else {
          const orderIndex = cacheManager.cache.orders.findIndex(o => o.id === order.id)
          if (orderIndex !== -1) {
            cacheManager.cache.orders[orderIndex] = {
              ...cacheManager.cache.orders[orderIndex],
              payment_method: 'Split',
              payment_status: 'Paid',
              amount_paid: totalPaid,
              updated_at: new Date().toISOString(),
              _isSynced: false
            }
            await cacheManager.saveCacheToStorage()
          }
          cacheManager.setPaymentTransactions?.(order.id, transactions)
        }

        toast.success(`Order #${order.order_number} paid and completed!`)
        await handleOrderStatusUpdate(order, 'Completed')
        setOrdersRefreshTrigger(prev => prev + 1)
        return
      }

      // Regular payment
      if (navigator.onLine) {
        const { error } = await supabase
          .from('orders')
          .update({
            payment_method: paymentData.paymentMethod,
            payment_status: 'Paid',
            amount_paid: paymentData.newTotal,
            discount_amount: paymentData.discountAmount || 0,
            discount_percentage: paymentData.discountType === 'percentage' ? paymentData.discountValue : 0,
            total_amount: paymentData.newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)
        if (error) throw error

        // Account payment: create customer ledger entry
        if (paymentData.paymentMethod === 'Account' && order.customer_id) {
          try {
            const currentUser = authManager.getCurrentUser()
            if (currentUser?.id) {
              const customerLedgerModule = await import('../../lib/customerLedgerManager')
              const customerLedgerManager = customerLedgerModule.default
              customerLedgerManager.setUserId(currentUser.id)

              const { data: existing } = await supabase
                .from('customer_ledger')
                .select('*')
                .eq('order_id', order.id)
                .eq('user_id', currentUser.id)
                .eq('transaction_type', 'debit')
                .maybeSingle()

              if (existing) {
                if (existing.amount !== paymentData.newTotal) {
                  await supabase.from('customer_ledger').delete().eq('id', existing.id)
                  const currentBalance = await customerLedgerManager.getCustomerBalance(order.customer_id)
                  await supabase.from('customer_ledger').insert({
                    user_id: currentUser.id, customer_id: order.customer_id,
                    transaction_type: 'debit', amount: paymentData.newTotal,
                    balance_before: currentBalance, balance_after: currentBalance + paymentData.newTotal,
                    order_id: order.id,
                    description: `Order #${order.order_number} - ${(order.order_type || 'WALKIN').toUpperCase()}`,
                    notes: 'Payment completed via inline payment modal', created_by: currentUser.id
                  })
                }
              } else {
                const currentBalance = await customerLedgerManager.getCustomerBalance(order.customer_id)
                await supabase.from('customer_ledger').insert({
                  user_id: currentUser.id, customer_id: order.customer_id,
                  transaction_type: 'debit', amount: paymentData.newTotal,
                  balance_before: currentBalance, balance_after: currentBalance + paymentData.newTotal,
                  order_id: order.id,
                  description: `Order #${order.order_number} - ${(order.order_type || 'WALKIN').toUpperCase()}`,
                  notes: 'Payment completed via inline payment modal', created_by: currentUser.id
                })
              }
            }
          } catch (ledgerError) {
            console.error('Failed to handle customer ledger:', ledgerError)
            // Don't fail payment if ledger update fails
          }
        }
      } else {
        const orderIndex = cacheManager.cache.orders.findIndex(o => o.id === order.id)
        if (orderIndex !== -1) {
          cacheManager.cache.orders[orderIndex] = {
            ...cacheManager.cache.orders[orderIndex],
            payment_method: paymentData.paymentMethod,
            payment_status: 'Paid',
            amount_paid: paymentData.newTotal,
            discount_amount: paymentData.discountAmount || 0,
            total_amount: paymentData.newTotal,
            updated_at: new Date().toISOString(),
            _isSynced: false
          }
          await cacheManager.saveCacheToStorage()
        }
      }

      if (paymentData.completeOrder === false) {
        setSelectedOrder(prev => prev?.id === order.id
          ? { ...prev, payment_status: 'Paid', payment_method: paymentData.paymentMethod, amount_paid: paymentData.newTotal, total_amount: paymentData.newTotal }
          : prev)
        toast.success('Payment recorded successfully')
        setOrdersRefreshTrigger(prev => prev + 1)
        return
      }

      toast.success(`Order #${order.order_number} paid and completed!`)
      await handleOrderStatusUpdate(order, 'Completed')
    } catch (error) {
      toast.error(`Payment failed: ${error?.message}`)
    }
  }

  const handleCompleteAlreadyPaidOrder = async (order) => {
    try {
      if (!order) { setOrdersRefreshTrigger(prev => prev + 1); return }
      toast.success(`Order #${order.order_number} completed!`)
      await handleOrderStatusUpdate(order, 'Completed')
    } catch (error) {
      toast.error(`Failed to complete order: ${error?.message}`)
    }
  }

  return (
    <div className={`h-screen flex ${classes.background} overflow-hidden transition-all duration-500`}>
      <Toaster position="top-center" toastOptions={{ duration: 2000 }} />

      {/* Main POS Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar - Always-visible active orders with type tabs */}
        <WalkinOrdersSidebar
          onOrderSelect={handleOrderSelect}
          onClose={() => {}}
          classes={classes}
          isDark={isDark}
          selectedOrderId={selectedOrder?.id}
          onTableClick={handleTableClick}
          selectedTable={selectedTable}
          onBackClick={handleBackClick}
          orderType={activeOrderType}
          refreshTrigger={ordersRefreshTrigger}
          showTypeTabs={true}
          categories={categories}
          allProducts={allProducts}
          deals={deals}
          onCategoryClick={(id) => productGridRef.current?.scrollToCategory(id)}
          onDealsClick={() => productGridRef.current?.scrollToDeals()}
        />

      {/* Center - Dynamic Content */}
      {currentView === 'products' && (
        <ProductGrid
          ref={productGridRef}
          categories={categories}
          deals={deals}
          allProducts={allProducts}
          onProductClick={handleProductClick}
          onDealClick={handleDealClick}
          classes={classes}
          isDark={isDark}
          networkStatus={networkStatus}
          headerCenter={tabBar}
        />
      )}

      {currentView === 'variant' && (
        <VariantSelectionScreen
          product={selectedProduct}
          variants={productVariants}
          onAddToCart={handleAddToCart}
          onBack={() => setCurrentView('products')}
          classes={classes}
          isDark={isDark}
        />
      )}

      {currentView === 'deal' && (
        <DealFlavorSelectionScreen
          deal={selectedDeal}
          dealProducts={dealProducts}
          onAddToCart={handleAddToCart}
          onBack={() => setCurrentView('products')}
          classes={classes}
          isDark={isDark}
        />
      )}

      {currentView === 'tables' && (
        <TableSelectionPanel
          onSelectTable={(table) => {
            setSelectedTable(table)
            setCurrentView('products')
          }}
          selectedTable={selectedTable}
          classes={classes}
          isDark={isDark}
          onClose={() => setCurrentView('products')}
        />
      )}

      {currentView === 'orders' && selectedOrder && (
        <WalkinOrderDetails
          order={selectedOrder}
          classes={classes}
          isDark={isDark}
          orderType={selectedOrder.order_type || activeOrderType}
          onClose={() => {
            setSelectedOrder(null)
            setCurrentView('products')
          }}
          onPrint={() => handlePrintOrder(selectedOrder)}
          onPrintToken={() => handlePrintToken(selectedOrder)}
          onMarkReady={(order) => handleOrderStatusUpdate(order, 'Ready')}
          onComplete={handleCompleteAlreadyPaidOrder}
          onPaymentRequired={handlePaymentRequired}
          onConvertToDelivery={() => {
            setOrdersRefreshTrigger(prev => prev + 1)
            setSelectedOrder(null)
            setCurrentView('products')
            notify.success('Order converted! Check the delivery page.')
          }}
        />
      )}

      {/* Right - Cart */}
      <CartSidebar
        cart={cart}
        customer={customer}
        orderInstructions={orderInstructions}
        onUpdateQuantity={updateCartItemQuantity}
        onRemoveItem={removeCartItem}
        onOrderAndPay={handleOrderAndPay}
        onClearCart={handleClearCart}
        calculateSubtotal={calculateSubtotal}
        calculateTotal={calculateTotal}
        classes={classes}
        isDark={isDark}
        networkStatus={networkStatus}
        orderType={activeOrderType}
        isReopenedOrder={false}
        onInstructionsChange={(val) => setInstructions(prev => ({ ...prev, [activeOrderType]: val }))}
        onUpdateItemInstruction={updateItemInstruction}
        inlineCustomer={true}
        onCustomerChange={(c) => setCustomers(prev => ({ ...prev, [activeOrderType]: c }))}
        orderData={orderExtras[activeOrderType] || {}}
        onOrderDataChange={(data) => setOrderExtras(prev => ({ ...prev, [activeOrderType]: data }))}
        selectedTable={activeOrderType === 'walkin' ? selectedTable : null}
        onChangeTable={handleTableClick}
      />

      </div>{/* end flex flex-1 overflow-hidden */}

      {/* Split Payment Modal */}
      {showSplitPaymentModal && splitPaymentOrder && (
        <SplitPaymentModal
          isOpen={showSplitPaymentModal}
          onClose={() => { setShowSplitPaymentModal(false); setSplitPaymentOrder(null) }}
          totalAmount={splitPaymentOrder.total_amount}
          amountDue={splitPaymentOrder.total_amount}
          customer={splitPaymentOrder.customers}
          onPaymentComplete={async (paymentData) => {
            setShowSplitPaymentModal(false)
            setSplitPaymentOrder(null)
            await handlePaymentRequired(splitPaymentOrder, paymentData)
          }}
          isDark={isDark}
          classes={classes}
        />
      )}

      {/* Exit Confirmation Modal */}
      <Modal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        title="Exit new order?"
        maxWidth="max-w-md"
      >
        <div className="text-center space-y-6">
          <div className={`w-16 h-16 ${isDark ? 'bg-yellow-900/20' : 'bg-yellow-100'} rounded-full flex items-center justify-center mx-auto`}>
            <FileText className={`w-8 h-8 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
          </div>
          <p className={`${classes.textSecondary}`}>
            You have items in your cart. Discard and exit?
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setShowExitModal(false)}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmExit}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all"
            >
              Discard & Exit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
