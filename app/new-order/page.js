'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cacheManager } from '../../lib/cacheManager'
import { themeManager } from '../../lib/themeManager'
import { authManager } from '../../lib/authManager'
import { notify } from '../../components/ui/NotificationSystem'
import Modal from '../../components/ui/Modal'
import ProductGrid from '../../components/test/ProductGrid'
import VariantSelectionScreen from '../../components/test/VariantSelectionScreen'
import DealFlavorSelectionScreen from '../../components/test/DealFlavorSelectionScreen'
import CartSidebar from '../../components/test/CartSidebar'
import WalkinOrdersSidebar from '../../components/test/WalkinOrdersSidebar'
import TableSelectionPanel from '../../components/test/TableSelectionPanel'
import { Users, ShoppingBag, Truck, FileText } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

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

  // Table selection (walkin only)
  const [selectedTable, setSelectedTable] = useState(null)

  const cart = carts[activeOrderType] || []
  const customer = customers[activeOrderType] || null
  const orderInstructions = instructions[activeOrderType] || ''

  // Persist carts to localStorage
  useEffect(() => {
    ORDER_TABS.forEach(tab => {
      const c = carts[tab.id]
      if (c && c.length > 0) {
        localStorage.setItem(`${tab.storageKey}_cart`, JSON.stringify(c))
      }
    })
  }, [carts])

  useEffect(() => {
    ORDER_TABS.forEach(tab => {
      const c = customers[tab.id]
      if (c) localStorage.setItem(`${tab.storageKey}_customer`, JSON.stringify(c))
    })
  }, [customers])

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

    // Restore carts from localStorage
    const restoredCarts = { walkin: [], takeaway: [], delivery: [] }
    const restoredCustomers = { walkin: null, takeaway: null, delivery: null }
    const restoredInstructions = { walkin: '', takeaway: '', delivery: '' }

    ORDER_TABS.forEach(tab => {
      const savedCart = localStorage.getItem(`${tab.storageKey}_cart`)
      const savedCustomer = localStorage.getItem(`${tab.storageKey}_customer`)
      const savedInstr = localStorage.getItem(`${tab.storageKey}_instructions`)
      if (savedCart) try { restoredCarts[tab.id] = JSON.parse(savedCart) } catch {}
      if (savedCustomer) try { restoredCustomers[tab.id] = JSON.parse(savedCustomer) } catch {}
      if (savedInstr) restoredInstructions[tab.id] = savedInstr
    })

    setCarts(restoredCarts)
    setCustomers(restoredCustomers)
    setInstructions(restoredInstructions)

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
    setCurrentView('products')
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
    setCarts(prev => ({ ...prev, [activeOrderType]: [...(prev[activeOrderType] || []), cartItem] }))
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
    })
    setCarts({ walkin: [], takeaway: [], delivery: [] })
    notify.info('Order discarded')
    router.push('/dashboard/')
  }

  const handleOrderAndPay = () => {
    if (cart.length === 0) {
      notify.warning('Please add items to cart before proceeding')
      return
    }
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
      ...extras
    }
    localStorage.setItem('order_data', JSON.stringify(orderData))
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
      />

      </div>{/* end flex flex-1 overflow-hidden */}

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
