const { app, BrowserWindow, ipcMain, systemPreferences, dialog, Menu } = require('electron');
const path = require('path');

// Import our new managers
const AudioManager = require('./audioManager');
const BufferManager = require('./bufferManager');
const WhisperProcessor = require('./whisperProcessor');
const ModelManager = require('./modelManager');

let store;

// Initialize store asynchronously
async function initStore() {
  const Store = (await import('electron-store')).default;
  store = new Store();
}

let overlayWindow = null;
let controlWindow = null;

// Audio processing components
let audioManager = null;
let bufferManager = null;
let whisperProcessor = null;
let modelManager = null;
let isTranscribing = false;

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

// Theme management IPC handlers
ipcMain.handle('set-theme', (event, theme) => {
  store.set('theme', theme);
  // Apply theme to overlay window
  if (overlayWindow) {
    overlayWindow.webContents.send('theme-changed', theme);
  }
});

ipcMain.handle('get-theme', () => {
  return store.get('theme', 'light');
});

// Model management IPC handlers
ipcMain.handle('get-model-status', async (event, modelName) => {
  if (!modelManager) return { exists: false, downloading: false };
  return await modelManager.getModelStatus(modelName);
});

ipcMain.handle('download-model', async (event, modelName) => {
  if (!modelManager) throw new Error('Model manager not initialized');
  return await modelManager.downloadModel(modelName);
});

ipcMain.handle('delete-model', async (event, modelName) => {
  if (!modelManager) throw new Error('Model manager not initialized');
  return await modelManager.deleteModel(modelName);
});

ipcMain.handle('list-models', async () => {
  if (!modelManager) return [];
  return await modelManager.listAvailableModels();
});

// Initialize ModelManager separately so it's available immediately
async function initializeModelManager() {
  try {
    console.log('Initializing ModelManager...');
    modelManager = new ModelManager();
    console.log('ModelManager initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize ModelManager:', error);
    return false;
  }
}

// Initialize audio processing components
async function initializeAudioProcessing() {
  try {
    console.log('Initializing audio processing components...');
    
    // Initialize ModelManager if not already done
    if (!modelManager) {
      await initializeModelManager();
    }
    
    // Initialize other components
    audioManager = new AudioManager();
    bufferManager = new BufferManager({
      chunkDurationMs: store.get('chunkDurationMs', 2000),
      overlapMs: store.get('overlapMs', 500),
      sampleRate: 16000
    });
    whisperProcessor = new WhisperProcessor({
      model: store.get('whisperModel', 'base.en'),
      language: store.get('language', 'en'),
      max_queue_size: store.get('maxQueueSize', 10)
    });

    // Set ModelManager in WhisperProcessor
    whisperProcessor.setModelManager(modelManager);

    // Set up event handlers
    setupAudioEventHandlers();

    // Initialize each component
    const audioInit = await audioManager.initialize();
    const whisperInit = await whisperProcessor.initialize();

    if (audioInit && whisperInit) {
      console.log('Audio processing components initialized successfully');
      return true;
    } else {
      throw new Error('Failed to initialize audio components');
    }
  } catch (error) {
    console.error('Failed to initialize audio processing:', error);
    return false;
  }
}

// Set up event handlers for audio processing pipeline
function setupAudioEventHandlers() {
  if (!audioManager || !bufferManager || !whisperProcessor || !modelManager) return;

  // Model Manager events
  modelManager.on('download-progress', (progress) => {
    // Send progress to control window
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('model-download-progress', progress);
    }
  });

  modelManager.on('download-complete', (result) => {
    console.log('Model download completed:', result.modelName);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('model-download-complete', result);
    }
  });

  modelManager.on('download-error', (error) => {
    console.error('Model download error:', error);
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('model-download-error', error);
    }
  });

  // Audio Manager events
  audioManager.on('audio-data', (audioData) => {
    if (bufferManager && isTranscribing) {
      bufferManager.addAudioData(audioData);
    }
  });

  audioManager.on('audio-level', (level) => {
    // Send audio level to renderer processes
    if (controlWindow && !controlWindow.isDestroyed()) {
      controlWindow.webContents.send('audio-level', level);
    }
  });

  audioManager.on('error', (error) => {
    console.error('AudioManager error:', error);
    sendToRenderers('transcription-error', error);
  });

  // Buffer Manager events
  bufferManager.on('chunk-ready', async (chunk) => {
    if (whisperProcessor && isTranscribing) {
      await whisperProcessor.processChunk(chunk);
    }
  });

  // Whisper Processor events
  whisperProcessor.on('transcription-result', (result) => {
    console.log('Transcription result:', result);
    sendToRenderers('transcription-data', result);
  });

  whisperProcessor.on('transcription-error', (error) => {
    console.error('WhisperProcessor error:', error);
    sendToRenderers('transcription-error', error);
  });
}

// Helper function to send data to all renderer processes
function sendToRenderers(channel, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data);
  }
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.webContents.send(channel, data);
  }
}

// Real transcription handlers
ipcMain.handle('start-transcription', async () => {
  try {
    console.log('Starting real-time transcription...');
    
    if (!audioManager || !bufferManager || !whisperProcessor || !modelManager) {
      const initialized = await initializeAudioProcessing();
      if (!initialized) {
        throw new Error('Failed to initialize audio processing components');
      }
    }

    // Clear any existing data
    bufferManager.clear();
    whisperProcessor.clearQueue();

    // Start audio recording
    const started = audioManager.startRecording();
    if (started) {
      isTranscribing = true;
      sendToRenderers('transcription-status', { 
        message: 'Recording and transcribing...', 
        type: 'recording' 
      });
      return true;
    } else {
      throw new Error('Failed to start audio recording');
    }

  } catch (error) {
    console.error('Error starting transcription:', error);
    sendToRenderers('transcription-error', {
      type: 'start-failed',
      message: error.message
    });
    return false;
  }
});

ipcMain.handle('stop-transcription', async () => {
  try {
    console.log('Stopping transcription...');
    
    isTranscribing = false;
    
    if (audioManager) {
      audioManager.stopRecording();
    }
    
    // Process any remaining chunks
    if (whisperProcessor && bufferManager) {
      // Wait a moment for final processing
      setTimeout(() => {
        bufferManager.clear();
      }, 2000);
    }

    sendToRenderers('transcription-status', { 
      message: 'Transcription stopped', 
      type: 'stopped' 
    });

    return true;

  } catch (error) {
    console.error('Error stopping transcription:', error);
    sendToRenderers('transcription-error', {
      type: 'stop-failed',
      message: error.message
    });
    return false;
  }
});

ipcMain.handle('pause-transcription', async () => {
  try {
    console.log('Pausing transcription...');
    
    if (audioManager && isTranscribing) {
      audioManager.pauseRecording();
      sendToRenderers('transcription-status', { 
        message: 'Transcription paused', 
        type: 'paused' 
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error pausing transcription:', error);
    sendToRenderers('transcription-error', {
      type: 'pause-failed',
      message: error.message
    });
    return false;
  }
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
  
  // Initialize ModelManager early so it's available for downloads
  await initializeModelManager();
  
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
app.on('before-quit', async () => {
  console.log('Application is about to quit');
  
  // Stop transcription and cleanup audio components
  if (isTranscribing) {
    console.log('Stopping transcription before quit...');
    isTranscribing = false;
    
    if (audioManager) {
      audioManager.stopRecording();
    }
  }
  
  // Dispose of audio components
  if (audioManager) {
    audioManager.dispose();
  }
  if (bufferManager) {
    bufferManager.dispose();
  }
  if (whisperProcessor) {
    await whisperProcessor.dispose();
  }
  
  console.log('Audio components cleaned up');
});