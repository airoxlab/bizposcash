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
  Clock,
  Download,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  HardDrive,
  FolderOpen,
  Database,
  UploadCloud,
  FileJson,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { notify } from '../../components/ui/NotificationSystem';
import themeManager from '../../lib/themeManager';
import { authManager } from '../../lib/authManager';
import { profileManager } from '../../lib/profileManager';
import { supabase } from '../../lib/supabaseClient';
import { cacheManager } from '../../lib/cacheManager';
import ProtectedPage from '../../components/ProtectedPage';

// Modern Toggle Switch Component
const ModernToggle = ({ checked, onChange, label, description, disabled = false }) => {
  const classes = themeManager.getClasses();
  const isDark = themeManager.isDark();

  return (
    <div className={`p-4 rounded-xl transition-all duration-200 ${
      isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex-1 mr-4">
          <p className={`font-semibold text-sm ${classes.textPrimary}`}>{label}</p>
          {description && (
            <p className={`text-xs mt-0.5 ${classes.textSecondary}`}>{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onChange}
          disabled={disabled}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            checked
              ? 'bg-gradient-to-r from-purple-500 to-purple-600'
              : isDark ? 'bg-gray-700' : 'bg-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition-all duration-200 ease-in-out ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          >
            {/* Inner dot for iOS style */}
            <span className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${
              checked ? 'opacity-0' : 'opacity-100'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isDark ? 'bg-gray-400' : 'bg-gray-400'}`} />
            </span>
            <span className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity ${
              checked ? 'opacity-100' : 'opacity-0'
            }`}>
              <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// BACKUP & RECOVERY PANEL
// ─────────────────────────────────────────────────────────────
function BackupPanel({ isDark, classes }) {
  const router = useRouter();
  const [backupFolder, setBackupFolder] = useState(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('pos_backup_folder') || '') : ''
  );
  const [backupIndex, setBackupIndex] = useState(null); // last auto-save info
  const [dataSummary, setDataSummary] = useState(null);
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  // ── Data Recovery state ──
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [importedCount, setImportedCount] = useState(null);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.backup;

  // Track online/offline state
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  // Compute summary of locally cached data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingChanges = JSON.parse(localStorage.getItem('pending_order_changes_sync') || '[]');
    const orderChanges = JSON.parse(localStorage.getItem('order_changes') || '{}');
    const posCache = JSON.parse(localStorage.getItem('pos_cache') || '{}');
    const offlineOrders = posCache?.orders?.filter(o => !o._isSynced) || [];
    setDataSummary({
      offlineOrders: offlineOrders.length,
      pendingChanges: pendingChanges.filter(c => !c.synced).length,
      cachedOrderChanges: Object.keys(orderChanges).length,
      totalCachedOrders: posCache?.orders?.length || 0,
    });
  }, []);

  // Load last auto-save index when folder is set
  useEffect(() => {
    if (backupFolder && isElectron) {
      window.electronAPI.backup.readIndex(backupFolder).then(res => {
        if (res.success) setBackupIndex(res.index);
      });
    }
  }, [backupFolder]);

  async function handleSelectFolder() {
    if (!isElectron) return;
    const res = await window.electronAPI.backup.selectFolder();
    if (!res.canceled) {
      setBackupFolder(res.path);
      localStorage.setItem('pos_backup_folder', res.path);
      // Persist folder path to Electron userData so it survives localStorage resets
      await window.electronAPI.backup.saveConfig(res.path);
      // Create the folder on disk immediately and write a placeholder index
      const init = await window.electronAPI.backup.initFolder(res.path);
      if (init.success) {
        // Reload index so the UI reflects the initialized folder
        const idx = await window.electronAPI.backup.readIndex(res.path);
        if (idx.success) setBackupIndex(idx.index);
        notify.success('Backup folder ready. Offline data will auto-save here.');
      } else {
        notify.error(`Folder set but could not create it: ${init.error}`);
      }
    }
  }

  async function handleViewBackup() {
    if (!isElectron || !backupFolder) return;
    const res = await window.electronAPI.backup.loadFile(backupFolder + '/pos_cache.json');
    if (res.success) {
      const offlineOrders = res.data?.orders?.filter(o => !o._isSynced) || [];
      const total = res.data?.orders?.length || 0;
      notify.info(`Backup: ${offlineOrders.length} unsynced orders · ${total} total cached orders`);
    } else {
      notify.error('No backup data found in this folder yet.');
    }
  }

  // ── Data Recovery handlers ──
  async function handleScanAllPorts() {
    if (!isElectron || !window.electronAPI?.backup?.scanAllPorts) return;
    setScanning(true);
    setScanResult(null);
    setImportedCount(null);
    try {
      const result = await window.electronAPI.backup.scanAllPorts();
      setScanResult(result);
    } catch (err) {
      setScanResult({ success: false, error: err.message });
    } finally {
      setScanning(false);
    }
  }

  function handleImportRecovered() {
    if (!scanResult?.caches?.length) return;
    const allOrders = scanResult.caches.flatMap(c => c.unsyncedOrders);
    const count = cacheManager.injectRecoveredOrders(allOrders);
    setImportedCount(count);
    if (count > 0) {
      setTimeout(() => router.push('/offline-orders'), 1200);
    }
  }

  const cardCls = `${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-6`;
  const labelCls = `text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`;
  const mutedCls = `text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`;
  const inputCls = `flex-1 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'} outline-none`;

  return (
    <motion.div
      key="backup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl space-y-6"
    >
      {/* Header */}
      <div className={cardCls}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
            <ShieldCheck className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Offline Backup</h3>
            <p className={mutedCls}>Auto-saves all offline order data to a folder — only active when internet is disconnected</p>
          </div>
        </div>

        {/* Online/Offline status badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
          isOnline
            ? (isDark ? 'bg-green-900/20 text-green-400 border border-green-700' : 'bg-green-50 text-green-700 border border-green-200')
            : (isDark ? 'bg-orange-900/20 text-orange-400 border border-orange-700' : 'bg-orange-50 text-orange-700 border border-orange-200')
        }`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`} />
          {isOnline ? 'Online — Backup inactive (no data saved to folder while connected)' : 'Offline — Backup active (data is being saved to folder automatically)'}
        </div>

        {!isElectron && (
          <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-200'} border`}>
            <p className="text-sm text-yellow-600">Backup is only available in the desktop app.</p>
          </div>
        )}
      </div>

      {/* Local cache summary */}
      {dataSummary && (
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-4">
            <Database className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
            <span className={labelCls}>Locally Cached Data</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Offline Orders', value: dataSummary.offlineOrders, warn: dataSummary.offlineOrders > 0 },
              { label: 'Unsynced Changes', value: dataSummary.pendingChanges, warn: dataSummary.pendingChanges > 0 },
              { label: 'Change Records', value: dataSummary.cachedOrderChanges },
              { label: 'Total Orders Cached', value: dataSummary.totalCachedOrders },
            ].map(item => (
              <div key={item.label} className={`p-3 rounded-lg border ${
                item.warn
                  ? (isDark ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-200')
                  : (isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')
              }`}>
                <p className={`text-2xl font-bold ${item.warn ? (isDark ? 'text-orange-400' : 'text-orange-600') : (isDark ? 'text-white' : 'text-gray-900')}`}>{item.value}</p>
                <p className={mutedCls}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Folder selection */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={labelCls}>Backup Folder</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            Set once — works automatically
          </span>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            readOnly
            value={backupFolder}
            placeholder="No folder selected"
            className={inputCls}
          />
          <button
            onClick={handleSelectFolder}
            disabled={!isElectron}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              isElectron
                ? (isDark ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')
                : 'opacity-40 cursor-not-allowed bg-gray-200 text-gray-500'
            }`}
          >
            {backupFolder ? 'Change Folder' : 'Select Folder'}
          </button>
        </div>

        {/* Last auto-save info */}
        {backupIndex && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${isDark ? 'bg-green-900/15 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
            <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-green-300' : 'text-green-700'}`}>Last saved while offline</p>
              <p className={mutedCls}>{new Date(backupIndex.last_saved).toLocaleString()} · {backupIndex.files?.length || 0} files</p>
            </div>
            <button
              onClick={handleViewBackup}
              className={`ml-auto text-xs px-3 py-1.5 rounded-lg font-medium ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-300'}`}
            >
              Inspect
            </button>
          </div>
        )}

        {!backupFolder && (
          <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Select a folder. Once set, all offline orders and changes will be automatically written there whenever the internet is disconnected.
          </p>
        )}

      </div>

      {/* How it works */}
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-3">
          <UploadCloud className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={labelCls}>How It Works</span>
        </div>
        <div className="space-y-2">
          {[
            'Select a backup folder once in this settings page.',
            'When internet is disconnected, every offline order and change is automatically saved to that folder as JSON files.',
            'When internet is connected, nothing is written to the folder — backup is for offline sessions only.',
            'If orders fail to sync to Supabase after reconnecting, open the folder to inspect and manually re-upload the JSON files.',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data Recovery ── */}
      {isElectron && (
        <div className={`${isDark ? 'bg-amber-950/30 border-amber-700/50' : 'bg-amber-50 border-amber-200'} rounded-xl border p-6`}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-900/40' : 'bg-amber-100'}`}>
              <Database className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-base font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                  Data Recovery
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-amber-900/50 text-amber-400 border border-amber-700' : 'bg-amber-100 text-amber-700 border border-amber-300'}`}>
                  Temporary Tool
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-amber-400/70' : 'text-amber-700'}`}>
                Scans all previous app sessions stored on this device and recovers any offline orders that were never synced to the database
              </p>
            </div>
          </div>

          {/* Explanation */}
          <div className={`p-3 rounded-lg mb-4 text-sm ${isDark ? 'bg-amber-900/20 text-amber-300/80' : 'bg-amber-100 text-amber-800'}`}>
            The app was previously running on random ports which caused offline order data to become invisible on restart.
            This tool reads a snapshot of the device&apos;s local storage database (taken at startup) and shows <strong>every order from every past session</strong> — both synced and unsynced — so you can recover anything that was lost.
          </div>

          {/* Scan button */}
          <button
            onClick={handleScanAllPorts}
            disabled={scanning}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              scanning ? 'opacity-60 cursor-not-allowed' : ''
            } ${isDark ? 'bg-amber-700 hover:bg-amber-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
          >
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Scanning all sessions... this may take a moment
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Scan Device for Lost Orders
              </>
            )}
          </button>

          {/* Scan results */}
          {scanResult && (
            <div className="mt-4">
              {scanResult.success ? (
                <>
                  {/* Snapshot indicator */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3 ${
                    scanResult.usedSnapshot
                      ? (isDark ? 'bg-green-900/20 border border-green-800 text-green-400' : 'bg-green-50 border border-green-200 text-green-700')
                      : (isDark ? 'bg-yellow-900/20 border border-yellow-800 text-yellow-400' : 'bg-yellow-50 border border-yellow-200 text-yellow-700')
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${scanResult.usedSnapshot ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    {scanResult.usedSnapshot
                      ? 'Using pre-startup snapshot — most accurate, captures previous session before compaction'
                      : 'Using live database copy — restart the app once to enable the more accurate snapshot mode'}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Files Scanned', value: scanResult.filesScanned },
                      { label: 'Sessions Found', value: scanResult.totalSessions },
                      { label: 'Unsynced Orders', value: scanResult.totalUnsyncedOrders, highlight: scanResult.totalUnsyncedOrders > 0 },
                    ].map(stat => (
                      <div key={stat.label} className={`p-3 rounded-lg text-center border ${
                        stat.highlight
                          ? (isDark ? 'bg-orange-900/30 border-orange-700' : 'bg-orange-50 border-orange-300')
                          : (isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200')
                      }`}>
                        <p className={`text-2xl font-bold ${stat.highlight ? (isDark ? 'text-orange-400' : 'text-orange-600') : (isDark ? 'text-white' : 'text-gray-900')}`}>
                          {stat.value}
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Per-session breakdown — shows ALL sessions */}
                  {scanResult.caches?.length > 0 ? (
                    <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
                      {scanResult.caches.map(c => (
                        <div key={c.port} className={`p-3 rounded-lg border ${
                          c.unsyncedOrders.length > 0
                            ? (isDark ? 'bg-orange-900/20 border-orange-700/50' : 'bg-orange-50 border-orange-200')
                            : (isDark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200')
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                :{c.port}
                              </span>
                              {c.lastSync && (
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {new Date(c.lastSync).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                {c.syncedOrders?.length || 0} synced
                              </span>
                              {c.unsyncedOrders.length > 0 && (
                                <span className={`font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                                  {c.unsyncedOrders.length} UNSYNCED
                                </span>
                              )}
                              <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-700'}`}>
                                {c.totalOrders} total
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-4 rounded-lg text-center text-sm mb-4 ${isDark ? 'bg-gray-800/60 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                      No order data found in any past session.
                      {!scanResult.usedSnapshot && (
                        <p className="mt-1 text-xs">Tip: Close the app completely and reopen it, then scan again to use the more accurate snapshot mode.</p>
                      )}
                    </div>
                  )}

                  {/* Import button — only for sessions that have unsynced orders */}
                  {scanResult.totalUnsyncedOrders > 0 && importedCount === null && (
                    <button
                      onClick={handleImportRecovered}
                      className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                        isDark ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      <UploadCloud className="w-4 h-4" />
                      Import {scanResult.totalUnsyncedOrders} Unsynced Orders to Offline Queue &rarr;
                    </button>
                  )}

                  {/* After import */}
                  {importedCount !== null && (
                    <div className={`p-4 rounded-lg text-sm flex items-center gap-3 ${
                      importedCount > 0
                        ? (isDark ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-green-50 border border-green-300 text-green-700')
                        : (isDark ? 'bg-gray-800 border border-gray-700 text-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-600')
                    }`}>
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <div>
                        {importedCount > 0 ? (
                          <>
                            <p className="font-semibold">{importedCount} orders imported successfully!</p>
                            <p className="text-xs mt-0.5">Redirecting to Offline Orders page — turn internet ON and click Sync to push them to Supabase.</p>
                          </>
                        ) : (
                          <p className="font-semibold">All found orders were already in the current session — nothing new to import.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`p-4 rounded-lg text-sm flex items-start gap-2 mt-3 ${isDark ? 'bg-red-900/20 border border-red-700 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Scan failed: {scanResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const qrFileInputRef = useRef(null)

  const [user, setUser] = useState(() => authManager.isLoggedIn() ? authManager.getCurrentUser() : null)
  const [currentTheme, setCurrentTheme] = useState(() => themeManager.currentTheme || 'light')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [activeTab, setActiveTab] = useState('personal')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  const [personalInfo, setPersonalInfo] = useState(() => {
    const cached = profileManager.getLocalProfile()
    return cached || {
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
    }
  })

  const [tempLogo, setTempLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(() => profileManager.getLocalProfile()?.store_logo || '')
  const [tempQrCode, setTempQrCode] = useState(null)
  const [qrPreview, setQrPreview] = useState(() => profileManager.getLocalProfile()?.qr_code || '')
  const [validationErrors, setValidationErrors] = useState({})

  // Update state
  const [updateState, setUpdateState] = useState({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: null,
    version: null,
    currentVersion: null,
    hasChecked: false
  })

  useEffect(() => {
    // Check authentication
    if (!authManager.isLoggedIn()) {
      router.push('/')
      return
    }

    // Apply theme (user/theme already set via lazy useState)
    themeManager.applyTheme()

    // Refresh profile from network in background (non-blocking)
    refreshProfileInBackground()

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

  // Update listeners useEffect
  useEffect(() => {
    // Only run in Electron environment
    if (!window.electronAPI) return

    // Get current version
    window.electronAPI.getAppVersion().then(version => {
      setUpdateState(prev => ({ ...prev, currentVersion: version }))
    })

    // Listen to update events
    window.electronAPI.onUpdateStatus((data) => {
      if (data.status === 'checking') {
        setUpdateState(prev => ({ ...prev, checking: true }))
      }
    })

    window.electronAPI.onUpdateAvailable((data) => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        available: true,
        version: data.version
      }))
    })

    window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        available: false
      }))
    })

    window.electronAPI.onUpdateDownloadProgress((data) => {
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
      }

      setUpdateState(prev => ({
        ...prev,
        downloading: true,
        progress: {
          percent: Math.round(data.percent),
          transferred: formatBytes(data.transferred),
          total: formatBytes(data.total),
          speed: formatBytes(data.bytesPerSecond) + '/s'
        }
      }))
    })

    window.electronAPI.onUpdateDownloaded((data) => {
      setUpdateState(prev => ({
        ...prev,
        downloading: false,
        downloaded: true,
        version: data.version
      }))
      notify.success('Update downloaded! Click "Install Update" to restart and update.')
    })

    window.electronAPI.onUpdateError((data) => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        downloading: false,
        error: data.message
      }))
      notify.error('Update error: ' + data.message)

      // Auto-clear error after 10 seconds
      setTimeout(() => {
        setUpdateState(prev => ({ ...prev, error: null }))
      }, 10000)
    })

    // Cleanup listeners on unmount
    return () => {
      if (window.electronAPI?.removeUpdateListeners) {
        window.electronAPI.removeUpdateListeners()
      }
    }
  }, [])

  // Check for updates when updates tab is opened (only once)
  useEffect(() => {
    if (activeTab === 'updates' && window.electronAPI && !updateState.hasChecked && !updateState.checking) {
      handleCheckForUpdates()
    }
  }, [activeTab, updateState.hasChecked, updateState.checking])

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) {
      notify.error('Update feature is only available in desktop app')
      return
    }

    setUpdateState(prev => ({ ...prev, checking: true, error: null, hasChecked: true }))

    try {
      const result = await window.electronAPI.checkForUpdates()

      // Handle development mode or immediate response
      if (result && result.message) {
        // Development mode or error message
        setUpdateState(prev => ({
          ...prev,
          checking: false,
          error: result.message
        }))
      }
      // Otherwise, the auto-updater events will handle state updates
    } catch (error) {
      console.error('Error checking for updates:', error)
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        error: 'Failed to check for updates'
      }))
    }
  }

  const handleDownloadUpdate = async () => {
    if (!window.electronAPI) return

    try {
      await window.electronAPI.downloadUpdate()
    } catch (error) {
      console.error('Error downloading update:', error)
      notify.error('Failed to download update')
    }
  }

  const handleInstallUpdate = () => {
    if (!window.electronAPI) return
    window.electronAPI.installUpdate()
  }

  // Called on mount — silently refreshes data in background without blocking the UI
  const refreshProfileInBackground = async () => {
    try {
      await fetchUserDataDirectly(true)
    } catch (error) {
      console.error('❌ Background profile refresh failed:', error)
    }
  }

  // Called by the explicit refresh button — shows spinner and success/error toast
  const initializeProfileData = async () => {
    try {
      setIsLoading(true)
      console.log('🔄 Refreshing profile data from server...')
      await fetchUserDataDirectly(false)
    } catch (error) {
      console.error('❌ Error initializing profile data:', error)
      notify.error('Failed to load profile data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserDataDirectly = async (silent = false) => {
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
        setPersonalInfo(profileData)
        setLogoPreview(profileData.store_logo || '')
        setQrPreview(profileData.qr_code || '')
        profileManager.saveLocalProfile(profileData)

        // Save logo/QR locally for receipts — run in background, don't block UI
        if (profileData.store_logo) {
          profileManager.saveLogoLocally(profileData.store_logo).catch(() => {})
        }
        if (profileData.qr_code) {
          profileManager.saveQrLocally(profileData.qr_code).catch(() => {})
        }

        if (!silent) {
          notify.success('Profile data loaded successfully')
        }
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
    },
    {
      id: 'updates',
      name: 'Updates',
      icon: Download,
      description: 'Check for app updates'
    },
    {
      id: 'mobile',
      name: 'Mobile App',
      icon: Smartphone,
      description: 'Mobile app integration'
    },
    {
      id: 'backup',
      name: 'Backup & Recovery',
      icon: HardDrive,
      description: 'Backup offline data & recover orders'
    }
  ];

  // Get theme classes
  const classes = themeManager.getClasses();
  const themes = themeManager.getAllThemes();
  const isDark = themeManager.isDark();

  if (isLoading) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center ${classes.background}`}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-200 border-t-emerald-500" />
          <p className={`text-sm font-medium ${classes.textSecondary}`}>Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <ProtectedPage permissionKey="SETTINGS" pageName="Settings">
      <div className={`h-screen flex ${classes.background} overflow-hidden transition-all duration-500`}>
      {/* Left Sidebar */}
      <div className={`w-60 ${classes.card} ${classes.shadow} shadow-xl ${classes.border} border-r flex flex-col`}>
        {/* Header */}
        <div className={`p-3 ${classes.border} border-b ${classes.card}`}>
          <motion.button
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/dashboard')}
            className={`flex items-center ${classes.textSecondary} hover:${classes.textPrimary} transition-colors mb-2 group`}
          >
            <div className={`w-7 h-7 rounded-full ${classes.button} group-hover:${classes.shadow} group-hover:shadow-sm flex items-center justify-center mr-2 transition-colors`}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium text-xs">Back to Dashboard</span>
          </motion.button>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-bold ${classes.textPrimary}`}>Settings</h2>
              <p className={`${classes.textSecondary} text-xs`}>Customize your POS</p>
            </div>

            {/* Network Status & Refresh */}
            <div className="flex items-center space-x-1.5">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefreshData}
                disabled={isLoading}
                className={`p-1.5 rounded-lg ${classes.button} transition-all`}
                title="Refresh data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''} ${classes.textSecondary}`} />
              </motion.button>

              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-2.5">
          <h3 className={`text-[10px] font-semibold ${classes.textSecondary} uppercase tracking-wider mb-2`}>
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
                  className={`w-full text-left p-2 rounded-lg transition-all duration-300 group ${isActive
                    ? `${isDark ? 'bg-purple-900/20 border-purple-700/30' : 'bg-purple-100 border-purple-200'} border`
                    : `hover:${isDark ? 'bg-purple-900/10' : 'bg-purple-50'} ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`
                    }`}
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-lg overflow-hidden mr-2.5 ${isActive
                      ? isDark ? 'bg-purple-900/30' : 'bg-purple-200'
                      : isDark ? 'bg-purple-900/20' : 'bg-purple-100'
                      } flex items-center justify-center`}>
                      <IconComponent className={`w-4 h-4 ${isActive
                        ? isDark ? 'text-purple-400' : 'text-purple-600'
                        : isDark ? 'text-purple-400' : 'text-purple-600'
                        }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold ${isActive ? classes.textPrimary : classes.textPrimary
                        } truncate text-xs`}>
                        {item.name}
                      </div>
                      <div className={`text-[10px] ${classes.textSecondary}`}>
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
        <div className={`${classes.card} ${classes.shadow} shadow-sm ${classes.border} border-b p-3`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-bold ${classes.textPrimary}`}>
                {activeTab === 'personal' ? 'Personal Profile' : activeTab === 'theme' ? 'Appearance Settings' : activeTab === 'updates' ? 'App Updates' : 'Mobile App'}
              </h1>
              <p className={`${classes.textSecondary} text-xs flex items-center space-x-2`}>
                <span>
                  {activeTab === 'personal'
                    ? 'Manage your account information and store details'
                    : activeTab === 'theme'
                    ? 'Customize your interface theme and appearance'
                    : 'Check and install app updates'
                  }
                </span>
                {!isOnline && (
                  <span className={`${isDark ? 'text-orange-400' : 'text-orange-600'} font-medium text-xs`}>
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
                className="max-w-6xl mx-auto"
              >
                {/* Profile Header Card */}
                <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-6 mb-6`}>
                  <div className="flex items-center space-x-4">
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.5 }}
                      className="w-14 h-14 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"
                    >
                      <User className="w-7 h-7 text-white" />
                    </motion.div>
                    <div>
                      <h2 className={`text-2xl font-bold ${classes.textPrimary}`}>Profile Information</h2>
                      <p className={`${classes.textSecondary} text-sm mt-1`}>Update your personal and store details</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Left Column - Logo and QR Upload */}
                  <div className="xl:col-span-1 space-y-6">
                    {/* Logo Upload Card */}
                    <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-6`}>
                      <h3 className={`text-lg font-bold ${classes.textPrimary} mb-4 flex items-center space-x-2`}>
                        <ImageIcon className="w-5 h-5" />
                        <span>Store Logo</span>
                      </h3>
                      <div className={`${classes.border} border-2 border-dashed rounded-xl p-6 text-center space-y-4`}>
                        {logoPreview ? (
                          <div className="relative">
                            <img
                              src={logoPreview}
                              alt="Store Logo Preview"
                              className="w-full h-48 object-cover rounded-xl mx-auto shadow-lg"
                            />
                            <button
                              onClick={() => {
                                setLogoPreview('');
                                setTempLogo(null);
                                setPersonalInfo(prev => ({ ...prev, store_logo: '' }));
                                localStorage.removeItem('store_logo_local');
                                if (fileInputRef.current) fileInputRef.current.value = '';
                                notify.success('Logo removed. Click Save Changes to apply.');
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className={`w-full h-48 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-xl flex items-center justify-center`}>
                            <ImageIcon className={`w-16 h-16 ${classes.textSecondary}`} />
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
                            className={`w-full px-4 py-2.5 ${classes.button} rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2`}
                          >
                            <Upload className="w-4 h-4" />
                            <span>{logoPreview ? 'Change Logo' : 'Upload Logo'}</span>
                          </motion.button>
                          <p className={`text-xs ${classes.textSecondary} mt-2`}>
                            Recommended: 250×300px, Max 5MB
                          </p>
                        </div>
                      </div>

                      {/* Logo Toggles */}
                      <div className="mt-4 space-y-3">
                        <ModernToggle
                          checked={personalInfo.show_logo_on_receipt}
                          onChange={() => setPersonalInfo(prev => ({ ...prev, show_logo_on_receipt: !prev.show_logo_on_receipt }))}
                          label="Print Logo on Receipt"
                          description="Display logo on printed receipts"
                        />
                        <ModernToggle
                          checked={personalInfo.show_business_name_on_receipt}
                          onChange={() => setPersonalInfo(prev => ({ ...prev, show_business_name_on_receipt: !prev.show_business_name_on_receipt }))}
                          label="Print Business Name"
                          description="Display store name on receipts"
                        />
                      </div>
                    </div>

                    {/* QR Code Upload Card */}
                    <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-6`}>
                      <h3 className={`text-lg font-bold ${classes.textPrimary} mb-4 flex items-center space-x-2`}>
                        <QrCode className="w-5 h-5" />
                        <span>QR Code</span>
                      </h3>
                      <div className={`${classes.border} border-2 border-dashed rounded-xl p-6 text-center space-y-4`}>
                        {qrPreview ? (
                          <div className="relative">
                            <img
                              src={qrPreview}
                              alt="QR Code Preview"
                              className="w-full h-48 object-cover rounded-xl mx-auto shadow-lg"
                            />
                            <button
                              onClick={() => {
                                setQrPreview('');
                                setTempQrCode(null);
                                setPersonalInfo(prev => ({ ...prev, qr_code: '' }));
                                localStorage.removeItem('qr_code_local');
                                if (qrFileInputRef.current) qrFileInputRef.current.value = '';
                                notify.success('QR code removed. Click Save Changes to apply.');
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className={`w-full h-48 ${isDark ? 'bg-gray-700' : 'bg-gray-100'} rounded-xl flex items-center justify-center`}>
                            <QrCode className={`w-16 h-16 ${classes.textSecondary}`} />
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
                            className={`w-full px-4 py-2.5 ${classes.button} rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2`}
                          >
                            <Upload className="w-4 h-4" />
                            <span>{qrPreview ? 'Change QR Code' : 'Upload QR Code'}</span>
                          </motion.button>
                          <p className={`text-xs ${classes.textSecondary} mt-2`}>
                            Recommended: Square format, Max 5MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Form Fields */}
                  <div className="xl:col-span-2 space-y-6">
                    {/* Basic Information Card */}
                    <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-6`}>
                      <h3 className={`text-lg font-bold ${classes.textPrimary} mb-6`}>Basic Information</h3>

                      {/* 2 Column Grid for fields */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Customer Name */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Customer Name
                          </label>
                          <div className="relative">
                            <UserCircle className={`absolute left-4 top-3.5 w-5 h-5 ${classes.textSecondary}`} />
                            <input
                              type="text"
                              value={personalInfo.customer_name || ''}
                              readOnly
                              placeholder="Customer name"
                              className={`w-full pl-12 pr-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl ${classes.textSecondary} cursor-not-allowed ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} focus:outline-none`}
                            />
                          </div>
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>Read-only field</p>
                        </div>

                        {/* Email */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Email Address
                          </label>
                          <div className="relative">
                            <Mail className={`absolute left-4 top-3.5 w-5 h-5 ${classes.textSecondary}`} />
                            <input
                              type="email"
                              value={personalInfo.email || ''}
                              readOnly
                              placeholder="Email address"
                              className={`w-full pl-12 pr-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl ${classes.textSecondary} cursor-not-allowed ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} focus:outline-none`}
                            />
                          </div>
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>Read-only field</p>
                        </div>

                        {/* Store Name */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Store Name
                          </label>
                          <div className="relative">
                            <Store className={`absolute left-4 top-3.5 w-5 h-5 ${classes.textSecondary}`} />
                            <input
                              type="text"
                              value={personalInfo.store_name || ''}
                              readOnly
                              placeholder="Store name"
                              className={`w-full pl-12 pr-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl ${classes.textSecondary} cursor-not-allowed ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} focus:outline-none`}
                            />
                          </div>
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>Read-only field</p>
                        </div>

                        {/* Phone */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className={`absolute left-4 top-3.5 w-5 h-5 ${classes.textSecondary}`} />
                            <input
                              type="tel"
                              value={personalInfo.phone || ''}
                              onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                              placeholder="Enter phone number"
                              className={`w-full pl-12 pr-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl ${classes.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all focus:outline-none`}
                            />
                          </div>
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>Any format accepted</p>
                        </div>

                        {/* Invoice Status */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Invoice Status
                          </label>
                          <div className="relative">
                            <CreditCard className={`absolute left-4 top-3.5 w-5 h-5 ${classes.textSecondary}`} />
                            <div className={`w-full pl-12 pr-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl cursor-not-allowed ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} flex items-center`}>
                              <span className={`font-semibold ${getInvoiceStatusColor(personalInfo.invoice_status)}`}>
                                {getInvoiceStatusDisplay(personalInfo.invoice_status)}
                              </span>
                            </div>
                          </div>
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>Managed by admin</p>
                        </div>
                      </div>

                      {/* Store Address - Full Width */}
                      <div className="mt-4">
                        <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                          Store Address
                        </label>
                        <div className="relative">
                          <MapPin className={`absolute left-4 top-3.5 w-5 h-5 ${classes.textSecondary}`} />
                          <textarea
                            value={personalInfo.store_address || ''}
                            onChange={(e) => handlePersonalInfoChange('store_address', e.target.value)}
                            placeholder="Enter your complete store address"
                            rows={3}
                            className={`w-full pl-12 pr-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl ${classes.textPrimary} focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none focus:outline-none ${validationErrors.store_address ? 'border-red-500' : ''
                              }`}
                          />
                        </div>
                        {validationErrors.store_address && (
                          <div className="flex items-center mt-1.5 text-red-500">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            <p className="text-xs">{validationErrors.store_address}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Receipt Settings Card */}
                    <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-6`}>
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                          <QrCode className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold ${classes.textPrimary}`}>Receipt Settings</h3>
                          <p className={`text-sm ${classes.textSecondary}`}>Customize your thermal receipt footer</p>
                        </div>
                      </div>

                      {/* 2 Column Grid for Hashtags */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Hashtag 1 */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Hashtag 1
                          </label>
                          <input
                            type="text"
                            value={personalInfo.hashtag1 || ''}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, hashtag1: e.target.value })}
                            className={`w-full px-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary} focus:outline-none`}
                            placeholder="#YourBrand"
                            maxLength="30"
                          />
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>e.g., #CheesySpace</p>
                        </div>

                        {/* Hashtag 2 */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Hashtag 2
                          </label>
                          <input
                            type="text"
                            value={personalInfo.hashtag2 || ''}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, hashtag2: e.target.value })}
                            className={`w-full px-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary} focus:outline-none`}
                            placeholder="#YourCity"
                            maxLength="30"
                          />
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>e.g., #Lahore</p>
                        </div>
                      </div>

                      {/* Show Footer Toggle */}
                      <ModernToggle
                        checked={personalInfo.show_footer_section}
                        onChange={() => setPersonalInfo({ ...personalInfo, show_footer_section: !personalInfo.show_footer_section })}
                        label="Show Footer Section"
                        description="Include QR code, review message, and hashtags on receipts"
                      />

                      {/* Preview */}
                      <div className={`mt-4 ${isDark ? 'bg-gray-800' : 'bg-blue-50'} rounded-xl p-5 border-2 border-dashed ${isDark ? 'border-gray-700' : 'border-blue-200'}`}>
                        <p className={`text-xs font-bold ${classes.textPrimary} mb-3`}>Receipt Footer Preview:</p>
                        {personalInfo.show_footer_section ? (
                          <div className={`text-xs ${classes.textSecondary} space-y-1 text-center`}>
                            <p>[QR CODE]</p>
                            <p className="mt-2">Drop a review & flex on us!</p>
                            <p>Your feedback = our glow up</p>
                            {(personalInfo.hashtag1 || personalInfo.hashtag2) ? (
                              <p className="font-semibold text-purple-600 dark:text-purple-400 mt-1">
                                {[personalInfo.hashtag1, personalInfo.hashtag2].filter(Boolean).join(' ')}
                              </p>
                            ) : (
                              <p className="font-medium text-gray-400 italic mt-1">
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

                    {/* Business Hours Card */}
                    <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-2xl p-6`}>
                      <div className="flex items-center space-x-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                          <Clock className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className={`text-lg font-bold ${classes.textPrimary}`}>Business Hours</h3>
                          <p className={`text-sm ${classes.textSecondary}`}>Set your daily operational hours</p>
                        </div>
                      </div>

                      {/* 2 Column Grid for Business Hours */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Business Start Time */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Business Day Starts At
                          </label>
                          <input
                            type="time"
                            value={personalInfo.business_start_time || '10:00'}
                            onChange={(e) => handlePersonalInfoChange('business_start_time', e.target.value)}
                            className={`w-full px-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary} focus:outline-none`}
                          />
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>e.g., 10:00 AM</p>
                        </div>

                        {/* Business End Time */}
                        <div>
                          <label className={`block text-sm font-semibold ${classes.textPrimary} mb-2`}>
                            Business Day Ends At
                          </label>
                          <input
                            type="time"
                            value={personalInfo.business_end_time || '03:00'}
                            onChange={(e) => handlePersonalInfoChange('business_end_time', e.target.value)}
                            className={`w-full px-4 py-3.5 ${classes.card} ${classes.border} border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${classes.textPrimary} focus:outline-none`}
                          />
                          <p className={`text-xs ${classes.textSecondary} mt-1.5`}>Can be next day, e.g., 03:00 AM</p>
                        </div>
                      </div>

                      {/* Info Box */}
                      <div className={`mt-4 ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'} rounded-xl p-4 border ${isDark ? 'border-blue-800' : 'border-blue-200'}`}>
                        <div className="flex items-start space-x-3">
                          <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                          <div>
                            <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-900'} mb-1`}>
                              How Business Hours Work
                            </p>
                            <p className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                              Orders are grouped by your business day to prevent midnight from splitting your actual operational period.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSavePersonalInfo}
                        disabled={isSaving}
                        className={`px-8 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-3 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                      >
                        {isSaving ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>Saving Changes...</span>
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
              </motion.div>
            )}

            {activeTab === 'theme' && (
              <motion.div
                key="theme"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl"
              >
                <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-xl p-5`}>
                  {/* Theme Options */}
                  <div className="space-y-3">
                    <h3 className={`text-sm font-semibold ${classes.textPrimary} mb-3`}>Color Scheme</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {Object.entries(themes).map(([themeKey, theme]) => (
                        <motion.button
                          key={themeKey}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleThemeChange(themeKey)}
                          disabled={isTransitioning}
                          className={`relative p-4 rounded-xl border text-left transition-all duration-300 ${themeKey === currentTheme
                            ? 'border-purple-500 shadow-md bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20'
                            : `${classes.border} hover:border-purple-300`
                            } ${isTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                                themeKey === 'light'
                                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                  : 'bg-gradient-to-br from-indigo-600 to-purple-700'
                              }`}
                            >
                              {themeKey === 'light' ? (
                                <Sun className="w-5 h-5 text-white" />
                              ) : (
                                <Moon className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div className="text-left flex-1">
                              <div className={`font-semibold text-sm ${classes.textPrimary}`}>{theme.name}</div>
                              <div className={`text-xs ${classes.textSecondary}`}>
                                {themeKey === 'light' ? 'Bright interface' : 'Dark interface'}
                              </div>
                            </div>
                            {currentTheme === themeKey && (
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Updates Tab */}
            {activeTab === 'updates' && (
              <motion.div
                key="updates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl"
              >
                <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-xl p-5`}>
                  {/* Current Version - Compact */}
                  <div className={`mb-4 p-4 rounded-xl ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs ${classes.textSecondary} mb-1`}>Current Version</p>
                        <p className={`text-xl font-bold ${classes.textPrimary}`}>
                          {updateState.currentVersion || 'Loading...'}
                        </p>
                      </div>
                      <CheckCircle className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                  </div>

                  {/* Update Status */}
                  <div className="space-y-3">
                    {/* Checking for updates */}
                    {updateState.checking && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${isDark ? 'bg-gray-700/30 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="animate-spin rounded-full h-7 w-7 border-3 border-blue-500 border-t-transparent"></div>
                          <div>
                            <p className={`font-semibold text-sm ${classes.textPrimary}`}>Checking for updates...</p>
                            <p className={`text-xs ${classes.textSecondary}`}>Please wait</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Update available */}
                    {updateState.available && !updateState.downloading && !updateState.downloaded && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${isDark ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
                              <Download className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                            </div>
                            <div>
                              <p className={`font-bold text-sm ${classes.textPrimary}`}>Update Available!</p>
                              <p className={`text-xs ${classes.textSecondary}`}>Version {updateState.version}</p>
                            </div>
                          </div>
                        </div>
                        <p className={`${classes.textSecondary} mb-3 text-xs`}>
                          New version with improvements and features available.
                        </p>
                        <button
                          onClick={handleDownloadUpdate}
                          className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 text-sm"
                        >
                          Download Update
                        </button>
                      </motion.div>
                    )}

                    {/* Downloading update */}
                    {updateState.downloading && updateState.progress && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${isDark ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}
                      >
                        <div className="flex items-center space-x-3 mb-4">
                          <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-900/30' : 'bg-blue-100'}`}>
                            <Download className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'} animate-bounce`} />
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${classes.textPrimary}`}>Downloading Update</p>
                            <p className={`text-xs ${classes.textSecondary}`}>Version {updateState.version}</p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className={`font-semibold ${classes.textPrimary}`}>{updateState.progress.percent}%</span>
                            <span className={classes.textSecondary}>{updateState.progress.transferred} / {updateState.progress.total}</span>
                          </div>
                          <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2 overflow-hidden`}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${updateState.progress.percent}%` }}
                              transition={{ duration: 0.3 }}
                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full"
                            />
                          </div>
                          <div className="text-xs text-center">
                            <span className={classes.textSecondary}>{updateState.progress.speed}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Update downloaded */}
                    {updateState.downloaded && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${isDark ? 'bg-green-900/20 border-green-500/30' : 'bg-green-50 border-green-200'}`}
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
                            <CheckCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${classes.textPrimary}`}>Update Ready!</p>
                            <p className={`text-xs ${classes.textSecondary}`}>Version {updateState.version}</p>
                          </div>
                        </div>
                        <p className={`${classes.textSecondary} mb-3 text-xs`}>
                          Update downloaded. Restart to install.
                        </p>
                        <button
                          onClick={handleInstallUpdate}
                          className="w-full py-2.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all duration-200 text-sm"
                        >
                          Restart & Install
                        </button>
                      </motion.div>
                    )}

                    {/* No update available */}
                    {!updateState.checking && !updateState.available && !updateState.downloading && !updateState.downloaded && !updateState.error && updateState.hasChecked && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${isDark ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${isDark ? 'bg-green-900/30' : 'bg-green-100'}`}>
                            <CheckCircle className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${classes.textPrimary}`}>You're up to date!</p>
                            <p className={`text-xs ${classes.textSecondary}`}>No updates found</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Error state */}
                    {updateState.error && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl border ${isDark ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-200'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${isDark ? 'bg-red-900/30' : 'bg-red-100'}`}>
                            <AlertTriangle className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${classes.textPrimary}`}>Update Error</p>
                            <p className={`text-xs ${classes.textSecondary}`}>{updateState.error}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Check for updates button */}
                    <button
                      onClick={handleCheckForUpdates}
                      disabled={updateState.checking || updateState.downloading}
                      className={`w-full py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
                        updateState.checking || updateState.downloading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : `${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} ${classes.textPrimary}`
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${updateState.checking ? 'animate-spin' : ''}`} />
                      {updateState.checking ? 'Checking...' : 'Check for Updates'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Mobile App Tab */}
            {activeTab === 'mobile' && (
              <motion.div
                key="mobile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-3xl"
              >
                <div className={`${classes.card} ${classes.shadow} ${classes.border} rounded-xl p-8`}>
                  {/* Coming Soon Content */}
                  <div className="text-center py-12">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                        isDark ? 'bg-gradient-to-br from-purple-900/30 to-pink-900/30' : 'bg-gradient-to-br from-purple-100 to-pink-100'
                      }`}>
                        <Smartphone className={`w-12 h-12 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className={`text-2xl font-bold ${classes.textPrimary} mb-3`}>
                      Mobile App Integration
                    </h3>

                    {/* Badge */}
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold mb-6">
                      <Clock className="w-4 h-4 mr-2" />
                      Coming Soon
                    </div>

                    {/* Description */}
                    <p className={`${classes.textSecondary} leading-relaxed max-w-md mx-auto mb-8`}>
                      We're working on an amazing mobile app experience that will allow you to manage your POS system on the go.
                      Stay tuned for updates!
                    </p>

                    {/* Features Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      {[
                        { title: 'Real-time Sync', desc: 'Instant data synchronization across devices' },
                        { title: 'Order Management', desc: 'Manage orders from anywhere' },
                        { title: 'Sales Analytics', desc: 'View reports and insights on mobile' },
                        { title: 'Notifications', desc: 'Get instant alerts for new orders' }
                      ].map((feature, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-xl border ${
                            isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              isDark ? 'bg-purple-400' : 'bg-purple-600'
                            }`}></div>
                            <div className="text-left flex-1">
                              <p className={`font-semibold text-sm ${classes.textPrimary}`}>{feature.title}</p>
                              <p className={`text-xs ${classes.textSecondary} mt-1`}>{feature.desc}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Backup & Recovery Tab */}
            {activeTab === 'backup' && (
              <BackupPanel isDark={isDark} classes={classes} />
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </ProtectedPage>
  );
}
