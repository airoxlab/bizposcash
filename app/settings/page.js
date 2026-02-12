'use client'

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Settings,
  User,
  Palette,
  Moon,
  Sun,
  Check,
  Camera,
  Upload,
  Save,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Store,
  UserCircle,
  ImageIcon,
  X,
  AlertCircle,
  Wifi,
  WifiOff,
  CreditCard,
  QrCode,
  Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { notify } from '../../components/ui/NotificationSystem';
import themeManager from '../../lib/themeManager';
import { authManager } from '../../lib/authManager';
import { profileManager } from '../../lib/profileManager';
import { supabase } from '../../lib/supabaseClient';
import ProtectedPage from '../../components/ProtectedPage';

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const qrFileInputRef = useRef(null)

  const [user, setUser] = useState(null)
  const [currentTheme, setCurrentTheme] = useState('light')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  const [personalInfo, setPersonalInfo] = useState({
    customer_name: '',
    email: '',
    store_name: '',
    phone: '',
    store_address: '',
    store_logo: '',
    qr_code: '',
    invoice_status: 'unpaid',
    hashtag1: '',
    hashtag2: '',
    show_footer_section: true,
    show_logo_on_receipt: true,
    show_business_name_on_receipt: true,
    business_start_time: '10:00',
    business_end_time: '03:00'
  })

  const [tempLogo, setTempLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [tempQrCode, setTempQrCode] = useState(null)
  const [qrPreview, setQrPreview] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    // Check authentication
    if (!authManager.isLoggedIn()) {
      router.push('/')
      return
    }

    const userData = authManager.getCurrentUser()
    console.log('🔍 authManager.getCurrentUser:', userData)
    setUser(userData)

    // Load and apply theme
    setCurrentTheme(themeManager.currentTheme)
    themeManager.applyTheme()

    // Initialize profile data
    initializeProfileData()

    // Monitor network status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  const initializeProfileData = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Initializing profile data in settings...')

      // Always fetch directly from database to ensure we have latest hashtags
      await fetchUserDataDirectly()
    } catch (error) {
      console.error('❌ Error initializing profile data:', error)
      notify.error('Failed to load profile data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserDataDirectly = async () => {
    try {
      console.log('🔄 Trying direct fetch from Supabase...')
      
      const userEmail = profileManager.getCurrentUserEmail()
      
      if (!userEmail) {
        console.error('❌ No user email found in localStorage or authManager')
        notify.error('No user authentication found. Please login again.')
        return
      }

      console.log('📧 Fetching data for email:', userEmail)

      const { data, error } = await supabase
        .from("users")
        .select("customer_name, email, store_name, phone, store_address, store_logo, qr_code, invoice_status, hashtag1, hashtag2, show_footer_section, show_logo_on_receipt, show_business_name_on_receipt, business_start_time, business_end_time")
        .eq("email", userEmail)
        .single()

      if (error) {
        console.error("❌ Error fetching user:", error.message)
        notify.error('Failed to load profile data: ' + error.message)
        return
      }

      if (data) {
        console.log('📦 Raw data from Supabase:', data)
        console.log('📦 hashtag1 from DB:', data?.hashtag1, '(type:', typeof data?.hashtag1, ')')
        console.log('📦 hashtag2 from DB:', data?.hashtag2, '(type:', typeof data?.hashtag2, ')')
        console.log('📦 show_footer_section from DB:', data?.show_footer_section, '(type:', typeof data?.show_footer_section, ')')
        console.log('📦 show_logo_on_receipt from DB:', data?.show_logo_on_receipt, '(type:', typeof data?.show_logo_on_receipt, ')')

        const profileData = {
          customer_name: data?.customer_name || "",
          email: data?.email || "",
          store_name: data?.store_name || "",
          phone: data?.phone || "",
          store_address: data?.store_address || "",
          store_logo: data?.store_logo || "",
          qr_code: data?.qr_code || "",
          invoice_status: data?.invoice_status || "unpaid",
          hashtag1: data?.hashtag1 || "",
          hashtag2: data?.hashtag2 || "",
          show_footer_section: data?.show_footer_section === false ? false : true, // Default true if null/undefined
          show_logo_on_receipt: data?.show_logo_on_receipt === false ? false : true, // Default true if null/undefined
          show_business_name_on_receipt: data?.show_business_name_on_receipt === false ? false : true, // Default true if null/undefined
          business_start_time: data?.business_start_time || "10:00",
          business_end_time: data?.business_end_time || "03:00"
        }

        console.log('✅ Direct fetch successful:', profileData)
        console.log('✅ Parsed hashtag1:', profileData.hashtag1)
        console.log('✅ Parsed hashtag2:', profileData.hashtag2)
        console.log('✅ Parsed show_footer_section:', profileData.show_footer_section)
        setPersonalInfo(profileData)
        setLogoPreview(profileData.store_logo || '')
        setQrPreview(profileData.qr_code || '')
        profileManager.saveLocalProfile(profileData)

        // Save logo locally for receipts
        if (profileData.store_logo) {
          await profileManager.saveLogoLocally(profileData.store_logo)
        }

        // Save QR code locally for receipts
        if (profileData.qr_code) {
          await profileManager.saveQrLocally(profileData.qr_code)
        }

        notify.success('Profile data loaded successfully')
      } else {
        console.log('⚠️ No data found for user:', userEmail)
        notify.warning('No profile data found for your account')
      }
    } catch (error) {
      console.error('❌ Direct fetch error:', error)
      notify.error('Failed to load profile data. Please check your connection.')
    }
  }

  const handleThemeChange = (themeName) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentTheme(themeName)
    themeManager.setTheme(themeName)
    setTimeout(() => {
      setIsTransitioning(false)
    }, 300)
    showSaveMessage('Theme updated successfully!')
  }

  const handlePersonalInfoChange = (field, value) => {
    console.log(`📝 Updating field ${field}:`, value)
    setPersonalInfo(prev => ({
      ...prev,
      [field]: value
    }))

    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }
  }

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      console.log('📤 Processing logo upload:', file.name)
      
      const validation = await profileManager.validateImageFile(file)
      if (!validation.isValid) {
        notify.error(validation.errors[0])
        return
      }

      setTempLogo(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target.result)
        console.log('👁️ Logo preview created')
      }
      reader.readAsDataURL(file)

      notify.success('Logo selected. Click Save Changes to upload.')
    } catch (error) {
      console.error('❌ Error processing logo:', error)
      notify.error('Error processing image file')
    }
  }

  const handleQrUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    try {
      console.log('📤 Processing QR code upload:', file.name)
      
      const validation = await profileManager.validateImageFile(file)
      if (!validation.isValid) {
        notify.error(validation.errors[0])
        return
      }

      setTempQrCode(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setQrPreview(e.target.result)
        console.log('👁️ QR code preview created')
      }
      reader.readAsDataURL(file)

      notify.success('QR code selected. Click Save Changes to upload.')
    } catch (error) {
      console.error('❌ Error processing QR code:', error)
      notify.error('Error processing image file')
    }
  }

  const validateForm = () => {
    const errors = {}

    if (personalInfo.store_address && !profileManager.validateAddress(personalInfo.store_address)) {
      errors.store_address = 'Address is too long (max 500 characters)'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSavePersonalInfo = async () => {
    if (!validateForm()) {
      notify.error('Please fix the validation errors')
      return
    }

    setIsSaving(true)
    console.log('💾 Starting save process...')

    try {
      if (!isOnline) {
        // Save locally with logo as base64
        const updatedProfile = { ...personalInfo }
        if (tempLogo) {
          const reader = new FileReader()
          const localLogoData = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(tempLogo)
          })
          updatedProfile.store_logo = localLogoData
          // Save for receipts
          await profileManager.saveLogoLocally(localLogoData)
        }
        if (tempQrCode) {
          const reader = new FileReader()
          const localQrData = await new Promise((resolve) => {
            reader.onload = () => resolve(reader.result)
            reader.readAsDataURL(tempQrCode)
          })
          updatedProfile.qr_code = localQrData
          // Save for receipts
          await profileManager.saveQrLocally(localQrData)
        }
        profileManager.saveLocalProfile(updatedProfile)
        setPersonalInfo(updatedProfile)
        setTempLogo(null)
        setTempQrCode(null)
        setLogoPreview(updatedProfile.store_logo || '')
        setQrPreview(updatedProfile.qr_code || '')

        // Clear localStorage if logo or QR were deleted
        if (!updatedProfile.store_logo) {
          localStorage.removeItem('store_logo_local');
        }
        if (!updatedProfile.qr_code) {
          localStorage.removeItem('qr_code_local');
        }

        notify.warning('Saved locally. Changes will sync when online.')
        showSaveMessage('Profile saved locally (offline mode)', 'warning')
        return
      }

      console.log('💾 Saving personalInfo with toggles:');
      console.log('  - show_logo_on_receipt:', personalInfo.show_logo_on_receipt);
      console.log('  - show_footer_section:', personalInfo.show_footer_section);

      const loadingId = notify.loading('Updating profile...')
      const result = await profileManager.updateProfile(personalInfo, tempLogo, tempQrCode)
      notify.remove(loadingId)

      if (result.success) {
        console.log('✅ Profile saved with toggles:');
        console.log('  - show_logo_on_receipt:', result.data.show_logo_on_receipt);
        console.log('  - show_footer_section:', result.data.show_footer_section);
        setPersonalInfo(result.data)
        setTempLogo(null)
        setTempQrCode(null)
        setLogoPreview(result.data.store_logo || '')
        setQrPreview(result.data.qr_code || '')

        // Clear localStorage if logo or QR were deleted
        if (!result.data.store_logo) {
          localStorage.removeItem('store_logo_local');
          console.log('🗑️ Cleared logo from localStorage');
        }
        if (!result.data.qr_code) {
          localStorage.removeItem('qr_code_local');
          console.log('🗑️ Cleared QR code from localStorage');
        }

        showSaveMessage('Profile updated successfully!')
        notify.success('Profile updated successfully')
        console.log('✅ Profile save completed')
      } else {
        // Save locally as fallback
        const updatedProfile = { ...result.data }
        setPersonalInfo(updatedProfile)
        setTempLogo(null)
        setTempQrCode(null)
        setLogoPreview(updatedProfile.store_logo || '')
        setQrPreview(updatedProfile.qr_code || '')
        profileManager.saveLocalProfile(updatedProfile)

        // Clear localStorage if logo or QR were deleted
        if (!updatedProfile.store_logo) {
          localStorage.removeItem('store_logo_local');
        }
        if (!updatedProfile.qr_code) {
          localStorage.removeItem('qr_code_local');
        }

        if (result.error.includes('Failed to upload')) {
          notify.warning('Profile saved locally; upload failed.')
          showSaveMessage('Profile saved locally (upload failed)', 'warning')
        } else {
          notify.warning('Profile saved locally; server sync failed.')
          showSaveMessage('Profile saved locally (server error)', 'warning')
        }
      }
    } catch (error) {
      console.error('❌ Error saving profile:', error)
      // Save locally as fallback
      const updatedProfile = { ...personalInfo }
      if (tempLogo) {
        const reader = new FileReader()
        const localLogoData = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(tempLogo)
        })
        updatedProfile.store_logo = localLogoData
        await profileManager.saveLogoLocally(localLogoData)
      }
      if (tempQrCode) {
        const reader = new FileReader()
        const localQrData = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(tempQrCode)
        })
        updatedProfile.qr_code = localQrData
        await profileManager.saveQrLocally(localQrData)
      }
      profileManager.saveLocalProfile(updatedProfile)
      setPersonalInfo(updatedProfile)
      setTempLogo(null)
      setTempQrCode(null)
      setLogoPreview(updatedProfile.store_logo || '')
      setQrPreview(updatedProfile.qr_code || '')

      // Clear localStorage if logo or QR were deleted
      if (!updatedProfile.store_logo) {
        localStorage.removeItem('store_logo_local');
      }
      if (!updatedProfile.qr_code) {
        localStorage.removeItem('qr_code_local');
      }

      notify.error('Error saving profile. Changes saved locally.')
      showSaveMessage('Profile saved locally (error occurred)', 'warning')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRefreshData = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Refreshing profile data...')
      const loadingId = notify.loading('Refreshing profile data...')
      await fetchUserDataDirectly()
      notify.remove(loadingId)
      console.log('✅ Data refresh completed')
    } catch (error) {
      console.error('❌ Failed to refresh data:', error)
      notify.error('Failed to refresh data')
    } finally {
      setIsLoading(false)
    }
  }

  const showSaveMessage = (message, type = 'success') => {
    setSaveMessage({ text: message, type })
    setTimeout(() => setSaveMessage(''), 3000)
  }

  const getInvoiceStatusDisplay = (status) => {
    return status === 'paid' ? 'Paid' : 'Unpaid'
  }

  const getInvoiceStatusColor = (status) => {
    return status === 'paid' ? 'text-green-600' : 'text-red-600'
  }

  const sidebarItems = [
    {
      id: 'personal',
      name: 'Personal Profile',
      icon: User,
      description: 'Manage your account details'
    },
    {
      id: 'theme',
      name: 'Appearance',
      icon: Palette,
      description: 'Customize your interface'
    }
  ];

  // Get theme classes
  const classes = themeManager.getClasses();
  const themes = themeManager.getAllThemes();
  const isDark = themeManager.isDark();

  if (isLoading) {
    return (
      <div className={`min-h-screen ${classes.background} flex items-center justify-center transition-all duration-500`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
          <h3 className={`text-xl font-bold ${classes.textPrimary} mb-2`}>Loading Settings</h3>
          <p className={`${classes.textSecondary}`}>Please wait while we load your profile...</p>

          {/* Network status */}
          <div className={`mt-4 flex items-center justify-center space-x-2 ${classes.textSecondary} text-sm`}>
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span>Offline Mode</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedPage permissionKey="SETTINGS" pageName="Settings">
      <div className={`h-screen flex ${classes.background} overflow-hidden transition-all duration-500`}>
      {/* Left Sidebar */}
      <div className={`w-64 ${classes.card} ${classes.shadow} shadow-xl ${classes.border} border-r flex flex-col`}>
        {/* Header */}
        <div className={`p-4 ${classes.border} border-b ${classes.card}`}>
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/dashboard')}
            className={`flex items-center ${classes.textSecondary} hover:${classes.textPrimary} transition-colors mb-3 group`}
          >
            <div className={`w-8 h-8 rounded-full ${classes.button} group-hover:${classes.shadow} group-hover:shadow-sm flex items-center justify-center mr-3 transition-colors`}>
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">Back to Dashboard</span>
          </motion.button>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className={`text-xl font-bold ${classes.textPrimary}`}>Settings</h2>
              <p className={`${classes.textSecondary} text-sm`}>Customize your POS experience</p>
            </div>

            {/* Network Status & Refresh */}
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefreshData}
                disabled={isLoading}
                className={`p-2 rounded-lg ${classes.button} transition-all`}
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''} ${classes.textSecondary}`} />
              </motion.button>

              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <h3 className={`text-xs font-semibold ${classes.textSecondary} uppercase tracking-wider mb-3`}>
            Categories
          </h3>
          <div className="space-y-1">
            {sidebarItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;

              return (
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-300 group ${isActive
                    ? `${isDark ? 'bg-purple-900/20 border-purple-700/30' : 'bg-purple-100 border-purple-200'} border`
                    : `hover:${isDark ? 'bg-purple-900/10' : 'bg-purple-50'} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`
                    }`}
                >
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-lg overflow-hidden mr-3 ${isActive
                      ? isDark ? 'bg-purple-900/30' : 'bg-purple-200'
                      : isDark ? 'bg-purple-900/20' : 'bg-purple-100'
                      } flex items-center justify-center`}>
                      <IconComponent className={`w-5 h-5 ${isActive
                        ? isDark ? 'text-purple-400' : 'text-purple-600'
                        : isDark ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold ${isActive ? classes.textPrimary : classes.textPrimary
                        } truncate text-sm`}>
                        {item.name}
                      </div>
                      <div className={`text-xs ${classes.textSecondary}`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border-b p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${classes.textPrimary}`}>
                {activeTab === 'personal' ? 'Personal Profile' : 'Appearance Settings'}
              </h1>
              <p className={`${classes.textSecondary} text-sm flex items-center space-x-2`}>
                <span>
                  {activeTab === 'personal'
                    ? 'Manage your account information and store details'
                    : 'Customize your interface theme and appearance'
                  }
                </span>
                {!isOnline && (
                  <span className={`${isDark ? 'text-orange-400' : 'text-orange-600'} font-medium`}>
                    (Offline Mode)
                  </span>
                )}
              </p>
            </div>

            <AnimatePresence>
              {saveMessage && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl shadow-md ${saveMessage.type === 'error' || saveMessage.text?.includes('Failed')
                    ? isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-100 text-red-700'
                    : saveMessage.type === 'warning'
                      ? isDark ? 'bg-orange-900/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                      : isDark ? 'bg-green-900/20 text-green-400' : 'bg-green-100 text-green-700'
                    }`}
                >
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">{saveMessage.text || saveMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl"
              >
                <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-8`}>
                  {/* Profile Header */}
                  <div className="flex items-center space-x-4 mb-8">
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                      className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg"
                    >
                      <User className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <h2 className={`text-xl font-bold ${classes.textPrimary}`}>Profile Information</h2>
                      <p className={`${classes.textSecondary} text-sm`}>Update your personal and store details</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Logo and QR Upload Section */}
                    <div className="lg:col-span-1 space-y-8">
                      {/* Logo Upload Section */}
                      <div>
                        <h3 className={`text-lg font-semibold ${classes.textPrimary} mb-4`}>Store Logo</h3>
                        <div className={`${classes.border} border-2 border-dashed rounded-xl p-6 text-center space-y-4`}>
                          {logoPreview ? (
                            <div className="relative">
                              <img
                                src={logoPreview}
                                alt="Store Logo Preview"
                                className="w-40 h-48 object-cover rounded-lg mx-auto shadow-lg"
                                style={{ maxWidth: '250px', maxHeight: '300px' }}
                              />
                              <button
                                onClick={() => {
                                  setLogoPreview('');
                                  setTempLogo(null);
                                  setPersonalInfo(prev => ({ ...prev, store_logo: '' }));
                                  // Clear from localStorage for receipts
                                  localStorage.removeItem('store_logo_local');
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                  notify.success('Logo removed. Click Save Changes to apply.');
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className={`w-40 h-48 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg mx-auto flex items-center justify-center`}>
                              <ImageIcon className={`w-12 h-12 ${classes.textSecondary}`} />
                            </div>
                          )}

                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => fileInputRef.current?.click()}
                              className={`px-4 py-2 ${classes.button} rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto`}
                            >
                              <Upload className="w-4 h-4" />
                              <span>{logoPreview ? 'Change Logo' : 'Upload Logo'}</span>
                            </motion.button>
                            <p className={`text-xs ${classes.textSecondary} mt-2`}>
                              Recommended: 250×300px, Max 5MB
                            </p>
                          </div>
                        </div>

                        {/* Logo Print Toggle */}
                        <div className={`mt-4 p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-xl`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`font-medium ${classes.textPrimary}`}>Print Logo on Receipt</p>
                              <p className={`text-xs ${classes.textSecondary}`}>Enable to print logo on receipts</p>
                            </div>
                            <button
                              onClick={() => setPersonalInfo(prev => ({ ...prev, show_logo_on_receipt: !prev.show_logo_on_receipt }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                personalInfo.show_logo_on_receipt ? 'bg-green-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  personalInfo.show_logo_on_receipt ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Business Name Print Toggle */}
                        <div className={`mt-4 p-4 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-xl`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`font-medium ${classes.textPrimary}`}>Print Business Name on Receipt</p>
                              <p className={`text-xs ${classes.textSecondary}`}>Enable to show store name on receipts</p>
                            </div>
                            <button
                              onClick={() => setPersonalInfo(prev => ({ ...prev, show_business_name_on_receipt: !prev.show_business_name_on_receipt }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                personalInfo.show_business_name_on_receipt ? 'bg-green-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  personalInfo.show_business_name_on_receipt ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* QR Code Upload Section */}
                      <div>
                        <h3 className={`text-lg font-semibold ${classes.textPrimary} mb-4 flex items-center space-x-2`}>
                          <QrCode className="w-5 h-5" />
                          <span>QR Code for Receipts</span>
                        </h3>
                        <div className={`${classes.border} border-2 border-dashed rounded-xl p-6 text-center space-y-4`}>
                          {qrPreview ? (
                            <div className="relative">
                              <img
                                src={qrPreview}
                                alt="QR Code Preview"
                                className="w-40 h-48 object-cover rounded-lg mx-auto shadow-lg"
                                style={{ maxWidth: '250px', maxHeight: '300px' }}
                              />
                              <button
                                onClick={() => {
                                  setQrPreview('');
                                  setTempQrCode(null);
                                  setPersonalInfo(prev => ({ ...prev, qr_code: '' }));
                                  // Clear from localStorage for receipts
                                  localStorage.removeItem('qr_code_local');
                                  if (qrFileInputRef.current) qrFileInputRef.current.value = '';
                                  notify.success('QR code removed. Click Save Changes to apply.');
                                }}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className={`w-40 h-48 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-lg mx-auto flex items-center justify-center`}>
                              <QrCode className={`w-12 h-12 ${classes.textSecondary}`} />
                            </div>
                          )}

                          <div>
                            <input
                              ref={qrFileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleQrUpload}
                              className="hidden"
                            />
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => qrFileInputRef.current?.click()}
                              className={`px-4 py-2 ${classes.button} rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto`}
                            ><Upload className="w-4 h-4" />
                              <span>{qrPreview ? 'Change QR Code' : 'Upload QR Code'}</span>
                            </motion.button>
                            <p className={`text-xs ${classes.textSecondary} mt-2`}>
                              Recommended: Square format (200×200px), Max 5MB
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Customer Name - Read Only */}
                      <div>
                        <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                          Customer Name
                        </label>
                        <div className="relative">
                          <UserCircle className={`absolute left-3 top-3 w-5 h-5 ${classes.textSecondary}`} />
                          <input
                            type="text"
                            value={personalInfo.customer_name || ''}
                            readOnly
                            placeholder="Customer name will appear here"
                            className={`w-full pl-12 pr-4 py-3 ${classes.card} ${classes.border} border rounded-lg ${classes.textSecondary} cursor-not-allowed ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                          />
                        </div>
                        <p className={`text-xs ${classes.textSecondary} mt-1`}>This field cannot be changed</p>
                      </div>

                      {/* Email - Read Only */}
                      <div>
                        <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className={`absolute left-3 top-3 w-5 h-5 ${classes.textSecondary}`} />
                          <input
                            type="email"
                            value={personalInfo.email || ''}
                            readOnly
                            placeholder="Email address will appear here"
                            className={`w-full pl-12 pr-4 py-3 ${classes.card} ${classes.border} border rounded-lg ${classes.textSecondary} cursor-not-allowed ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                          />
                        </div>
                        <p className={`text-xs ${classes.textSecondary} mt-1`}>This field cannot be changed</p>
                      </div>

                      {/* Store Name - Read Only */}
                      <div>
                        <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                          Store Name
                        </label>
                        <div className="relative">
                          <Store className={`absolute left-3 top-3 w-5 h-5 ${classes.textSecondary}`} />
                          <input
                            type="text"
                            value={personalInfo.store_name || ''}
                            readOnly
                            placeholder="Store name will appear here"
                            className={`w-full pl-12 pr-4 py-3 ${classes.card} ${classes.border} border rounded-lg ${classes.textSecondary} cursor-not-allowed ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                          />
                        </div>
                        <p className={`text-xs ${classes.textSecondary} mt-1`}>This field cannot be changed</p>
                      </div>

                      {/* Phone - Editable (No validation) */}
                      <div>
                        <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                          Phone Number
                        </label>
                        <div className="relative">
                          <Phone className={`absolute left-3 top-3 w-5 h-5 ${classes.textSecondary}`} />
                          <input
                            type="tel"
                            value={personalInfo.phone || ''}
                            onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                            placeholder="Enter your phone number (any format)"
                            className={`w-full pl-12 pr-4 py-3 ${classes.card} ${classes.border} border rounded-lg ${classes.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all`}
                          />
                        </div>
                        <p className={`text-xs ${classes.textSecondary} mt-1`}>Enter phone number in any format you prefer</p>
                      </div>

                      {/* Store Address - Editable */}
                      <div>
                        <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                          Store Address
                        </label>
                        <div className="relative">
                          <MapPin className={`absolute left-3 top-3 w-5 h-5 ${classes.textSecondary}`} />
                          <textarea
                            value={personalInfo.store_address || ''}
                            onChange={(e) => handlePersonalInfoChange('store_address', e.target.value)}
                            placeholder="Enter your store address"
                            rows={3}
                            className={`w-full pl-12 pr-4 py-3 ${classes.card} ${classes.border} border rounded-lg ${classes.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none ${validationErrors.store_address ? 'border-red-500' : ''
                              }`}
                          />
                        </div>
                        {validationErrors.store_address && (
                          <div className="flex items-center mt-1 text-red-500">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            <p className="text-xs">{validationErrors.store_address}</p>
                          </div>
                        )}
                      </div>

                      {/* Invoice Status - Read Only */}
                      <div>
                        <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                          Invoice Status
                        </label>
                        <div className="relative">
                          <CreditCard className={`absolute left-3 top-3 w-5 h-5 ${classes.textSecondary}`} />
                          <div className={`w-full pl-12 pr-4 py-3 ${classes.card} ${classes.border} border rounded-lg cursor-not-allowed ${isDark ? 'bg-gray-800' : 'bg-gray-50'} flex items-center`}>
                            <span className={`font-medium ${getInvoiceStatusColor(personalInfo.invoice_status)}`}>
                              {getInvoiceStatusDisplay(personalInfo.invoice_status)}
                            </span>
                          </div>
                        </div>
                        <p className={`text-xs ${classes.textSecondary} mt-1`}>This is managed by the system administrator</p>
                      </div>

                      {/* Receipt Settings Section */}
                      <div className={`${classes.card} ${classes.border} border rounded-xl p-6 space-y-6`}>
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                            <QrCode className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className={`text-lg font-semibold ${classes.textPrimary}`}>Receipt Settings</h3>
                            <p className={`text-xs ${classes.textSecondary}`}>Customize your thermal receipt footer</p>
                          </div>
                        </div>

                        {/* Hashtag 1 */}
                        <div>
                          <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                            Hashtag 1
                          </label>
                          <input
                            type="text"
                            value={personalInfo.hashtag1 || ''}
                            onChange={(e) => {
                              console.log('Hashtag1 changed to:', e.target.value);
                              setPersonalInfo({ ...personalInfo, hashtag1: e.target.value });
                            }}
                            className={`w-full px-4 py-3 ${classes.card} ${classes.border} border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary}`}
                            placeholder="#YourBrand"
                            maxLength="30"
                          />
                          <p className={`text-xs ${classes.textSecondary} mt-1`}>First hashtag for receipt footer (e.g., #CheesySpace)</p>
                          {/* Debug */}
                          <p className="text-xs text-blue-500 mt-1">Current value: "{personalInfo.hashtag1}"</p>
                        </div>

                        {/* Hashtag 2 */}
                        <div>
                          <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                            Hashtag 2
                          </label>
                          <input
                            type="text"
                            value={personalInfo.hashtag2 || ''}
                            onChange={(e) => {
                              console.log('Hashtag2 changed to:', e.target.value);
                              setPersonalInfo({ ...personalInfo, hashtag2: e.target.value });
                            }}
                            className={`w-full px-4 py-3 ${classes.card} ${classes.border} border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary}`}
                            placeholder="#YourCity"
                            maxLength="30"
                          />
                          <p className={`text-xs ${classes.textSecondary} mt-1`}>Second hashtag for receipt footer (e.g., #Lahore)</p>
                          {/* Debug */}
                          <p className="text-xs text-blue-500 mt-1">Current value: "{personalInfo.hashtag2}"</p>
                        </div>

                        {/* Show Footer Section Toggle */}
                        <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'} rounded-lg p-4`}>
                          <label className="flex items-center cursor-pointer">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={!!personalInfo.show_footer_section}
                                onChange={(e) => {
                                  console.log('🔄 Toggle changed to:', e.target.checked);
                                  console.log('📊 Current show_footer_section value:', personalInfo.show_footer_section, '(type:', typeof personalInfo.show_footer_section, ')');
                                  setPersonalInfo({ ...personalInfo, show_footer_section: e.target.checked });
                                }}
                                className="sr-only"
                              />
                              <div className={`block w-14 h-8 rounded-full transition-colors duration-200 ${
                                personalInfo.show_footer_section ? 'bg-purple-600' : 'bg-gray-400'
                              }`}></div>
                              <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 ${
                                personalInfo.show_footer_section ? 'transform translate-x-6' : ''
                              }`}></div>
                            </div>
                            <div className="ml-3">
                              <span className={`text-sm font-medium ${classes.textPrimary}`}>
                                Show Footer Section
                              </span>
                              <p className={`text-xs ${classes.textSecondary}`}>
                                Include QR code, review message, and hashtags on receipts
                              </p>
                              <p className="text-xs text-blue-500 mt-1">Current value: {String(personalInfo.show_footer_section)} (type: {typeof personalInfo.show_footer_section})</p>
                            </div>
                          </label>
                        </div>

                        {/* Preview */}
                        <div className={`${isDark ? 'bg-gray-800' : 'bg-blue-50'} rounded-lg p-4 border-2 border-dashed ${isDark ? 'border-gray-700' : 'border-blue-200'}`}>
                          <p className={`text-xs font-semibold ${classes.textPrimary} mb-2`}>Receipt Footer Preview:</p>
                          {(personalInfo.show_footer_section === true || personalInfo.show_footer_section === undefined) ? (
                            <div className={`text-xs ${classes.textSecondary} space-y-1 text-center`}>
                              <p>[QR CODE]</p>
                              <p className="mt-1">Drop a review & flex on us!</p>
                              <p>Your feedback = our glow up</p>
                              {(personalInfo.hashtag1 || personalInfo.hashtag2) ? (
                                <p className="font-medium text-purple-600 dark:text-purple-400">
                                  {[personalInfo.hashtag1, personalInfo.hashtag2].filter(Boolean).join(' ')}
                                </p>
                              ) : (
                                <p className="font-medium text-gray-400 italic">
                                  (Enter hashtags above)
                                </p>
                              )}
                              <p className="mt-2">Powered by airoxlab.com</p>
                            </div>
                          ) : (
                            <div className={`text-xs ${classes.textSecondary} text-center`}>
                              <p>Powered by airoxlab.com</p>
                              <p className="text-xs text-gray-500 mt-1">(QR code and review section hidden)</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Business Availability Hours Section */}
                      <div className={`${classes.card} ${classes.border} border rounded-xl p-6 space-y-6`}>
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                            <Clock className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className={`text-lg font-semibold ${classes.textPrimary}`}>Business Hours</h3>
                            <p className={`text-xs ${classes.textSecondary}`}>Set your daily operational hours</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Business Start Time */}
                          <div>
                            <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                              Business Day Starts At
                            </label>
                            <input
                              type="time"
                              value={personalInfo.business_start_time || '10:00'}
                              onChange={(e) => handlePersonalInfoChange('business_start_time', e.target.value)}
                              className={`w-full px-4 py-3 ${classes.card} ${classes.border} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary}`}
                            />
                            <p className={`text-xs ${classes.textSecondary} mt-1`}>When your business day starts (e.g., 10:00 AM)</p>
                          </div>

                          {/* Business End Time */}
                          <div>
                            <label className={`block text-sm font-medium ${classes.textPrimary} mb-2`}>
                              Business Day Ends At
                            </label>
                            <input
                              type="time"
                              value={personalInfo.business_end_time || '03:00'}
                              onChange={(e) => handlePersonalInfoChange('business_end_time', e.target.value)}
                              className={`w-full px-4 py-3 ${classes.card} ${classes.border} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary}`}
                            />
                            <p className={`text-xs ${classes.textSecondary} mt-1`}>When your business day ends (can be next day, e.g., 03:00 AM)</p>
                          </div>
                        </div>

                        {/* Info Box */}
                        <div className={`${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-lg p-4 border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}>
                          <div className="flex items-start space-x-3">
                            <AlertCircle className={`w-5 h-5 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                            <div>
                              <p className={`text-sm font-medium ${isDark ? 'text-blue-300' : 'text-blue-900'} mb-1`}>
                                How Business Hours Work
                              </p>
                              <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                                Orders are grouped by your business day. For example, if your business starts at 10:00 AM and ends at 3:00 AM next day:
                              </p>
                              <ul className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-700'} mt-2 ml-4 list-disc space-y-1`}>
                                <li>Orders from 10:00 AM on Jan 20 to 2:59 AM on Jan 21 will show as "Jan 20" orders</li>
                                <li>Orders from 3:00 AM onwards on Jan 21 will show as "Jan 21" orders</li>
                                <li>This prevents midnight splitting your actual business day</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Save Button */}
                      <div className="pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSavePersonalInfo}
                          disabled={isSaving}
                          className={`px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                          {isSaving ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              <span>Save Changes</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'theme' && (
              <motion.div
                key="theme"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-4xl"
              >
                <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-8`}>
                  <div className="flex items-center space-x-4 mb-8">
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                      className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
                    >
                      <Palette className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <h2 className={`text-xl font-bold ${classes.textPrimary}`}>Theme Settings</h2>
                      <p className={`${classes.textSecondary} text-sm`}>Choose your preferred appearance</p>
                    </div>
                  </div>

                  {/* Theme Options */}
                  <div className="space-y-6">
                    <h3 className={`text-lg font-semibold ${classes.textPrimary}`}>Color Scheme</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(themes).map(([themeKey, theme]) => (
                        <motion.button
                          key={themeKey}
                          whileHover={{ scale: 1.02, y: -5 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleThemeChange(themeKey)}
                          disabled={isTransitioning}
                          className={`relative p-6 rounded-xl border-2 text-left transition-all duration-300 group ${themeKey === currentTheme
                            ? 'border-purple-500 shadow-xl'
                            : `${classes.border} border-gray-200 hover:border-purple-300 hover:shadow-lg`
                            } ${isTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center space-x-4">
                            <motion.div
                              whileHover={{ rotate: 360, scale: 1.1 }}
                              transition={{ duration: 0.5 }}
                              className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-r from-gray-400 to-gray-600"
                            >
                              <AnimatePresence mode="wait">
                                {themeKey === 'light' ? (
                                  <motion.div
                                    key="sun"
                                    initial={{ rotate: -90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: 90, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <Sun className="w-6 h-6 text-white" />
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="moon"
                                    initial={{ rotate: 90, opacity: 0 }}
                                    animate={{ rotate: 0, opacity: 1 }}
                                    exit={{ rotate: -90, opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <Moon className="w-6 h-6 text-white" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                            <div className="text-left flex-1">
                              <div className={`font-semibold text-lg ${classes.textPrimary}`}>{theme.name}</div>
                              <div className={`text-sm ${classes.textSecondary}`}>
                                {theme.description || (themeKey === 'light' ? 'Bright and clean interface' : 'Dark and elegant interface')}
                              </div>
                            </div>
                            {currentTheme === themeKey && (
                              <Check className="w-6 h-6 text-purple-500" />
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </ProtectedPage>
  );
}