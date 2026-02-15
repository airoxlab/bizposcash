const { contextBridge, ipcRenderer } = require('electron');

window.global = window.global || window;

const api = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Auto-update methods
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Auto-update event listeners
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', () => callback()),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, data) => callback(data)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, data) => callback(data)),

  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-status');
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  },

  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showErrorDialog: (title, content) => ipcRenderer.invoke('show-error-dialog', title, content),
  
  onNavigate: (callback) => ipcRenderer.on('navigate', callback),
  onNewOrder: (callback) => ipcRenderer.on('new-order', callback),
  
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Printer methods
  printerTestConnection: (data) => ipcRenderer.invoke('printer-test-connection', data),
  printerPrintReceipt: (data) => ipcRenderer.invoke('printer-print-receipt', data),
  printerPrintKitchen: (data) => ipcRenderer.invoke('printer-print-kitchen', data),  // Added
  printerTestKitchen: (data) => ipcRenderer.invoke('printer-test-kitchen', data),      // Added
  printerRawTest: (data) => ipcRenderer.invoke('printer-raw-test', data),
  printerStatus: (data) => ipcRenderer.invoke('printer-status', data),
  printerSave: (data) => ipcRenderer.invoke('printer-save', data),
  printerLoad: () => ipcRenderer.invoke('printer-load'),
  printerDelete: (printerId) => ipcRenderer.invoke('printer-delete', printerId),

  // USB Printer methods
  printerPrintUSB: (data) => ipcRenderer.invoke('printer-print-usb', data),
  printerPrintUSBKitchenToken: (data) => ipcRenderer.invoke('printer-print-usb-kitchen-token', data),
  printerTestUSB: (data) => ipcRenderer.invoke('printer-test-usb', data),
  usbDetectPrinters: () => ipcRenderer.invoke('usb-detect-printers'),
  usbCheckPort: (data) => ipcRenderer.invoke('usb-check-port', data),

  // Kitchen token printer (IP)
  printKitchenToken: (orderData, userProfile, printerConfig) => ipcRenderer.invoke('print-kitchen-token', { orderData, userProfile, printerConfig }),
  
  customerFindByPhone: (data) => ipcRenderer.invoke('customer-find-by-phone', data),
  customerCreate: (data) => ipcRenderer.invoke('customer-create', data),
  customerUpdate: (data) => ipcRenderer.invoke('customer-update', data),
  
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  
  whatsapp: {
    connect: () => ipcRenderer.invoke('whatsapp-connect'),
    checkConnection: () => ipcRenderer.invoke('whatsapp-check-connection'),
    disconnect: () => ipcRenderer.invoke('whatsapp-disconnect'),
    sendCampaign: (data) => ipcRenderer.invoke('whatsapp-send-campaign', data),
    
    onProgress: (callback) => {
      ipcRenderer.on('campaign-progress', (event, data) => callback(data));
    },
    
    removeProgressListener: () => {
      ipcRenderer.removeAllListeners('campaign-progress');
    }
  },
  
  marketing: {
    uploadMedia: (data) => ipcRenderer.invoke('upload-campaign-media', data),
    getCampaigns: (userEmail) => ipcRenderer.invoke('marketing-get-campaigns', userEmail),
    getMessageStatuses: (campaignId) => ipcRenderer.invoke('marketing-get-message-statuses', campaignId),
    getCustomers: (userId) => ipcRenderer.invoke('marketing-get-customers', userId)
  },
  
  platform: process.platform,
  isElectron: true
};

contextBridge.exposeInMainWorld('electronAPI', api);
contextBridge.exposeInMainWorld('electron', api);

window.addEventListener('DOMContentLoaded', () => {
  if (typeof global === 'undefined') {
    window.global = window;
  }
  
  if (process.env.NODE_ENV === 'production') {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
  
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  
  document.addEventListener('drop', (e) => {
    e.preventDefault();
  });
  
  document.body.classList.add('electron-app');
});

console.log('Preload script loaded');