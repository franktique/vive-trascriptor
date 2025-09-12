const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  setOverlayOpacity: (opacity) => ipcRenderer.invoke('set-overlay-opacity', opacity),
  getOverlayOpacity: () => ipcRenderer.invoke('get-overlay-opacity'),
  minimizeOverlay: () => ipcRenderer.invoke('minimize-overlay'),
  closeOverlay: () => ipcRenderer.invoke('close-overlay'),
  showControls: () => ipcRenderer.invoke('show-controls'),

  // Microphone permissions
  checkMicrophonePermission: () => ipcRenderer.invoke('check-microphone-permission'),
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),

  // File operations
  saveTranscript: (content) => ipcRenderer.invoke('save-transcript', content),

  // Audio transcription (will be implemented)
  startTranscription: () => ipcRenderer.invoke('start-transcription'),
  stopTranscription: () => ipcRenderer.invoke('stop-transcription'),
  pauseTranscription: () => ipcRenderer.invoke('pause-transcription'),

  // Event listeners
  onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback),
  onTranscriptionError: (callback) => ipcRenderer.on('transcription-error', callback),
  onTranscriptionStatus: (callback) => ipcRenderer.on('transcription-status', callback),
  onAudioLevel: (callback) => ipcRenderer.on('audio-level', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Theme management
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', callback),

  // Model management
  getModelStatus: (modelName) => ipcRenderer.invoke('get-model-status', modelName),
  downloadModel: (modelName) => ipcRenderer.invoke('download-model', modelName),
  deleteModel: (modelName) => ipcRenderer.invoke('delete-model', modelName),
  listModels: () => ipcRenderer.invoke('list-models'),
  
  // Model download events
  onModelDownloadProgress: (callback) => ipcRenderer.on('model-download-progress', callback),
  onModelDownloadComplete: (callback) => ipcRenderer.on('model-download-complete', callback),
  onModelDownloadError: (callback) => ipcRenderer.on('model-download-error', callback),

  // Platform info
  platform: process.platform
});