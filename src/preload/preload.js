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
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),

  // Platform info
  platform: process.platform
});