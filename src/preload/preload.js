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
  resumeTranscription: () => ipcRenderer.invoke('resume-transcription'),
  setOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),

  // Event listeners
  onTranscriptionData: (callback) => ipcRenderer.on('transcription-data', callback),
  onTranscriptionError: (callback) => ipcRenderer.on('transcription-error', callback),
  onTranscriptionStatus: (callback) => ipcRenderer.on('transcription-status', callback),
  onAudioLevel: (callback) => ipcRenderer.on('audio-level', callback),
  onAudioStats: (callback) => ipcRenderer.on('audio-stats', callback),
  onChunkSkipped: (callback) => ipcRenderer.on('chunk-skipped', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Theme management
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', callback),

  // Audio Parameter management
  setAudioParameter: (paramId, value) => ipcRenderer.invoke('set-audio-parameter', paramId, value),
  getAudioParameter: (paramId) => ipcRenderer.invoke('get-audio-parameter', paramId),
  getAllAudioParameters: () => ipcRenderer.invoke('get-all-audio-parameters'),
  resetAudioParameter: (paramId) => ipcRenderer.invoke('reset-audio-parameter', paramId),

  // External link opening
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

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