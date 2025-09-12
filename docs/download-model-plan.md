# Whisper Model Download & Dark Theme Implementation Plan

## Overview
Implement a model management system within the configuration panel that allows users to download and manage Whisper models locally. This includes adding a progress bar for download tracking and implementing a dark theme across the entire application.

## Phase 1: Dark Theme Implementation

### 1.1 Theme System Architecture
- **Create theme configuration system**
  - Add theme settings to electron-store
  - Define color palettes for light/dark modes
  - Create CSS custom properties for theme switching

### 1.2 Control Panel Dark Theme
- **Update controls.html**
  - Modify existing styles to use CSS custom properties
  - Implement dark color scheme with modern UI aesthetics
  - Add theme toggle control in settings panel

- **Update controls.css**
  - Replace hardcoded colors with CSS variables
  - Create dark theme color palette
  - Improve visual hierarchy with better contrast ratios

### 1.3 Overlay Window Dark Theme
- **Update overlay.html and overlay.css**
  - Apply dark theme to transcript display
  - Maintain readability with appropriate text colors
  - Update semi-transparent background for dark mode

### 1.4 Theme Persistence
- **Main process theme management**
  - Add theme IPC handlers in main.js
  - Persist theme preference in electron-store
  - Apply theme on application startup

## Phase 2: Model Management System

### 2.1 Model Download Infrastructure
- **Create modelManager.js**
  - Download management using native Node.js https/fs modules
  - Progress tracking with byte-level precision
  - Model validation and integrity checking
  - Local storage organization in models/ directory

### 2.2 Available Whisper Models
- **Model configuration**
  - tiny.en (39 MB) - English only, fastest
  - base.en (74 MB) - English only, balanced
  - small.en (244 MB) - English only, good accuracy
  - medium.en (769 MB) - English only, better accuracy
  - large (1550 MB) - Multilingual, best accuracy

### 2.3 Download Progress UI
- **Progress bar component**
  - Real-time download progress display
  - Estimated time remaining calculation
  - Download speed indicator
  - Pause/resume functionality
  - Error handling and retry mechanisms

### 2.4 Model Selection Interface
- **Configuration panel updates**
  - Model dropdown with size and description
  - Download status indicators (not downloaded, downloading, ready)
  - Storage space requirements display
  - Model deletion option for space management

## Phase 3: Integration with Existing System

### 3.1 WhisperProcessor Updates
- **Model loading optimization**
  - Check local model availability before processing
  - Graceful fallback to download prompt if model missing
  - Dynamic model switching without restart

### 3.2 Storage Management
- **Local model organization**
  - `/models/whisper/` directory structure
  - Model metadata tracking (version, size, checksum)
  - Automatic cleanup of incomplete downloads

### 3.3 User Experience Improvements
- **First-run experience**
  - Model download wizard on first launch
  - Recommended model suggestions based on use case
  - Storage space availability checking

## Phase 4: Error Handling & Edge Cases

### 4.1 Network Error Handling
- **Robust download system**
  - Network interruption recovery
  - Timeout handling with exponential backoff
  - Corrupted download detection and re-download
  - Offline mode graceful degradation

### 4.2 Storage Error Handling
- **Disk space management**
  - Pre-download space validation
  - Cleanup of failed downloads
  - User notification for storage issues
  - Model compression options

## Technical Implementation Details

### File Structure
```
src/main/
├── main.js (updated with theme and model IPC handlers)
├── modelManager.js (new - download and model management)
└── whisperProcessor.js (updated - local model loading)

src/renderer/
├── controls.html (updated - dark theme and model UI)
├── controls.css (updated - dark theme styles)
├── controls.js (updated - model download handling)
├── overlay.html (updated - dark theme)
└── overlay.css (updated - dark theme styles)

models/whisper/ (new directory for local models)
```

### Key Dependencies
- Native Node.js modules (https, fs, path, crypto)
- Progress tracking via custom EventEmitter
- Existing electron-store for settings persistence

### IPC Communication
```javascript
// New IPC handlers
'download-model': async (modelName) => modelManager.downloadModel(modelName)
'get-model-status': async (modelName) => modelManager.getModelStatus(modelName)
'delete-model': async (modelName) => modelManager.deleteModel(modelName)
'set-theme': async (theme) => settings.setTheme(theme)
'get-theme': async () => settings.getTheme()
```

### CSS Custom Properties for Theming
```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #333333;
  --text-secondary: #666666;
  --accent-primary: #007acc;
  --border-color: #dddddd;
}

[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text-primary: #ffffff;
  --text-secondary: #cccccc;
  --accent-primary: #0e639c;
  --border-color: #404040;
}
```

## Success Criteria
1. ✅ Dark theme fully implemented across all windows
2. ✅ Model download with progress tracking works reliably
3. ✅ Models are stored locally and loaded efficiently
4. ✅ Graceful error handling for all failure scenarios
5. ✅ User can switch models without application restart
6. ✅ Storage management with cleanup capabilities
7. ✅ Theme preference persists between sessions

## Estimated Implementation Time
- **Phase 1 (Dark Theme)**: 2-3 hours
- **Phase 2 (Model Management)**: 4-5 hours
- **Phase 3 (Integration)**: 2-3 hours
- **Phase 4 (Error Handling)**: 2-3 hours
- **Total**: 10-14 hours

## Testing Strategy
1. **Theme Testing**: Verify theme switching works correctly in both windows
2. **Download Testing**: Test downloads with various network conditions
3. **Model Testing**: Verify transcription works with locally downloaded models
4. **Storage Testing**: Test behavior with limited disk space
5. **Integration Testing**: Complete end-to-end workflow testing

This plan provides a comprehensive approach to implementing both the model download functionality and dark theme while maintaining the existing application's stability and user experience.