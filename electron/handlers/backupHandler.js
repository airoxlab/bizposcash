const { dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

function registerBackupHandlers(ipcMain) {

  // Open folder picker dialog and return selected path
  ipcMain.handle('backup:select-folder', async (event) => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Select Backup Folder',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths.length) return { canceled: true };
    return { canceled: false, path: filePaths[0] };
  });

  // Initialize backup folder — creates it on disk and writes a placeholder index.
  // Safe to call while online (writes no actual backup data).
  ipcMain.handle('backup:init-folder', async (event, { folderPath }) => {
    try {
      if (!folderPath) return { success: false, error: 'No folder path provided' };
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      const indexPath = path.join(folderPath, 'offline_backup_index.json');
      // Only write placeholder if no index exists yet (don't overwrite real data)
      if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, JSON.stringify({
          initialized: new Date().toISOString(),
          app_version: app.getVersion(),
          last_saved: null,
          files: []
        }, null, 2), 'utf8');
      }
      console.log('[backupHandler] Folder initialized:', folderPath);
      return { success: true };
    } catch (err) {
      console.error('[backupHandler] Init-folder error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ─────────────────────────────────────────────────────────────
  // AUTO-SAVE: called automatically whenever offline data is cached
  // Overwrites a single live file — no timestamped sub-folders
  // Only called from the renderer when navigator.onLine === false
  // ─────────────────────────────────────────────────────────────
  ipcMain.handle('backup:auto-save', async (event, { data, folderPath }) => {
    try {
      if (!folderPath) return { success: false, error: 'No backup folder set' };
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const savedFiles = [];
      for (const [key, value] of Object.entries(data)) {
        const filePath = path.join(folderPath, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
        savedFiles.push(path.basename(filePath));
      }

      // Update a lightweight index file so the settings page can show last-saved time
      const indexPath = path.join(folderPath, 'offline_backup_index.json');
      fs.writeFileSync(indexPath, JSON.stringify({
        last_saved: new Date().toISOString(),
        app_version: app.getVersion(),
        files: savedFiles
      }, null, 2), 'utf8');

      console.log('[backupHandler] Auto-saved offline data:', savedFiles);
      return { success: true, files: savedFiles };
    } catch (err) {
      console.error('[backupHandler] Auto-save error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // Read the auto-save index (for the settings page to display last backup info)
  ipcMain.handle('backup:read-index', async (event, { folderPath }) => {
    try {
      const indexPath = path.join(folderPath, 'offline_backup_index.json');
      if (!fs.existsSync(indexPath)) return { success: false, error: 'No backup found' };
      const content = fs.readFileSync(indexPath, 'utf8');
      return { success: true, index: JSON.parse(content) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Load a specific backup file
  ipcMain.handle('backup:load-file', async (event, { filePath }) => {
    try {
      if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
      const content = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: JSON.parse(content) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Return OS Documents folder as the default backup location
  ipcMain.handle('backup:default-path', () => {
    return { path: app.getPath('documents') };
  });
}

module.exports = { registerBackupHandlers };
