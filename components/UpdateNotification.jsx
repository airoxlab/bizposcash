'use client';

import { useEffect, useState } from 'react';

export default function UpdateNotification() {
  const [updateState, setUpdateState] = useState({
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: null,
    version: null
  });

  useEffect(() => {
    // Only run in Electron environment
    if (!window.electronAPI) return;

    // Listen to update events
    window.electronAPI.onUpdateStatus((data) => {
      if (data.status === 'checking') {
        setUpdateState(prev => ({ ...prev, checking: true }));
      }
    });

    window.electronAPI.onUpdateAvailable((data) => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        available: true,
        version: data.version
      }));
    });

    window.electronAPI.onUpdateNotAvailable(() => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        available: false
      }));
    });

    window.electronAPI.onUpdateDownloadProgress((data) => {
      setUpdateState(prev => ({
        ...prev,
        downloading: true,
        progress: {
          percent: Math.round(data.percent),
          transferred: formatBytes(data.transferred),
          total: formatBytes(data.total),
          speed: formatBytes(data.bytesPerSecond) + '/s'
        }
      }));
    });

    window.electronAPI.onUpdateDownloaded((data) => {
      setUpdateState(prev => ({
        ...prev,
        downloading: false,
        downloaded: true,
        version: data.version
      }));
    });

    window.electronAPI.onUpdateError((data) => {
      setUpdateState(prev => ({
        ...prev,
        checking: false,
        downloading: false,
        error: data.message
      }));

      // Auto-hide error after 10 seconds
      setTimeout(() => {
        setUpdateState(prev => ({ ...prev, error: null }));
      }, 10000);
    });

    // Cleanup listeners on unmount
    return () => {
      if (window.electronAPI?.removeUpdateListeners) {
        window.electronAPI.removeUpdateListeners();
      }
    };
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleInstallUpdate = () => {
    if (window.electronAPI) {
      window.electronAPI.installUpdate();
    }
  };

  const handleDownloadUpdate = () => {
    if (window.electronAPI) {
      setUpdateState(prev => ({ ...prev, downloading: true }));
      window.electronAPI.downloadUpdate();
    }
  };

  const handleDismiss = () => {
    setUpdateState({
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      error: null,
      progress: null,
      version: null
    });
  };

  // Error notification
  if (updateState.error) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
        <div className="bg-red-500 text-white rounded-lg shadow-2xl p-4 border border-red-600">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Update Error</h3>
              <p className="text-sm opacity-90">{updateState.error}</p>
            </div>
            <button onClick={handleDismiss} className="flex-shrink-0 text-white/80 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Update downloaded - ready to install
  if (updateState.downloaded) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-2xl p-6 border border-green-400">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">Update Ready!</h3>
              <p className="text-sm mb-1 text-white/90">
                Version {updateState.version} has been downloaded
              </p>
              <p className="text-sm mb-4 text-white/80">
                Restart the app to install the update
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstallUpdate}
                  className="flex-1 bg-white text-green-600 font-semibold px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
                >
                  Restart Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Downloading update with progress
  if (updateState.downloading && updateState.progress) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-2xl p-6 border border-blue-400">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">Downloading Update</h3>
              <p className="text-sm mb-3 text-white/90">
                Version {updateState.version}
              </p>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1 text-white/80">
                  <span>{updateState.progress.percent}%</span>
                  <span>{updateState.progress.transferred} / {updateState.progress.total}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-300"
                    style={{ width: `${updateState.progress.percent}%` }}
                  />
                </div>
                <div className="text-xs text-white/70 mt-1">
                  Speed: {updateState.progress.speed}
                </div>
              </div>

              <p className="text-xs text-white/70">
                Please wait while the update is being downloaded...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Update available - not yet downloading
  if (updateState.available) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg shadow-2xl p-6 border border-blue-400">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-2">Update Available!</h3>
              <p className="text-sm mb-4 text-white/90">
                Version {updateState.version} is now available
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadUpdate}
                  className="flex-1 bg-white text-blue-600 font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Download Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Checking for updates
  if (updateState.checking) {
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-right">
        <div className="bg-gray-700 text-white rounded-lg shadow-xl p-4 border border-gray-600">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm">Checking for updates...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
