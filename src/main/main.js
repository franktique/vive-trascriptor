const { app, BrowserWindow, ipcMain, systemPreferences, dialog, Menu } = require('electron');
const path = require('path');
let store;

// Initialize store asynchronously
async function initStore() {
  const Store = (await import('electron-store')).default;
  store = new Store();
}

let overlayWindow = null;
let controlWindow = null;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 800,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  
  // Set initial opacity from settings
  const opacity = store.get('overlayOpacity', 0.8);
  overlayWindow.setOpacity(opacity);
  
  // Position window from settings or default to top-right
  const position = store.get('overlayPosition', { x: 100, y: 100 });
  overlayWindow.setPosition(position.x, position.y);

  overlayWindow.on('moved', () => {
    const [x, y] = overlayWindow.getPosition();
    store.set('overlayPosition', { x, y });
  });

  if (process.argv.includes('--dev')) {
    overlayWindow.webContents.openDevTools({ mode: 'detach' });
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: false,
    frame: true,
    alwaysOnTop: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, '../preload/preload.js')
    }
  });

  controlWindow.loadFile(path.join(__dirname, '../renderer/controls.html'));

  if (process.argv.includes('--dev')) {
    controlWindow.webContents.openDevTools({ mode: 'detach' });
  }

  controlWindow.on('closed', () => {
    controlWindow = null;
  });
}

async function checkMicrophonePermission() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    
    if (status === 'not-determined') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return granted;
    }
    
    return status === 'granted';
  }
  
  // On Windows and Linux, assume permission is available
  return true;
}

// IPC handlers
ipcMain.handle('set-overlay-opacity', (event, opacity) => {
  if (overlayWindow) {
    overlayWindow.setOpacity(opacity);
    store.set('overlayOpacity', opacity);
  }
});

ipcMain.handle('get-overlay-opacity', () => {
  return store.get('overlayOpacity', 0.8);
});

ipcMain.handle('check-microphone-permission', async () => {
  return await checkMicrophonePermission();
});

ipcMain.handle('request-microphone-permission', async () => {
  return await checkMicrophonePermission();
});

ipcMain.handle('minimize-overlay', () => {
  if (overlayWindow) {
    overlayWindow.minimize();
  }
});

ipcMain.handle('close-overlay', () => {
  if (overlayWindow) {
    overlayWindow.close();
  }
});

ipcMain.handle('show-controls', () => {
  if (controlWindow) {
    controlWindow.focus();
  } else {
    createControlWindow();
  }
});

ipcMain.handle('save-transcript', async (event, content) => {
  const result = await dialog.showSaveDialog(controlWindow || overlayWindow, {
    defaultPath: 'transcript.srt',
    filters: [
      { name: 'SubRip Files', extensions: ['srt'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    const fs = require('fs').promises;
    await fs.writeFile(result.filePath, content);
    return true;
  }
  return false;
});

ipcMain.handle('get-setting', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-setting', (event, key, value) => {
  store.set(key, value);
});

// Transcription handlers (placeholder implementations)
ipcMain.handle('start-transcription', async () => {
  console.log('Starting transcription...');
  // TODO: Implement actual Whisper transcription start
  return true;
});

ipcMain.handle('stop-transcription', async () => {
  console.log('Stopping transcription...');
  // TODO: Implement actual Whisper transcription stop
  return true;
});

ipcMain.handle('pause-transcription', async () => {
  console.log('Pausing transcription...');
  // TODO: Implement actual Whisper transcription pause
  return true;
});

// Menu setup (macOS)
function createMenu() {
  const template = [
    {
      label: 'Whisper Transcriber',
      submenu: [
        {
          label: 'About Whisper Transcriber',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Show Controls',
          accelerator: 'Command+,',
          click: () => {
            if (controlWindow) {
              controlWindow.focus();
            } else {
              createControlWindow();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Whisper Transcriber',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  // Initialize store first
  await initStore();
  
  // Check microphone permission on startup
  const hasPermission = await checkMicrophonePermission();
  
  if (!hasPermission) {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Microphone Access Required',
      message: 'Whisper Transcriber needs microphone access to transcribe audio.',
      detail: 'Please grant microphone permission when prompted.',
      buttons: ['Continue', 'Quit'],
      defaultId: 0,
      cancelId: 1
    });

    if (result.response === 1) {
      app.quit();
      return;
    }
  }

  createOverlayWindow();
  createControlWindow();
  
  if (process.platform === 'darwin') {
    createMenu();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOverlayWindow();
    createControlWindow();
  }
});

// Ensure app doesn't quit when overlay is closed (only when control window is closed)
app.on('before-quit', (event) => {
  // Save any pending data
  console.log('Application is about to quit');
});