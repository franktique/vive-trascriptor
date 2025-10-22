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

// Audio processing components
let audioManager = null;
let bufferManager = null;
let whisperProcessor = null;
let modelManager = null;
let isTranscribing = false;

function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    minWidth: 600,
    minHeight: 300,
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

ipcMain.handle('set-opacity', (event, opacity) => {
  if (overlayWindow) {
    overlayWindow.setOpacity(opacity);
    store.set('overlayOpacity', opacity);
  }
});

ipcMain.handle('set-font-size', (event, fontSize) => {
  store.set('fontSize', fontSize);
});

ipcMain.handle('get-font-size', () => {
  return store.get('fontSize', 16);
});

ipcMain.handle('check-microphone-permission', async () => {
  return await checkMicrophonePermission();
});

ipcMain.handle('request-microphone-permission', async () => {
  return await checkMicrophonePermission();
});

// External link handler
const { shell } = require('electron');
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    throw error;
  }
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

ipcMain.handle('save-transcript', async (event, content) => {
  const result = await dialog.showSaveDialog(overlayWindow, {
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

// Audio Parameter IPC handlers
ipcMain.handle('set-audio-parameter', async (event, paramId, value) => {
  try {
    // Validate parameter ranges
    const paramLimits = {
      silenceThreshold: { min: -60, max: -10 },
      normalizationTarget: { min: -30, max: -10 },
      confidenceThreshold: { min: 0.3, max: 0.9 },
      highPassCutoff: { min: 100, max: 800 },
      agcTargetLevel: { min: -30, max: -10 },
      maxParallelChunks: { min: 1, max: 4 },
      vadEnergyThreshold: { min: -40, max: -20 }
    };

    const limits = paramLimits[paramId];
    if (!limits) {
      throw new Error(`Unknown audio parameter: ${paramId}`);
    }

    // Validate value is within limits
    if (value < limits.min || value > limits.max) {
      throw new Error(`Parameter ${paramId} value ${value} out of range [${limits.min}, ${limits.max}]`);
    }

    // Save to store
    store.set(`audioParam_${paramId}`, value);

    // Update relevant processor if running
    let bufferResult = null;
    let whisperResult = null;

    if (bufferManager) {
      bufferResult = bufferManager.updateParameter(paramId, value);
      console.log(`BufferManager parameter update result:`, bufferResult);
    }

    if (whisperProcessor) {
      whisperResult = whisperProcessor.updateParameter(paramId, value);
      console.log(`WhisperProcessor parameter update result:`, whisperResult);
    }

    // Determine overall success
    const success = (bufferResult?.success !== false) && (whisperResult?.success !== false);

    console.log(`Audio parameter updated: ${paramId} = ${value} (success: ${success})`);
    return {
      success: true,
      paramId,
      value,
      bufferManager: bufferResult,
      whisperProcessor: whisperResult
    };
  } catch (error) {
    console.error(`Error setting audio parameter ${paramId}:`, error);
    throw error;
  }
});

ipcMain.handle('get-audio-parameter', async (event, paramId) => {
  try {
    const defaults = {
      silenceThreshold: -40,
      normalizationTarget: -20,
      confidenceThreshold: 0.6,
      highPassCutoff: 300,
      agcTargetLevel: -20,
      maxParallelChunks: 2,
      vadEnergyThreshold: -35
    };

    const value = store.get(`audioParam_${paramId}`);
    return value !== undefined ? value : defaults[paramId];
  } catch (error) {
    console.error(`Error getting audio parameter ${paramId}:`, error);
    throw error;
  }
});

ipcMain.handle('get-all-audio-parameters', async (event) => {
  try {
    const defaults = {
      silenceThreshold: -40,
      normalizationTarget: -20,
      confidenceThreshold: 0.6,
      highPassCutoff: 300,
      agcTargetLevel: -20,
      maxParallelChunks: 2,
      vadEnergyThreshold: -35
    };

    const params = {};
    Object.keys(defaults).forEach(paramId => {
      params[paramId] = store.get(`audioParam_${paramId}`, defaults[paramId]);
    });

    return params;
  } catch (error) {
    console.error('Error getting all audio parameters:', error);
    throw error;
  }
});

ipcMain.handle('reset-audio-parameter', async (event, paramId) => {
  try {
    const defaults = {
      silenceThreshold: -40,
      normalizationTarget: -20,
      confidenceThreshold: 0.6,
      highPassCutoff: 300,
      agcTargetLevel: -20,
      maxParallelChunks: 2,
      vadEnergyThreshold: -35
    };

    const defaultValue = defaults[paramId];
    if (defaultValue === undefined) {
      throw new Error(`Unknown audio parameter: ${paramId}`);
    }

    store.set(`audioParam_${paramId}`, defaultValue);

    // Update relevant processor if running
    if (bufferManager) {
      bufferManager.updateParameter(paramId, defaultValue);
    }
    if (whisperProcessor) {
      whisperProcessor.updateParameter(paramId, defaultValue);
    }

    console.log(`Audio parameter reset: ${paramId} = ${defaultValue}`);
    return { success: true, value: defaultValue };
  } catch (error) {
    console.error(`Error resetting audio parameter ${paramId}:`, error);
    throw error;
  }
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
    // Send progress to overlay window
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('model-download-progress', progress);
    }
  });

  modelManager.on('download-complete', (result) => {
    console.log('Model download completed:', result.modelName);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('model-download-complete', result);
    }
  });

  modelManager.on('download-error', (error) => {
    console.error('Model download error:', error);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('model-download-error', error);
    }
  });

  // Audio Manager events
  audioManager.on('audio-data', (audioData) => {
    if (bufferManager && isTranscribing) {
      bufferManager.addAudioData(audioData);
    }
  });

  audioManager.on('audio-level', (level) => {
    // Send audio level to overlay renderer process
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('audio-level', level);
    }
  });

  audioManager.on('error', (error) => {
    console.error('AudioManager error:', error);
    sendToRenderers('transcription-error', error);
  });

  // Buffer Manager events
  bufferManager.on('chunk-ready', async (chunk) => {
    if (whisperProcessor && isTranscribing) {
      // Send audio statistics to overlay for real-time metering
      if (chunk.audioStats) {
        const audioStats = {
          peakDb: chunk.audioStats.peakDb,
          rmsDb: chunk.audioStats.rmsDb,
          dynamicRange: chunk.audioStats.dynamicRange,
          timestamp: Date.now()
        };
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('audio-stats', audioStats);
        }
      }

      await whisperProcessor.processChunk(chunk);
    }
  });

  bufferManager.on('chunk-skipped', (data) => {
    // Send info about skipped chunks (silence detection)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.webContents.send('chunk-skipped', {
        reason: data.reason,
        chunkId: data.chunkId,
        silenceInfo: data.silenceInfo
      });
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

// Helper function to send data to overlay renderer process
function sendToRenderers(channel, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data);
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