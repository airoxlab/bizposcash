'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  ShoppingBag,
  Truck,
  Receipt,
  FileText,
  BarChart3,
  Printer,
  Settings,
  Sun,
  Moon,
  User,
  Store,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  LogOut,
  Bell,
  MessageSquare,
  Shield,
  UserCircle,
  ChefHat,
  Globe,
  Database,
  X,
  Trash2,
  CloudUpload,
  Download
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { useRouter } from 'next/navigation'
import { cacheManager } from '../../lib/cacheManager'
import { themeManager } from '../../lib/themeManager'
import { authManager } from '../../lib/authManager'
import { webOrderNotificationManager } from '../../lib/webOrderNotification'
import { networkPrintListener } from '../../lib/networkPrintListener'
import ProtectedPage from '../../components/ProtectedPage'
import { usePermissions, permissionManager } from '../../lib/permissionManager'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cacheStatus, setCacheStatus] = useState({
    isInitialized: false,
    isLoading: false,
    error: null,
    networkStatus: { isOnline: true, unsyncedOrders: 0, lastSync: null, isSyncing: false }
  })
  const [theme, setTheme] = useState('light')
  const [pendingWebOrders, setPendingWebOrders] = useState(0)
  const router = useRouter()
  const permissions = usePermissions()

  useEffect(() => {
    // Check authentication first
    if (!authManager.isLoggedIn()) {
      router.push('/')
      return
    }

    const userData = authManager.getCurrentUser()
    const role = authManager.getRole()
    const name = authManager.getDisplayName()
    
    setUser(userData)
    setUserRole(role)
    setDisplayName(name)

    console.log('👤 Dashboard loaded for:', name, '(', role, ')')

    // Set user ID in cache manager for filtering
    if (userData?.id) {
      cacheManager.setUserId(userData.id)
      webOrderNotificationManager.setUserId(userData.id)

      console.log('👤 [Dashboard] Setting up web order notifications for user:', userData.id)

      // Start listening for new web orders
      webOrderNotificationManager.startListening(async (newOrder) => {
        console.log('🔔 [Dashboard] Notification callback triggered for order:', newOrder?.order_number)
        // Update pending count when new order arrives
        const count = await webOrderNotificationManager.getPendingCount()
        console.log('📊 [Dashboard] Updated pending count:', count)
        setPendingWebOrders(count)
      })

      // Initial fetch of pending count
      webOrderNotificationManager.getPendingCount().then(count => {
        console.log('📊 [Dashboard] Initial pending count:', count)
        setPendingWebOrders(count)
      })

      // Set up network print listener for print servers
      console.log('🖨️ [Dashboard] Setting up network print listener for user:', userData.id)
      networkPrintListener.setUserId(userData.id)

      // Load printer preferences from database (persists across sessions)
      // Fall back to localStorage if database doesn't have the values yet
      const isServerMode = userData.is_print_server ?? (localStorage.getItem('is_print_server') === 'true')
      const shareMode = userData.share_printer_mode ?? (localStorage.getItem('share_printer_mode') === 'true')

      // Sync to localStorage for quick access
      localStorage.setItem('is_print_server', isServerMode.toString())
      localStorage.setItem('share_printer_mode', shareMode.toString())

      console.log('🖨️ [Dashboard] Printer preferences loaded:', { isServerMode, shareMode })

      networkPrintListener.setIsServer(isServerMode)

      // Start listening if server mode is on
      if (isServerMode) {
        console.log('✅ [Dashboard] Starting network print listener (server mode ON)')
        networkPrintListener.startListening()
      } else {
        console.log('⏹️ [Dashboard] Server mode OFF, listener not started')
      }
    }

    // Load and apply theme
    setTheme(themeManager.currentTheme)
    themeManager.applyTheme()

    // Initialize cache only on first load
    initializeCache()

    // Update time every second and refresh pending count every 30 seconds
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      // Update network status
      setCacheStatus(prev => ({
        ...prev,
        networkStatus: cacheManager.getNetworkStatus()
      }))
    }, 1000)

    const countRefreshTimer = setInterval(async () => {
      if (userData?.id) {
        const count = await webOrderNotificationManager.getPendingCount()
        setPendingWebOrders(count)
      }
    }, 30000) // Refresh every 30 seconds

    // Start background sync
    cacheManager.startBackgroundSync()

    return () => {
      clearInterval(timer)
      clearInterval(countRefreshTimer)
      webOrderNotificationManager.stopListening()
      // Don't stop networkPrintListener here - it should persist across pages
      // It will be stopped on logout (authManager) or when "I am Server" is toggled OFF (printer page)
    }
  }, [router])

  const initializeCache = async () => {
    try {
      setCacheStatus(prev => ({ ...prev, isLoading: true, error: null }))
      
      // Only force refresh if explicitly requested, otherwise use cache
      const success = await cacheManager.initializeCache(false)
      
      setCacheStatus(prev => ({
        ...prev,
        isInitialized: success,
        isLoading: false,
        error: success ? null : 'Failed to load some data - working offline',
        networkStatus: cacheManager.getNetworkStatus()
      }))

    } catch (error) {
      console.error('Cache initialization error:', error)
      setCacheStatus(prev => ({
        ...prev,
        isLoading: false,
        error: 'Cache initialization failed',
        networkStatus: cacheManager.getNetworkStatus()
      }))
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    themeManager.setTheme(newTheme)
  }

  const handleRefreshCache = async () => {
    setCacheStatus(prev => ({ ...prev, isLoading: true }))
    try {
      // Refresh cache data (products, categories, etc.)
      console.log('🔄 Refreshing cache and permissions...')
      await cacheManager.refreshData()

      // Also refresh permissions silently
      const permResult = await permissionManager.forceReloadFromServer()

      if (permResult.success) {
        console.log(`✅ Cache and permissions refreshed! ${permResult.count} permissions loaded`)
      }

      setCacheStatus(prev => ({
        ...prev,
        isLoading: false,
        networkStatus: cacheManager.getNetworkStatus()
      }))
    } catch (error) {
      console.error('Refresh error:', error)
      setCacheStatus(prev => ({
        ...prev,
        isLoading: false,
        networkStatus: cacheManager.getNetworkStatus()
      }))
    }
  }

  const handleLogout = async () => {
    await authManager.logout()
    router.push('/')
  }

  const handleDownloadTestLedger = () => {
    try {
      // Create a new PDF document
      const doc = new jsPDF()

      // Add title
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('Test Ledger Report', 105, 20, { align: 'center' })

      // Add subtitle
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' })
      doc.text(`Store: ${user?.store_name || 'BizPOS'}`, 105, 38, { align: 'center' })
      doc.text(`User: ${displayName} (${userRole})`, 105, 46, { align: 'center' })

      // Add a line
      doc.setDrawColor(0, 0, 0)
      doc.line(20, 52, 190, 52)

      // Add sample data header
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Sample Ledger Entries:', 20, 62)

      // Add sample data table
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      let yPos = 72

      const sampleData = [
        { date: '2026-02-10', description: 'Product Sales', debit: '15,250.00', credit: '-', balance: '15,250.00' },
        { date: '2026-02-10', description: 'Supplier Payment', debit: '-', credit: '8,500.00', balance: '6,750.00' },
        { date: '2026-02-11', description: 'Product Sales', debit: '22,100.00', credit: '-', balance: '28,850.00' },
        { date: '2026-02-11', description: 'Rent Expense', debit: '-', credit: '5,000.00', balance: '23,850.00' },
        { date: '2026-02-12', description: 'Product Sales', debit: '18,750.00', credit: '-', balance: '42,600.00' },
      ]

      // Table header
      doc.setFont('helvetica', 'bold')
      doc.text('Date', 20, yPos)
      doc.text('Description', 45, yPos)
      doc.text('Debit', 110, yPos)
      doc.text('Credit', 140, yPos)
      doc.text('Balance', 170, yPos)
      yPos += 5
      doc.line(20, yPos, 190, yPos)
      yPos += 5

      // Table data
      doc.setFont('helvetica', 'normal')
      sampleData.forEach(row => {
        doc.text(row.date, 20, yPos)
        doc.text(row.description, 45, yPos)
        doc.text(row.debit, 110, yPos)
        doc.text(row.credit, 140, yPos)
        doc.text(row.balance, 170, yPos)
        yPos += 8
      })

      // Add footer line
      yPos += 5
      doc.line(20, yPos, 190, yPos)
      yPos += 8

      // Add summary
      doc.setFont('helvetica', 'bold')
      doc.text('Total Debit:', 110, yPos)
      doc.text('56,100.00', 170, yPos)
      yPos += 6
      doc.text('Total Credit:', 110, yPos)
      doc.text('13,500.00', 170, yPos)
      yPos += 6
      doc.setFontSize(12)
      doc.text('Final Balance:', 110, yPos)
      doc.text('42,600.00', 170, yPos)

      // Add footer
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.text('This is a test ledger generated by BizPOS v1.0.1', 105, 280, { align: 'center' })
      doc.text('Auto-Update Demo - Powered by jsPDF', 105, 285, { align: 'center' })

      // Save the PDF
      doc.save(`Test-Ledger-${new Date().toISOString().split('T')[0]}.pdf`)

      console.log('✅ Test ledger PDF downloaded successfully!')
    } catch (error) {
      console.error('❌ Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const orderTypeCards = [
    {
      id: 'walkin',
      title: 'Walk In',
      description: 'Quick service for dine-in customers',
      icon: Users,
      gradient: 'from-emerald-500 to-teal-600',
      route: '/walkin',
      permissionKey: 'SALES_WALKIN'
    },
    {
      id: 'takeaway',
      title: 'Take Away',
      description: 'Orders for pickup',
      icon: ShoppingBag,
      gradient: 'from-blue-500 to-cyan-600',
      route: '/takeaway',
      permissionKey: 'SALES_TAKEAWAY'
    },
    {
      id: 'delivery',
      title: 'Delivery',
      description: 'Home delivery orders',
      icon: Truck,
      gradient: 'from-orange-500 to-red-600',
      route: '/delivery',
      permissionKey: 'SALES_DELIVERY'
    },
    // {
    //   id: 'test',
    //   title: 'Test',
    //   description: 'Test delivery orders',
    //   icon: Truck,
    //   gradient: 'from-orange-500 to-red-600',
    //   route: '/test'
    // }
  ]

  const bottomMenuItems = [

    {
      id: 'expenses',
      title: 'Expenses',
      icon: Receipt,
      gradient: 'from-purple-500 to-indigo-600',
      route: '/expenses',
      permissionKey: 'EXPENSES'
    },
    {
      id: 'orders',
      title: 'Orders',
      icon: FileText,
      gradient: 'from-pink-500 to-rose-600',
      route: '/orders',
      permissionKey: 'ORDERS'
    },
    {
      id: 'web-orders',
      title: 'Web Orders',
      icon: Globe,
      gradient: 'from-purple-500 to-pink-600',
      route: '/web-orders',
      permissionKey: 'WEB_ORDERS'
    },
    {
      id: 'kds',
      title: 'Kitchen Display',
      icon: ChefHat,
      gradient: 'from-orange-500 to-red-600',
      route: '/kds',
      permissionKey: 'KDS'
    },
    {
      id: 'riders',
      title: 'Riders Orders',
      icon: Truck,
      gradient: 'from-blue-500 to-cyan-600',
      route: '/riders',
      permissionKey: 'RIDERS'
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: BarChart3,
      gradient: 'from-green-500 to-emerald-600',
      route: '/reports',
      permissionKey: 'REPORTS'
    },
    {
      id: 'marketing',
      title: 'Marketing',
      icon: MessageSquare,
      gradient: 'from-cyan-500 to-blue-600',
      route: '/marketing',
      permissionKey: 'MARKETING'
    },
    {
      id: 'test-ledger',
      title: 'Test Ledger PDF',
      icon: Download,
      gradient: 'from-purple-500 to-pink-600',
      action: 'download-ledger', // Special action instead of route
      permissionKey: null // No permission needed for demo
    }
  ]

  const handleNavigation = (route, permissionKey) => {
    // Debug logging
    console.log('🔍 Navigation attempt:', { route, permissionKey })

    // Check permission before navigation
    const hasPermission = permissions.hasPermission(permissionKey)
    console.log('🔍 Has permission?', hasPermission)

    if (permissionKey && !hasPermission) {
      console.log('❌ Navigation blocked - no permission for:', permissionKey)
      return // Do nothing if no permission
    }

    console.log('✅ Navigation allowed, pushing route:', route)
    router.push(route)
  }

  // Helper to check if user has permission for a card
  const hasCardPermission = (permissionKey) => {
    if (!permissionKey) return true // No permission required
    return permissions.hasPermission(permissionKey)
  }

  // Get theme classes from theme manager
  const themeClasses = themeManager.getClasses()
  const isDark = themeManager.isDark()

  // Get role badge color
  const getRoleBadge = () => {
    if (userRole === 'admin') {
      return {
        bg: isDark ? 'bg-purple-900/30' : 'bg-purple-100',
        text: isDark ? 'text-purple-300' : 'text-purple-700',
        icon: Shield
      }
    } else {
      return {
        bg: isDark ? 'bg-blue-900/30' : 'bg-blue-100',
        text: isDark ? 'text-blue-300' : 'text-blue-700',
        icon: UserCircle
      }
    }
  }

  const roleBadge = getRoleBadge()

  if (!user) {
    return (
      <div className={`min-h-screen ${themeClasses.background} flex items-center justify-center transition-all duration-500`}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <ProtectedPage permissionKey="DASHBOARD" pageName="Dashboard">
      <div className={`h-screen w-screen overflow-hidden ${themeClasses.background} transition-all duration-500`}>
      {/* Enhanced Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full ${themeClasses.header} backdrop-blur-lg 
               ${themeClasses.border} border-b shadow-lg`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-3 items-center">
            {/* Left: User Info with Role Badge */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Store className="w-6 h-6 text-white" />
                </div>
                {/* Role Indicator Badge */}
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${roleBadge.bg} rounded-full flex items-center justify-center border-2 ${themeClasses.border}`}>
                  <roleBadge.icon className={`w-3 h-3 ${roleBadge.text}`} />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className={`text-2xl font-bold ${themeClasses.textPrimary}`}>
                    Welcome, {displayName}
                  </h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge.bg} ${roleBadge.text}`}>
                    {userRole?.toUpperCase()}
                  </span>
                </div>
                <p className={`${themeClasses.textSecondary} font-medium`}>
                  {user.store_name}
                </p>
              </div>
            </div>

            {/* Center: Time and Date */}
            <div className="text-center">
              <motion.div 
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className={`text-4xl font-bold ${themeClasses.textPrimary} mb-1`}
              >
                {formatTime(currentTime)}
              </motion.div>
              <div className={`text-sm ${themeClasses.textSecondary}`}>
                {formatDate(currentTime)}
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center justify-end space-x-3">
              {/* Network Status */}
              <div className="flex items-center space-x-2">
                {cacheStatus.networkStatus.isOnline ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
                
                {cacheStatus.networkStatus.unsyncedOrders > 0 && (
                  <div className={`flex items-center space-x-1 ${isDark ? 'bg-orange-900' : 'bg-orange-100'} px-2 py-1 rounded-full`}>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className={`text-xs font-medium ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                      {cacheStatus.networkStatus.unsyncedOrders}
                    </span>
                  </div>
                )}
                
                {cacheStatus.networkStatus.isSyncing && (
                  <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                )}
              </div>

              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefreshCache}
                disabled={cacheStatus.isLoading}
                className={`p-3 rounded-xl ${themeClasses.button} transition-all disabled:opacity-50`}
                title="Refresh Cache & Permissions - Sync data and check for updated access rights"
              >
                <RefreshCw className={`w-5 h-5 ${themeClasses.textSecondary} ${cacheStatus.isLoading ? 'animate-spin' : ''}`} />
              </motion.button>

              {/* Theme Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className={`p-3 rounded-xl ${themeClasses.button} transition-all`}
              >
                <AnimatePresence mode="wait">
                  {theme === 'dark' ? (
                    <motion.div
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Sun className="w-5 h-5 text-yellow-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Moon className={`w-5 h-5 ${themeClasses.textSecondary}`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Sync Status / Notifications */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  if (cacheStatus.networkStatus.unsyncedOrders > 0) {
                    console.log('🔄 Manual sync triggered from dashboard')
                    const result = await cacheManager.syncOfflineData()
                    console.log('📊 Sync result:', result)
                    setCacheStatus(prev => ({
                      ...prev,
                      networkStatus: cacheManager.getNetworkStatus()
                    }))
                  }
                }}
                className={`p-3 rounded-xl ${themeClasses.button} transition-all relative ${cacheStatus.networkStatus.unsyncedOrders > 0 ? 'cursor-pointer' : ''}`}
                title={cacheStatus.networkStatus.unsyncedOrders > 0
                  ? `Click to sync ${cacheStatus.networkStatus.unsyncedOrders} pending order(s)`
                  : 'No pending orders'}
              >
                <Bell className={`w-5 h-5 ${themeClasses.textSecondary}`} />
                {cacheStatus.networkStatus.unsyncedOrders > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full">
                    {cacheStatus.networkStatus.unsyncedOrders}
                  </span>
                )}
              </motion.button>

              {/* Offline Orders Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigation('/offline-orders', 'OFFLINE_ORDERS')}
                className={`p-3 rounded-xl ${themeClasses.button} transition-all relative ${!permissions.hasPermission('OFFLINE_ORDERS') ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={cacheStatus.networkStatus.unsyncedOrders > 0
                  ? `View ${cacheStatus.networkStatus.unsyncedOrders} offline order(s)`
                  : 'No offline orders'}
              >
                <Database className={`w-5 h-5 ${themeClasses.textSecondary}`} />
                {cacheStatus.networkStatus.unsyncedOrders > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                    {cacheStatus.networkStatus.unsyncedOrders}
                  </span>
                )}
              </motion.button>

              {/* Printer Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigation('/printer', 'PRINTERS')}
                className={`p-3 rounded-xl ${themeClasses.button} transition-all ${!permissions.hasPermission('PRINTERS') ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Printer"
              >
                <Printer className={`w-5 h-5 ${themeClasses.textSecondary}`} />
              </motion.button>

              {/* Settings Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigation('/settings', 'SETTINGS')}
                className={`p-3 rounded-xl ${themeClasses.button} transition-all ${!permissions.hasPermission('SETTINGS') ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Settings"
              >
                <Settings className={`w-5 h-5 ${themeClasses.textSecondary}`} />
              </motion.button>

              {/* Logout Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white hover:shadow-lg transition-all"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Cache Status Bar */}
        <AnimatePresence>
          {(cacheStatus.isLoading || cacheStatus.error) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`${themeClasses.border} border-t px-6 py-3`}
            >
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {cacheStatus.isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                      <span className={`${isDark ? 'text-blue-300' : 'text-blue-700'} font-medium`}>Loading menu data...</span>
                    </>
                  ) : cacheStatus.error ? (
                    <>
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      <span className={`${isDark ? 'text-orange-300' : 'text-orange-700'} font-medium`}>{cacheStatus.error}</span>
                    </>
                  ) : null}
                </div>
                
                {cacheStatus.networkStatus.lastSync && (
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Last sync: {new Date(cacheStatus.networkStatus.lastSync).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 w-full h-[calc(100vh-80px)] overflow-y-auto px-4 py-6">
        {/* Order Type Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {orderTypeCards.map((card, index) => {
              const hasPermission = hasCardPermission(card.permissionKey)
              return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                whileHover={hasPermission ? { y: -10, scale: 1.02 } : {}}
                whileTap={hasPermission ? { scale: 0.98 } : {}}
                onClick={() => handleNavigation(card.route, card.permissionKey)}
                className={`${hasPermission ? 'cursor-pointer' : 'cursor-not-allowed'} group relative`}
              >
                <div className={`relative overflow-hidden rounded-3xl shadow-xl ${hasPermission ? 'hover:shadow-2xl' : 'opacity-60'} transition-all duration-300`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} ${!hasPermission ? 'opacity-50' : 'opacity-90'}`}></div>
                  {!hasPermission && (
                    <div className="absolute top-3 right-3 z-20">
                      <div className="bg-red-500/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                        <Shield className="w-3.5 h-3.5" />
                        LOCKED
                      </div>
                    </div>
                  )}
                  <div className="relative p-8 text-center text-white">
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                      className="w-20 h-20 mx-auto mb-6 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                    >
                      <card.icon className="w-10 h-10" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
                    <p className="text-white/80 font-medium">{card.description}</p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </motion.div>
            )})}
          </div>
        </motion.div>

        {/* Bottom Menu */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className={`text-2xl font-bold ${themeClasses.textPrimary} mb-6 text-center`}>
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {bottomMenuItems.map((item, index) => {
              const hasPermission = hasCardPermission(item.permissionKey)
              return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                whileHover={hasPermission ? { y: -5, scale: 1.05 } : {}}
                whileTap={hasPermission ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (item.action === 'download-ledger') {
                    handleDownloadTestLedger()
                  } else {
                    handleNavigation(item.route, item.permissionKey)
                  }
                }}
                className={`${hasPermission ? 'cursor-pointer' : 'cursor-not-allowed'} group`}
              >
                <div className={`${themeClasses.card} rounded-2xl p-4 ${themeClasses.shadow} ${hasPermission ? 'hover:shadow-xl' : 'opacity-60'} transition-all duration-300 ${themeClasses.border} border relative`}>
                  {!hasPermission && (
                    <div className="absolute -top-2 -right-2 z-20">
                      <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                        <Shield className="w-2.5 h-2.5" />
                        LOCKED
                      </div>
                    </div>
                  )}
                  <motion.div
                    whileHover={hasPermission ? { rotate: 10, scale: 1.1 } : {}}
                    className={`w-10 h-10 mx-auto mb-3 bg-gradient-to-r ${item.gradient} rounded-xl flex items-center justify-center shadow-lg relative`}
                  >
                    <item.icon className="w-5 h-5 text-white" />
                    {/* Show badge for web orders with pending count */}
                    {item.id === 'web-orders' && pendingWebOrders > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{
                          repeat: Infinity,
                          duration: 2,
                          ease: "easeInOut"
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white text-sm font-bold rounded-full min-w-[28px] h-7 px-2 flex items-center justify-center shadow-lg border-2 border-white z-10"
                      >
                        {pendingWebOrders}
                      </motion.div>
                    )}
                  </motion.div>
                  <h4 className={`text-center font-medium text-sm ${themeClasses.textPrimary}`}>
                    {item.title}
                  </h4>
                </div>
              </motion.div>
            )})}
          </div>
        </motion.div>
      </main>
      </div>
    </ProtectedPage>
  )
}
