# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Whisper Transcriber** is an Electron-based real-time audio transcription application that displays transcribed text in a transparent, always-on-top overlay window. The app integrates with OpenAI's Whisper model for speech-to-text conversion and exports transcripts as SRT files for video synchronization.

## Development Commands

### Core Commands
```bash
npm start           # Launch the application
npm run dev         # Launch with DevTools enabled (--dev flag)
npm run build       # Build distributable packages
npm run dist        # Build without publishing
npm install         # Install dependencies and rebuild native modules
```

### Development Mode
The `--dev` flag automatically opens DevTools for both overlay and control windows, enabling debugging of the transparent overlay interface.

## Architecture Overview

### Multi-Window Architecture
The application uses a dual-window system:
- **Overlay Window**: Transparent, frameless, always-on-top window displaying real-time transcription
- **Control Window**: Traditional windowed interface for settings and controls

### Process Structure
```
Main Process (src/main/main.js)
├── Window Management: Creates and manages both windows
├── IPC Handlers: Bridges communication between processes
├── Settings Persistence: Uses electron-store for configuration
├── Platform Integration: Handles microphone permissions (macOS)
└── Menu System: macOS-specific application menu

Renderer Processes
├── Overlay (overlay.html/js/css): Real-time transcript display
└── Controls (controls.html/js/css): Settings and recording controls

Preload Script (src/preload/preload.js)
└── Secure IPC Bridge: Exposes electronAPI to renderer processes
```

### Key Architectural Patterns

**Settings Management**: Uses `electron-store` with async initialization via dynamic import (ESM compatibility). Settings persist window positions, opacity, and user preferences.

**IPC Communication**: All inter-process communication flows through secure IPC handlers with no node integration in renderers. The preload script exposes a controlled `electronAPI` interface.

**Window State Management**: The overlay window maintains position, size, and opacity state. Window movement triggers automatic position persistence.

**Permission Handling**: Platform-specific microphone permission management with fallback strategies for Windows/Linux vs macOS.

## Current Implementation Status

### Completed Systems
- ✅ Transparent overlay with custom window controls
- ✅ Settings persistence and real-time opacity adjustment
- ✅ SRT file generation with proper timestamp formatting
- ✅ Real-time audio capture and streaming with `node-record-lpcm16`
- ✅ Whisper integration with `nodejs-whisper` for live transcription
- ✅ Advanced audio processing pipeline with buffer management
- ✅ GPU acceleration detection and optimization
- ✅ Multilingual support with automatic language detection
- ✅ Punctuation and capitalization enhancement
- ✅ Cross-platform permission handling
- ✅ Complete UI/UX for both windows
- ✅ Experimental advanced features (speaker diarization, grammar correction, vocabulary management, emotion analysis)

### Advanced Features (Branch: `advanced-features`)
This branch includes sophisticated audio processing and AI capabilities:
- **AudioManager**: Real-time microphone capture with event-driven architecture
- **BufferManager**: Circular buffering with advanced VAD, AGC, and filtering
- **WhisperProcessor**: Queue-based transcription with model caching and parallel processing
- **GPUDetector**: Automatic GPU capability detection (NVIDIA, AMD, Metal, Vulkan)
- **LanguageDetector**: 15+ language support with automatic detection
- **PunctuationProcessor**: Intelligent punctuation and capitalization enhancement
- **Experimental Features**: Speaker diarization, grammar correction, vocabulary management, emotion analysis

### Documentation References
- 📖 **README.md**: User guide and feature overview
- 📚 **docs/advanced-features.md**: Deep dive into audio processing and AI features
- 📋 **docs/plan.md**: Development roadmap and implementation details
- 🔧 **CLAUDE.md** (this file): Developer technical reference

### Critical Implementation Notes

**Store Initialization**: `electron-store` v10+ requires async import. The store must be initialized before creating windows:
```javascript
async function initStore() {
  const Store = (await import('electron-store')).default;
  store = new Store();
}
```

**Transparency Handling**: The overlay uses `transparent: true`, `frame: false`, and CSS backdrop-filter for modern transparency effects. Window opacity is controlled via `setOpacity()`.

**Security Model**: Strict security with `contextIsolation: true`, `nodeIntegration: false`, and controlled IPC exposure through preload scripts.

**Platform Differences**: macOS requires explicit microphone permission requests via `systemPreferences.askForMediaAccess()`. Other platforms typically have default permission.

## File Organization

### Source Structure
```
src/
├── main/           # Main process (Electron backend)
├── preload/        # Secure IPC bridge
└── renderer/       # UI processes (HTML/CSS/JS)
```

### Asset Management
- `assets/`: Application icons and resources
- `exports/`: Generated transcript files  
- `models/`: Whisper model storage (when implemented)

## Development Considerations

### Window Management
Both windows can exist independently. The control window can be closed/reopened while maintaining the overlay. Use `showControls()` IPC handler to manage control window lifecycle.

### State Synchronization
Settings changes in the control panel immediately affect the overlay window through IPC communication. The overlay window can trigger control panel display through the settings button.

### Export System
SRT generation happens in the overlay renderer process but file saving uses main process dialog APIs. The SRT format includes precise timestamps for video synchronization.

### Keyboard Shortcuts
- `Escape`: Toggle recording in overlay window
- `Cmd+Enter`: Save transcript
- `Cmd+,`: Show controls (macOS menu)
- `Ctrl+Space`: Toggle recording (control panel)

When implementing real Whisper integration, replace the mock transcription in `overlay.js` and connect the placeholder IPC handlers in `main.js` to actual audio processing pipeline.

## Documentation Guide

This repository includes comprehensive documentation for different audiences:

### For End Users
📖 **[README.md](./README.md)** - Start here!
- Feature overview and highlights
- Installation and setup instructions
- Usage guide with keyboard shortcuts
- Troubleshooting and support
- Configuration reference

### For Advanced Users
📚 **[docs/advanced-features.md](./docs/advanced-features.md)**
- Audio processing pipeline deep dive
- GPU acceleration configuration
- Multilingual support details
- Advanced feature usage (experimental)
- Performance tuning guide
- Complete configuration reference

### For Developers
🔧 **CLAUDE.md** (this file)
- Architecture and technical patterns
- Development setup and commands
- File organization and IPC structure
- Implementation notes and considerations
- Critical system patterns

### Project Planning
📋 **[docs/plan.md](./docs/plan.md)**
- Development roadmap
- Phase-by-phase implementation details
- Project timeline and milestones
- Technical architecture
- Completed systems and future features

### Branch-Specific Documentation
This `advanced-features` branch includes:
- **Advanced Audio Processing**: Sophisticated buffer management with VAD, AGC, high-pass filtering
- **GPU Acceleration**: Automatic NVIDIA CUDA, AMD Radeon, Apple Metal, and Vulkan detection
- **Multilingual AI**: 15+ language support with automatic detection
- **Post-Processing**: Intelligent punctuation, capitalization, and text enhancement
- **Experimental AI**: Speaker diarization, grammar correction, vocabulary management, emotion analysis

## Quick Links

- 🚀 **Getting Started**: See [README.md](./README.md#-running-the-application)
- 🎯 **Features**: See [README.md](./README.md#-key-features)
- ⚙️ **Configuration**: See [docs/advanced-features.md](./docs/advanced-features.md#configuration-reference)
- 🔧 **Troubleshooting**: See [README.md](./README.md#-troubleshooting)
- 📊 **Performance**: See [docs/advanced-features.md](./docs/advanced-features.md#performance-tuning)
- 🧪 **Experimental Features**: See [docs/advanced-features.md](./docs/advanced-features.md#experimental-ai-features)