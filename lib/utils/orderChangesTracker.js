// lib/utils/orderChangesTracker.js
// Uses existing order_item_changes table to track order modifications
// Works with both online and offline orders

import { supabase } from '../supabase'

/**
 * Get order changes from order_item_changes table
 * Uses the most recent order history entry for this order
 */
export async function getOrderChanges(orderId) {
  try {
    console.log('🔍 [Changes] Fetching changes for order:', orderId)

    // Check if online
    const isOnline = navigator.onLine

    if (isOnline) {
      // ONLINE: Fetch from database
      // First get the most recent order_history entry for this order
      const { data: historyData, error: historyError } = await supabase
        .from('order_history')
        .select('id')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (historyError) {
        console.error('❌ [Changes] Error fetching order history:', historyError)
        return getCachedChanges(orderId)
      }

      if (!historyData) {
        console.log('ℹ️ [Changes] No order history found for order:', orderId)
        return { hasChanges: false, changes: [] }
      }

      // Get the changes for this history entry
      const { data: changes, error: changesError } = await supabase
        .from('order_item_changes')
        .select('*')
        .eq('order_history_id', historyData.id)
        .order('created_at', { ascending: true })

      if (changesError) {
        console.error('❌ [Changes] Error fetching item changes:', changesError)
        return getCachedChanges(orderId)
      }

      console.log('✅ [Changes] Found changes from database:', changes?.length || 0)

      // Cache the changes for offline use
      if (changes && changes.length > 0) {
        cacheOrderChanges(orderId, changes)
      }

      return {
        hasChanges: changes && changes.length > 0,
        changes: changes || []
      }
    } else {
      // OFFLINE: Use cached changes
      console.log('📴 [Changes] Offline - using cached changes')
      return getCachedChanges(orderId)
    }

  } catch (error) {
    console.error('❌ [Changes] Error:', error)
    return getCachedChanges(orderId)
  }
}

/**
 * Cache order changes in localStorage
 */
function cacheOrderChanges(orderId, changes) {
  try {
    if (typeof window === 'undefined') return

    const cached = JSON.parse(localStorage.getItem('order_changes') || '{}')
    cached[orderId] = changes
    localStorage.setItem('order_changes', JSON.stringify(cached))

    console.log('💾 [Changes] Cached changes for order:', orderId)
  } catch (error) {
    console.error('❌ [Changes] Error caching changes:', error)
  }
}

/**
 * Save changes offline for later sync
 * Converts detailedChanges format to order_item_changes format
 */
export function saveChangesOffline(orderId, orderNumber, detailedChanges) {
  try {
    if (typeof window === 'undefined') return

    console.log('💾 [Changes] Saving offline changes for order:', orderNumber)

    // Convert detailedChanges to order_item_changes format
    const changes = []
    const orderHistoryId = `offline_${orderId}_${Date.now()}`

    // Added items
    if (detailedChanges.itemsAdded) {
      detailedChanges.itemsAdded.forEach(item => {
        changes.push({
          order_history_id: orderHistoryId,
          change_type: 'added',
          product_name: item.name,
          variant_name: item.variant || null,
          old_quantity: 0,
          new_quantity: item.quantity,
          old_price: 0,
          new_price: item.price || 0,
          created_at: new Date().toISOString()
        })
      })
    }

    // Removed items
    if (detailedChanges.itemsRemoved) {
      detailedChanges.itemsRemoved.forEach(item => {
        changes.push({
          order_history_id: orderHistoryId,
          change_type: 'removed',
          product_name: item.name,
          variant_name: item.variant || null,
          old_quantity: item.quantity,
          new_quantity: 0,
          old_price: item.price || 0,
          new_price: 0,
          created_at: new Date().toISOString()
        })
      })
    }

    // Modified items (quantity changed)
    if (detailedChanges.itemsModified) {
      detailedChanges.itemsModified.forEach(item => {
        changes.push({
          order_history_id: orderHistoryId,
          change_type: 'quantity_changed',
          product_name: item.name,
          variant_name: item.variant || null,
          old_quantity: item.oldQuantity,
          new_quantity: item.newQuantity,
          old_price: item.oldPrice || 0,
          new_price: item.newPrice || 0,
          created_at: new Date().toISOString()
        })
      })
    }

    if (changes.length > 0) {
      // Cache the changes for immediate use (printing)
      cacheOrderChanges(orderId, changes)

      // Also save to pending sync queue
      const pendingSync = JSON.parse(localStorage.getItem('pending_order_changes_sync') || '[]')
      pendingSync.push({
        orderId,
        orderNumber,
        orderHistoryId,
        changes,
        timestamp: new Date().toISOString(),
        synced: false
      })
      localStorage.setItem('pending_order_changes_sync', JSON.stringify(pendingSync))

      console.log('✅ [Changes] Saved', changes.length, 'changes offline for', orderNumber)
      return { success: true, changesCount: changes.length }
    }

    return { success: true, changesCount: 0 }
  } catch (error) {
    console.error('❌ [Changes] Error saving offline changes:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sync pending changes to database when online
 */
export async function syncPendingChanges() {
  try {
    if (typeof window === 'undefined') return { success: true, synced: 0 }
    if (!navigator.onLine) return { success: false, error: 'Offline' }

    const pendingSync = JSON.parse(localStorage.getItem('pending_order_changes_sync') || '[]')
    const unsynced = pendingSync.filter(item => !item.synced)

    if (unsynced.length === 0) {
      console.log('✅ [Changes] No pending changes to sync')
      return { success: true, synced: 0 }
    }

    console.log('🔄 [Changes] Syncing', unsynced.length, 'pending change sets to database')

    const { supabase } = await import('../supabase')
    let syncedCount = 0

    for (const item of unsynced) {
      try {
        // First, create order_history entry if it doesn't exist
        const { data: historyData, error: historyError } = await supabase
          .from('order_history')
          .insert({
            order_id: item.orderId,
            action: 'modified',
            details: { offline_sync: true, changesCount: item.changes.length },
            notes: `Order modified offline, synced at ${new Date().toISOString()}`
          })
          .select()
          .single()

        if (historyError) {
          console.error('❌ [Changes] Failed to create history entry:', historyError)
          continue
        }

        // Update order_history_id in changes
        const changesWithHistoryId = item.changes.map(change => ({
          ...change,
          order_history_id: historyData.id
        }))

        // Insert changes to order_item_changes table
        const { error: changesError } = await supabase
          .from('order_item_changes')
          .insert(changesWithHistoryId)

        if (changesError) {
          console.error('❌ [Changes] Failed to insert changes:', changesError)
          continue
        }

        // Mark as synced
        item.synced = true
        item.syncedAt = new Date().toISOString()
        syncedCount++

        console.log('✅ [Changes] Synced changes for order:', item.orderNumber)
      } catch (error) {
        console.error('❌ [Changes] Error syncing item:', error)
      }
    }

    // Update localStorage
    localStorage.setItem('pending_order_changes_sync', JSON.stringify(pendingSync))

    console.log(`✅ [Changes] Sync complete: ${syncedCount}/${unsynced.length} synced`)
    return { success: true, synced: syncedCount, total: unsynced.length }
  } catch (error) {
    console.error('❌ [Changes] Error syncing changes:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get cached changes from localStorage
 */
function getCachedChanges(orderId) {
  try {
    if (typeof window === 'undefined') {
      return { hasChanges: false, changes: [] }
    }

    const cached = JSON.parse(localStorage.getItem('order_changes') || '{}')
    const changes = cached[orderId] || []

    console.log('📦 [Changes] Loaded from cache:', changes.length, 'changes')

    return {
      hasChanges: changes.length > 0,
      changes: changes
    }
  } catch (error) {
    console.error('❌ [Changes] Error reading cached changes:', error)
    return { hasChanges: false, changes: [] }
  }
}

/**
 * Apply changes to order items for printing
 * Merges current items with change information
 */
export function applyChangesToItems(currentItems, changes) {
  if (!changes || changes.length === 0) {
    return currentItems
  }

  console.log('🔄 [Changes] Applying changes to items:', {
    items: currentItems.length,
    changes: changes.length
  })

  const itemsWithChanges = [...currentItems]
  const addedItems = []
  const removedItems = []

  // Process each change
  changes.forEach(change => {
    const productKey = `${change.product_name}-${change.variant_name || ''}`

    if (change.change_type === 'added') {
      // Item was added
      addedItems.push({
        name: change.product_name,
        size: change.variant_name || '',
        quantity: change.new_quantity,
        changeType: 'added',
        isDeal: false,
        notes: ''
      })
    } else if (change.change_type === 'removed') {
      // Item was removed
      removedItems.push({
        name: change.product_name,
        size: change.variant_name || '',
        quantity: change.old_quantity,
        changeType: 'removed',
        isDeal: false,
        notes: ''
      })
    } else if (change.change_type === 'quantity_changed') {
      // Quantity changed - mark as added if increased
      const quantityDiff = change.new_quantity - change.old_quantity

      if (quantityDiff > 0) {
        // Increased - show as added
        addedItems.push({
          name: change.product_name,
          size: change.variant_name || '',
          quantity: quantityDiff,
          changeType: 'added',
          isDeal: false,
          notes: `+${quantityDiff} added`
        })

        // Mark the base quantity as unchanged
        const existingItem = itemsWithChanges.find(item =>
          item.name === change.product_name &&
          (item.size || '') === (change.variant_name || '')
        )
        if (existingItem) {
          existingItem.changeType = 'unchanged'
          existingItem.quantity = change.old_quantity
        }
      } else if (quantityDiff < 0) {
        // Decreased - show as removed
        removedItems.push({
          name: change.product_name,
          size: change.variant_name || '',
          quantity: Math.abs(quantityDiff),
          changeType: 'removed',
          isDeal: false,
          notes: `${quantityDiff} removed`
        })

        // Mark remaining quantity as unchanged
        const existingItem = itemsWithChanges.find(item =>
          item.name === change.product_name &&
          (item.size || '') === (change.variant_name || '')
        )
        if (existingItem) {
          existingItem.changeType = 'unchanged'
        }
      }
    }
  })

  // Mark items without changes as unchanged
  itemsWithChanges.forEach(item => {
    if (!item.changeType) {
      item.changeType = 'unchanged'
    }
  })

  // Merge all items
  const mergedItems = [
    ...itemsWithChanges,
    ...addedItems,
    ...removedItems
  ]

  console.log('✅ [Changes] Applied changes:', {
    total: mergedItems.length,
    added: addedItems.length,
    removed: removedItems.length,
    unchanged: itemsWithChanges.filter(i => i.changeType === 'unchanged').length
  })

  return mergedItems
}

/**
 * Get order items with changes applied (all-in-one function)
 */
export async function getOrderItemsWithChanges(orderId, currentItems) {
  try {
    const { hasChanges, changes } = await getOrderChanges(orderId)

    if (!hasChanges) {
      console.log('ℹ️ [Changes] No changes found for order')
      return currentItems
    }

    return applyChangesToItems(currentItems, changes)

  } catch (error) {
    console.error('❌ [Changes] Error getting items with changes:', error)
    return currentItems
  }
}
