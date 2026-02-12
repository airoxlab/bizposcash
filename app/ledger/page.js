'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authManager } from '../../lib/authManager'
import { supabase } from '../../lib/supabase'
import { themeManager } from '../../lib/themeManager'
import ProtectedPage from '../../components/ProtectedPage'
import jsPDF from 'jspdf'

export default function LedgerPage() {
  const router = useRouter()
  const [theme, setTheme] = useState('light')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [ledgerData, setLedgerData] = useState({
    totalSales: 0,
    totalExpenses: 0,
    netProfit: 0,
    transactions: []
  })

  useEffect(() => {
    const currentTheme = themeManager.getTheme()
    setTheme(currentTheme)

    const handleThemeChange = () => {
      setTheme(themeManager.getTheme())
    }

    window.addEventListener('themeChanged', handleThemeChange)
    return () => window.removeEventListener('themeChanged', handleThemeChange)
  }, [])

  useEffect(() => {
    fetchLedgerData()
  }, [dateRange])

  const fetchLedgerData = async () => {
    setLoading(true)
    try {
      const user = authManager.getCurrentUser()
      if (!user) return

      // Fetch sales data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Fetch expenses data
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (expensesError) throw expensesError

      // Calculate totals
      const totalSales = orders?.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0) || 0
      const totalExpenses = expenses?.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0) || 0

      // Combine transactions
      const transactions = [
        ...(orders?.map(order => ({
          id: order.id,
          date: order.created_at,
          type: 'sale',
          description: `Order #${order.order_number} - ${order.order_type}`,
          amount: parseFloat(order.total),
          balance: 0 // Will calculate running balance below
        })) || []),
        ...(expenses?.map(expense => ({
          id: expense.id,
          date: expense.created_at,
          type: 'expense',
          description: expense.description || 'Expense',
          amount: parseFloat(expense.amount),
          balance: 0
        })) || [])
      ].sort((a, b) => new Date(a.date) - new Date(b.date))

      // Calculate running balance
      let runningBalance = 0
      transactions.forEach(transaction => {
        if (transaction.type === 'sale') {
          runningBalance += transaction.amount
        } else {
          runningBalance -= transaction.amount
        }
        transaction.balance = runningBalance
      })

      setLedgerData({
        totalSales,
        totalExpenses,
        netProfit: totalSales - totalExpenses,
        transactions
      })
    } catch (error) {
      console.error('Error fetching ledger data:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const user = authManager.getCurrentUser()
      const userProfile = user?.user_metadata || {}
      const businessName = userProfile.business_name || 'Business'

      const doc = new jsPDF()

      // Header
      doc.setFontSize(20)
      doc.text(businessName, 105, 15, { align: 'center' })

      doc.setFontSize(16)
      doc.text('Ledger Report', 105, 25, { align: 'center' })

      doc.setFontSize(10)
      doc.text(`Period: ${dateRange.startDate} to ${dateRange.endDate}`, 105, 32, { align: 'center' })
      doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 38, { align: 'center' })

      // Summary Box
      doc.setFillColor(240, 240, 240)
      doc.rect(15, 45, 180, 30, 'F')

      doc.setFontSize(11)
      doc.text('Total Sales:', 20, 53)
      doc.text(`Rs ${ledgerData.totalSales.toFixed(2)}`, 70, 53)

      doc.text('Total Expenses:', 20, 60)
      doc.text(`Rs ${ledgerData.totalExpenses.toFixed(2)}`, 70, 60)

      doc.setFont(undefined, 'bold')
      doc.text('Net Profit/Loss:', 20, 67)
      doc.text(`Rs ${ledgerData.netProfit.toFixed(2)}`, 70, 67)
      doc.setFont(undefined, 'normal')

      // Table Header
      let yPos = 85
      doc.setFillColor(60, 60, 60)
      doc.rect(15, yPos - 5, 180, 8, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.text('Date', 17, yPos)
      doc.text('Type', 47, yPos)
      doc.text('Description', 67, yPos)
      doc.text('Amount', 145, yPos)
      doc.text('Balance', 175, yPos)
      doc.setTextColor(0, 0, 0)

      // Table Rows
      yPos += 8
      doc.setFontSize(8)

      ledgerData.transactions.forEach((transaction, index) => {
        if (yPos > 270) {
          doc.addPage()
          yPos = 20
        }

        const date = new Date(transaction.date).toLocaleDateString()
        const type = transaction.type === 'sale' ? 'Sale' : 'Expense'
        const description = transaction.description.substring(0, 30)
        const amount = transaction.type === 'sale'
          ? `+${transaction.amount.toFixed(2)}`
          : `-${transaction.amount.toFixed(2)}`
        const balance = transaction.balance.toFixed(2)

        // Alternating row colors
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250)
          doc.rect(15, yPos - 4, 180, 6, 'F')
        }

        doc.text(date, 17, yPos)
        doc.text(type, 47, yPos)
        doc.text(description, 67, yPos)
        doc.text(amount, 145, yPos)
        doc.text(balance, 175, yPos)

        yPos += 6
      })

      // Footer
      const pageCount = doc.internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' })
      }

      // Save
      doc.save(`Ledger_Report_${dateRange.startDate}_to_${dateRange.endDate}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
    } finally {
      setDownloading(false)
    }
  }

  const isDark = theme === 'dark'

  const classes = {
    bg: isDark ? 'bg-gray-900' : 'bg-gray-50',
    card: isDark ? 'bg-gray-800' : 'bg-white',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSecondary: isDark ? 'text-gray-400' : 'text-gray-600',
    border: isDark ? 'border-gray-700' : 'border-gray-200',
    input: isDark ? 'bg-gray-700 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'
  }

  return (
    <ProtectedPage>
      <div className={`min-h-screen ${classes.bg}`}>
        {/* Header */}
        <div className={`${classes.card} border-b ${classes.border} sticky top-0 z-10`}>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className={`p-2 rounded-lg ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                >
                  <ArrowLeft className={`w-5 h-5 ${classes.text}`} />
                </button>
                <div>
                  <h1 className={`text-2xl font-bold ${classes.text}`}>Ledger Report</h1>
                  <p className={classes.textSecondary}>Financial transactions and summary</p>
                </div>
              </div>
              <button
                onClick={downloadPDF}
                disabled={downloading || loading}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Date Range Filter */}
          <div className={`${classes.card} rounded-xl p-6 mb-6 border ${classes.border}`}>
            <div className="flex items-center gap-4">
              <Calendar className={`w-5 h-5 ${classes.textSecondary}`} />
              <div className="flex items-center gap-4 flex-1">
                <div className="flex-1">
                  <label className={`block text-sm font-medium ${classes.textSecondary} mb-2`}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg ${classes.input} focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
                <div className="flex-1">
                  <label className={`block text-sm font-medium ${classes.textSecondary} mb-2`}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className={`w-full px-4 py-2 border rounded-lg ${classes.input} focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`${classes.card} rounded-xl p-6 border ${classes.border}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${classes.textSecondary} mb-1`}>Total Sales</p>
                  <p className={`text-2xl font-bold text-green-600`}>
                    Rs {ledgerData.totalSales.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`${classes.card} rounded-xl p-6 border ${classes.border}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${classes.textSecondary} mb-1`}>Total Expenses</p>
                  <p className={`text-2xl font-bold text-red-600`}>
                    Rs {ledgerData.totalExpenses.toFixed(2)}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`${classes.card} rounded-xl p-6 border ${classes.border}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${classes.textSecondary} mb-1`}>Net Profit/Loss</p>
                  <p className={`text-2xl font-bold ${ledgerData.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    Rs {ledgerData.netProfit.toFixed(2)}
                  </p>
                </div>
                <div className={`p-3 ${ledgerData.netProfit >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-orange-100 dark:bg-orange-900/30'} rounded-lg`}>
                  <DollarSign className={`w-6 h-6 ${ledgerData.netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Transactions Table */}
          <div className={`${classes.card} rounded-xl border ${classes.border} overflow-hidden`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <FileText className={`w-5 h-5 ${classes.textSecondary}`} />
                <h2 className={`text-lg font-semibold ${classes.text}`}>Transactions</h2>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={`w-8 h-8 ${classes.textSecondary} animate-spin`} />
              </div>
            ) : ledgerData.transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className={classes.textSecondary}>No transactions found for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${classes.textSecondary} uppercase tracking-wider`}>
                        Date
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${classes.textSecondary} uppercase tracking-wider`}>
                        Type
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${classes.textSecondary} uppercase tracking-wider`}>
                        Description
                      </th>
                      <th className={`px-6 py-3 text-right text-xs font-medium ${classes.textSecondary} uppercase tracking-wider`}>
                        Amount
                      </th>
                      <th className={`px-6 py-3 text-right text-xs font-medium ${classes.textSecondary} uppercase tracking-wider`}>
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {ledgerData.transactions.map((transaction, index) => (
                      <tr key={transaction.id} className={`${index % 2 === 0 ? (isDark ? 'bg-gray-800' : 'bg-white') : (isDark ? 'bg-gray-800/50' : 'bg-gray-50')}`}>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${classes.text}`}>
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.type === 'sale'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {transaction.type === 'sale' ? 'Sale' : 'Expense'}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm ${classes.text}`}>
                          {transaction.description}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                          transaction.type === 'sale' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'sale' ? '+' : '-'}Rs {transaction.amount.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${classes.text}`}>
                          Rs {transaction.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedPage>
  )
}
