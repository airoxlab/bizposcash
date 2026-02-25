'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, ShoppingCart, Plus, Minus, Trash2, WifiOff, Edit3, Gift, X, Sun, Moon, Wifi, AlertCircle, Table2, FileText, Check } from 'lucide-react'
import LoyaltyPointsDisplay from '@/components/pos/LoyaltyPointsDisplay'
import { notify } from '../ui/NotificationSystem'

export default function CartSidebar({
  cart = [],
  customer,
  orderInstructions = '',
  onUpdateQuantity,
  onRemoveItem,
  onShowCustomerForm,
  onOrderAndPay,
  calculateSubtotal,
  calculateTotal,
  onClearCart,
  classes,
  isDark,
  networkStatus,
  orderType = 'walkin',
  isReopenedOrder = false,
  onToggleTheme,
  selectedTable,
  onChangeTable,
  onInstructionsChange
}) {
  const [showInstructionPanel, setShowInstructionPanel] = useState(false)
  const [draftInstruction, setDraftInstruction] = useState('')
  const getOrderTypeTitle = () => {
    switch(orderType) {
      case 'walkin': return 'POS Walk-in'
      case 'takeaway': return 'POS Takeaway'
      case 'delivery': return 'POS Delivery'
      default: return 'POS'
    }
  }

  const getHeaderGradient = () => {
    switch(orderType) {
      case 'takeaway': return 'bg-gradient-to-r from-orange-600 to-red-600'
      case 'delivery': return 'bg-gradient-to-r from-blue-600 to-cyan-600'
      default: return 'bg-gradient-to-r from-purple-600 to-blue-600'
    }
  }

  // Handle quantity decrease with permission check for reopened orders
  const handleQuantityUpdate = (itemId, newQuantity, currentItem) => {
    // If trying to decrease quantity in a reopened order
    if (isReopenedOrder && newQuantity < currentItem.quantity) {
      // Check permission flag
      const canDecreaseQty = localStorage.getItem(`${orderType}_can_decrease_qty`) === 'true'

      if (!canDecreaseQty) {
        // Get original state to check original quantities
        const originalStateStr = localStorage.getItem(`${orderType}_original_state`)
        if (originalStateStr) {
          try {
            const originalState = JSON.parse(originalStateStr)
            // Find the original item by matching product and variant names
            const originalItem = originalState.items?.find(
              i => i.productName === currentItem.productName &&
                   i.variantName === currentItem.variantName
            )

            if (originalItem && newQuantity < originalItem.quantity) {
              // Cannot decrease below original quantity
              notify.error(`Cannot decrease below original quantity (${originalItem.quantity})`)
              return // Block the decrease
            }
          } catch (error) {
            console.error('Error parsing original state:', error)
          }
        }
      }
    }

    // Proceed with quantity update
    onUpdateQuantity(itemId, newQuantity)
  }

  return (
    <div className={`w-80 ${classes.card} ${classes.shadow} shadow-xl ${classes.border} border-l flex flex-col`}>
      <div className={`p-3 ${classes.border} border-b ${classes.card}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-base font-bold ${classes.textPrimary}`}>{getOrderTypeTitle()}</h2>
            <p className={`${classes.textSecondary} text-xs`}>{cart.length} items in cart</p>
          </div>
          <div className="flex items-center space-x-1.5">
            {/* Theme Toggle */}
            {onToggleTheme && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleTheme}
                className={`p-1.5 rounded-lg ${classes.button} transition-all`}
              >
                <AnimatePresence mode="wait">
                  {isDark ? (
                    <motion.div
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Sun className="w-3.5 h-3.5 text-yellow-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Moon className={`w-3.5 h-3.5 ${classes.textSecondary}`} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            )}

            {/* WiFi Status */}
            <div className="flex items-center">
              {networkStatus?.isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
              )}
              {networkStatus?.unsyncedOrders > 0 && (
                <span className={`text-xs ${isDark ? 'text-yellow-400' : 'text-yellow-600'} font-medium ml-0.5`}>
                  {networkStatus.unsyncedOrders}
                </span>
              )}
            </div>

            {/* Clear Cart Button */}
            {cart.length > 0 && onClearCart && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClearCart}
                className={`p-1.5 ${isDark ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-50 hover:bg-red-100'} rounded-lg transition-colors`}
                title="Clear Cart"
              >
                <X className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
              </motion.button>
            )}
          </div>
        </div>
        {isReopenedOrder && (
          <div className={`mt-1.5 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} ${classes.border} border rounded-lg p-1.5`}>
            <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-700'} font-medium`}>
              🔄 Reopened for modification
            </p>
          </div>
        )}
      </div>

      {/* Action Row - Table / Customer / Instruction */}
      <div className={`p-2 ${classes.border} border-b ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-1.5">

          {/* Table Button - only when table is selected */}
          {selectedTable && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onChangeTable}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isDark ? 'bg-purple-900/30 border-purple-700 text-purple-300 hover:bg-purple-900/50' : 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Table2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{selectedTable.table_name || selectedTable.table_number}</span>
            </motion.button>
          )}

          {/* Customer Button */}
          {customer ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onShowCustomerForm}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                isDark ? 'bg-green-900/30 border-green-700 text-green-300 hover:bg-green-900/50' : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
              }`}
            >
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{customer.full_name?.trim() || customer.phone}</span>
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onShowCustomerForm}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-dashed transition-all ${
                isDark ? 'border-gray-600 text-gray-400 hover:border-purple-500 hover:text-purple-400' : 'border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600'
              }`}
            >
              <User className="w-3 h-3" />
              <span>Customer</span>
            </motion.button>
          )}

          {/* Instruction Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setDraftInstruction(orderInstructions); setShowInstructionPanel(true) }}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              orderInstructions
                ? isDark ? 'bg-amber-900/30 border-amber-600 text-amber-300' : 'bg-amber-50 border-amber-400 text-amber-700'
                : isDark ? 'border-gray-600 text-gray-400 hover:border-amber-500 hover:text-amber-400' : 'border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Instruction</span>
          </motion.button>
        </div>
      </div>

      {/* Loyalty Points Display - Below Customer Section */}
      {customer && (
        <div className="px-2 pb-2">
          <LoyaltyPointsDisplay
            customer={customer}
            cart={cart}
            orderType={orderType}
            subtotal={calculateSubtotal()}
            theme={isDark ? 'dark' : 'light'}
          />
        </div>
      )}

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {cart.length === 0 ? (
          <div className="text-center py-6">
            <div className={`w-12 h-12 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full flex items-center justify-center mx-auto mb-2`}>
              <ShoppingCart className={`w-6 h-6 ${classes.textSecondary}`} />
            </div>
            <h3 className={`text-sm font-semibold ${classes.textSecondary} mb-1`}>Cart is empty</h3>
            <p className={`${classes.textSecondary} text-xs`}>Add items to get started</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence>
              {cart.map((item, index) => (
                <motion.div
                  key={item.id ?? `item-${index}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`${classes.card} rounded-lg p-2 ${classes.shadow} shadow-sm ${classes.border} border group hover:shadow-md transition-all duration-200`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      {/* Deal Badge */}
                      {item.isDeal && (
                        <div className="flex items-center space-x-0.5 mb-0.5">
                          <Gift className={`w-2.5 h-2.5 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                          <span className={`text-[10px] font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                            DEAL
                          </span>
                        </div>
                      )}

                      <h4 className={`font-semibold ${classes.textPrimary} text-xs leading-tight truncate`}>
                        {item.isDeal ? item.dealName : item.productName}
                      </h4>

                      {/* Deal price adjustment */}
                      {item.isDeal && item.priceAdjustment > 0 && (
                        <div className="text-[10px] text-orange-600 font-semibold mt-0.5">
                          Base: Rs {item.baseDealPrice} + Rs {item.priceAdjustment} (upgrade)
                        </div>
                      )}

                      {/* Regular product variant */}
                      {!item.isDeal && item.variantName && (
                        <p className={`text-[10px] ${isDark ? 'text-purple-400' : 'text-purple-600'} font-medium`}>
                          {item.variantName}
                        </p>
                      )}

                      {/* Deal products list */}
                      {item.isDeal && item.dealProducts && (
                        <div className="mt-0.5 space-y-0">
                          {item.dealProducts.map((dp, idx) => {
                            const flavorName = dp.variant || (dp.flavor ? (typeof dp.flavor === 'object' ? dp.flavor.name || dp.flavor.flavor_name : dp.flavor) : null);
                            return (
                              <p key={idx} className={`text-[10px] ${classes.textSecondary}`}>
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
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className={`p-0.5 text-red-400 hover:text-red-600 hover:${isDark ? 'bg-red-900/20' : 'bg-red-50'} rounded transition-all opacity-0 group-hover:opacity-100`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={`flex items-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-md p-0.5`}>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleQuantityUpdate(item.id, item.quantity - 1, item)}
                        className="w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </motion.button>
                      <span className={`font-bold ${classes.textPrimary} w-6 text-center text-xs`}>
                        {item.quantity}
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleQuantityUpdate(item.id, item.quantity + 1, item)}
                        className="w-5 h-5 bg-green-500 hover:bg-green-600 text-white rounded flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </motion.button>
                    </div>

                    <div className="text-right">
                      <div className={`text-[10px] ${classes.textSecondary}`}>
                        Rs {item.finalPrice || 0} × {item.quantity}
                      </div>
                      <div className={`font-bold ${classes.textPrimary} text-xs`}>
                        Rs {(item.totalPrice || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Cart Summary & Checkout */}
      {cart.length > 0 && (
        <div className={`p-2 ${classes.border} border-t ${classes.card}`}>
          {/* Price Summary */}
          <div className={`flex justify-between items-center mb-2 p-2 ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} rounded-lg`}>
            <span className={`text-sm font-bold ${classes.textPrimary}`}>Total:</span>
            <span className={`text-base font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>Rs {calculateTotal().toFixed(2)}</span>
          </div>

          {/* Offline Warning */}
          {!networkStatus?.isOnline && (
            <div className={`mb-2 p-2 ${isDark ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200'} border rounded-lg`}>
              <div className="flex items-center space-x-1.5">
                <WifiOff className={`w-3 h-3 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                <span className={`${isDark ? 'text-orange-300' : 'text-orange-700'} text-xs font-medium`}>
                  Offline - Will sync later
                </span>
              </div>
            </div>
          )}

          {/* Checkout Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOrderAndPay}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <div className="flex items-center justify-center text-sm">
              <ShoppingCart className="w-4 h-4 mr-1.5" />
              Order & Pay Rs {calculateTotal().toFixed(2)}
            </div>
          </motion.button>
        </div>
      )}

      {/* Instruction Full-Screen Popup */}
      {showInstructionPanel && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInstructionPanel(false)}
          />

          {/* Panel */}
          <div className={`relative w-full max-w-md h-full ${isDark ? 'bg-gray-900' : 'bg-white'} shadow-2xl flex flex-col`}>
            {/* Header */}
            <div className={`${getHeaderGradient()} p-5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Order Instruction</h2>
                    <p className="text-white/90 text-xs">Optional note for this order</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInstructionPanel(false)}
                  className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              <label className={`block text-sm font-semibold mb-2 flex items-center ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                <FileText className={`w-4 h-4 mr-2 ${orderType === 'takeaway' ? 'text-orange-500' : orderType === 'delivery' ? 'text-blue-500' : 'text-purple-500'}`} />
                Instructions
                <span className={`ml-2 text-xs font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>(Optional)</span>
              </label>
              <textarea
                autoFocus
                value={draftInstruction}
                onChange={(e) => setDraftInstruction(e.target.value)}
                rows={5}
                className={`w-full px-4 py-3 rounded-lg border-2 resize-none transition-all focus:outline-none focus:ring-2 ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-amber-500/20'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:ring-amber-500/20'
                }`}
                placeholder="Any special requests or notes for this order..."
              />
            </div>

            {/* Footer */}
            <div className={`border-t p-4 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInstructionPanel(false)}
                  className={`flex-1 px-5 py-3 font-semibold rounded-lg transition-all ${
                    isDark
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-center">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { onInstructionsChange?.(draftInstruction); setShowInstructionPanel(false) }}
                  className={`flex-[2] px-5 py-3 ${getHeaderGradient()} text-white font-bold rounded-lg transition-all shadow-lg opacity-100 hover:opacity-90`}
                >
                  <div className="flex items-center justify-center">
                    <Check className="w-4 h-4 mr-2" />
                    Save
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
