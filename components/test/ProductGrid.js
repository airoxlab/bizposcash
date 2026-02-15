'use client'

import { motion } from 'framer-motion'
import { Plus, Coffee, Gift } from 'lucide-react'
import { useRef, forwardRef, useImperativeHandle } from 'react'

const ProductGrid = forwardRef(({
  categories = [],
  deals = [],
  allProducts = [],
  onProductClick,
  onDealClick,
  classes,
  isDark,
  networkStatus,
  selectedCategoryId = null
}, ref) => {
  const productRefs = useRef({})
  const dealRef = useRef(null)

  const getProductsByCategory = (categoryId) => {
    return allProducts.filter(product => product.category_id === categoryId)
  }

  // Expose scroll methods to parent component
  useImperativeHandle(ref, () => ({
    scrollToCategory: (categoryId) => {
      const element = productRefs.current[categoryId]
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    scrollToDeals: () => {
      if (dealRef.current) {
        dealRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }))

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border-b p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-bold ${classes.textPrimary}`}>
              Products Menu
            </h1>
            <p className={`${classes.textSecondary} text-sm`}>
              {allProducts.length} items available
              {!networkStatus?.isOnline && (
                <span className={`ml-2 ${isDark ? 'text-orange-400' : 'text-orange-600'} font-medium`}>(Offline Mode)</span>
              )}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-xs ${classes.textSecondary}`}>
              {new Date().toLocaleDateString()}
            </div>
            <div className={`text-sm font-semibold ${classes.textPrimary}`}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-scroll p-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {/* Categories and Products */}
        {categories.map((category) => {
          const categoryProducts = getProductsByCategory(category.id)
          if (categoryProducts.length === 0) return null

          return (
            <div
              key={category.id}
              ref={el => productRefs.current[category.id] = el}
              className="mb-6"
            >
              <div className={`sticky top-0 ${classes.card} py-2 z-10 rounded-lg mb-3 ${classes.shadow} shadow-sm`}>
                <h2 className={`text-lg font-bold ${classes.textPrimary} px-3`}>
                  {category.name}
                </h2>
                <div className={`text-xs ${classes.textSecondary} px-3`}>
                  {categoryProducts.length} items
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                {categoryProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onProductClick(product)}
                    className={`${classes.card} rounded-xl ${classes.shadow} shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group ${classes.border} border`}
                  >
                    <div className={`relative aspect-square ${isDark ? 'bg-gray-700' : 'bg-gray-100'} overflow-hidden`}>
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className={`flex items-center justify-center h-full p-2 ${isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-200 to-gray-300'}`}>
                          <span className={`text-sm font-bold text-center leading-tight break-words line-clamp-4 ${isDark ? 'text-white' : 'text-gray-700'}`}>
                            {product.name}
                          </span>
                        </div>
                      )}

                      <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                        Rs {product.base_price}
                      </div>

                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className={`absolute bottom-2 right-2 w-8 h-8 ${classes.card} rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300`}
                      >
                        <Plus className="w-4 h-4 text-green-600" />
                      </motion.div>
                    </div>

                    <div className="p-2">
                      <h3 className={`font-bold ${classes.textPrimary} text-sm mb-1 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors truncate`}>
                        {product.name}
                      </h3>
                      {product.ingredients && (
                        <p className={`${classes.textSecondary} text-xs truncate`}>
                          {product.ingredients}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Deals Section - Always show at the end after all categories */}
        {deals && deals.length > 0 && (
          <div ref={dealRef} className="mb-6">
            <div className={`sticky top-0 ${classes.card} py-2 z-10 rounded-lg mb-3 ${classes.shadow} shadow-sm`}>
              <h2 className={`text-lg font-bold ${classes.textPrimary} px-3`}>
                Special Deals
              </h2>
              <div className={`text-xs ${classes.textSecondary} px-3`}>
                {deals.length} deals available
              </div>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
              {deals.map((deal) => (
                <motion.div
                  key={deal.id}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => !deal.isOutOfTime && onDealClick(deal)}
                  className={`${classes.card} rounded-xl ${classes.shadow} shadow-lg hover:shadow-xl transition-all duration-300 ${deal.isOutOfTime ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} overflow-hidden group ${classes.border} border ${deal.isOutOfTime ? 'relative' : ''}`}
                >
                  <div className={`relative aspect-square ${isDark ? 'bg-gray-700' : 'bg-gray-100'} overflow-hidden`}>
                    {deal.image_url ? (
                      <img
                        src={deal.image_url}
                        alt={deal.name}
                        className={`w-full h-full object-cover ${!deal.isOutOfTime && 'group-hover:scale-105'} transition-transform duration-300 ${deal.isOutOfTime ? 'grayscale' : ''}`}
                      />
                    ) : (
                      <div className={`flex items-center justify-center h-full p-2 ${isDark ? 'bg-gradient-to-br from-gray-700 to-gray-600' : 'bg-gradient-to-br from-gray-200 to-gray-300'}`}>
                        <span className={`text-sm font-bold text-center leading-tight break-words line-clamp-4 ${isDark ? 'text-white' : 'text-gray-700'}`}>
                          {deal.name}
                        </span>
                      </div>
                    )}

                    {/* Out of Time Overlay */}
                    {deal.isOutOfTime && (
                      <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                        <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg transform -rotate-12">
                          OUT OF TIME
                        </div>
                      </div>
                    )}

                    <div className={`absolute top-2 left-2 ${deal.isOutOfTime ? 'bg-gray-600' : 'bg-green-600'} text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg`}>
                      Rs {deal.price}
                    </div>

                    {!deal.isOutOfTime && (
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className={`absolute bottom-2 right-2 w-8 h-8 ${classes.card} rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300`}
                      >
                        <Plus className="w-4 h-4 text-green-600" />
                      </motion.div>
                    )}
                  </div>

                  <div className="p-2">
                    <h3 className={`font-bold ${classes.textPrimary} text-sm mb-1 ${!deal.isOutOfTime && 'group-hover:text-green-600 dark:group-hover:text-green-400'} transition-colors truncate`}>
                      {deal.name}
                    </h3>
                    {deal.description && (
                      <p className={`${classes.textSecondary} text-xs truncate`}>
                        {deal.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {allProducts.length === 0 && (!deals || deals.length === 0) && (
          <div className="text-center py-20">
            <div className={`w-24 h-24 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <Coffee className={`w-12 h-12 ${classes.textSecondary}`} />
            </div>
            <h3 className={`text-2xl font-bold ${classes.textSecondary} mb-3`}>
              No products found
            </h3>
            <p className={`${classes.textSecondary} text-lg`}>
              Add some delicious items to get started
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

ProductGrid.displayName = 'ProductGrid'

export default ProductGrid
