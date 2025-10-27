# Whisper Transcriber

A powerful, real-time audio transcription application built with Electron and OpenAI's Whisper model. Displays live transcriptions in a transparent, always-on-top overlay window while capturing high-quality audio from your microphone.

**Transform your voice into text instantly** — Perfect for content creators, researchers, developers, and accessibility needs.

---

## 🎯 Key Features

### Core Transcription
- **Real-time Speech-to-Text**: Continuous audio capture and transcription using OpenAI Whisper
- **Transparent Overlay Window**: Always-on-top display that doesn't interfere with your workflow
- **Multi-format Export**: Save transcripts as SRT, TXT, or JSON files
- **Timestamp Synchronization**: Precise timing for video subtitle integration

### Audio Processing
- **Advanced Audio Buffering**: Intelligent 2-second chunks with 0.5s overlap for smooth, continuous transcription
- **Noise Filtering**: Built-in high-pass filtering and silence detection
- **Adaptive Gain Control (AGC)**: Automatic volume normalization for consistent results
- **Voice Activity Detection (VAD)**: Smart silence detection using zero-crossing rate and energy analysis

### Advanced Features
- **GPU Acceleration Detection**: Automatically detects and optimizes for NVIDIA, AMD, Metal (macOS), and Vulkan
- **Multilingual Support**: Built-in language detection and support for 15+ languages
- **Punctuation Processing**: Automatic capitalization and punctuation enhancement
- **Customizable Audio Processing**: Fine-tune all audio parameters for your microphone
- **Experimental Features**: Speaker diarization, grammar correction, vocabulary management, and emotion analysis

### User Interface
- **Customizable Overlay**: Adjust transparency (10-100%), font size, and position
- **Real-time Controls**: Start/Stop/Pause transcription with visual feedback
- **Audio Level Visualization**: Monitor input levels in real-time
- **Settings Panel**: Comprehensive configuration for all features
- **Keyboard Shortcuts**: Quick access to common functions

---

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher
- **RAM**: 4GB minimum (8GB recommended)
- **Disk Space**: 2GB minimum (for Whisper models)
- **Microphone**: Any standard audio input device

### Platform-Specific Requirements

**macOS**
- OS X 10.13 (High Sierra) or later
- SoX audio processing library (auto-installed via Homebrew)
- Microphone permission in System Preferences

**Windows**
- Windows 7 or later
- Visual C++ Runtime
- FFmpeg (optional, for advanced audio processing)

**Linux**
- glibc 2.27 or later
- SoX and/or FFmpeg
- ALSA or PulseAudio for audio input

### Optional Dependencies
- **GPU Support**: CUDA toolkit (NVIDIA), AMD drivers (AMD Radeon), or Metal (macOS)
- **Advanced Audio**: FFmpeg for enhanced audio processing

---

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd vive-translator
```

### 2. Install Dependencies
```bash
npm install
```

This will:
- Install Node.js dependencies
- Download required audio processing libraries
- Configure Whisper bindings
- Rebuild native modules for your platform

### 3. Verify Installation (Optional)
```bash
npm start --help
```

---

## 🎮 Running the Application

### Development Mode
```bash
npm start
```
Launches the application normally.

### Development Mode with DevTools
```bash
npm run dev
```
Launches with DevTools enabled for debugging overlay and control windows.

### Building for Distribution
```bash
# Build without publishing
npm run dist

# Full build with signing (requires certificates)
npm run build
```

---

## 📖 Usage Guide

### Starting Your First Transcription

1. **Launch the Application**
   ```bash
   npm start
   ```

2. **Grant Microphone Permissions**
   - macOS: Allow microphone access when prompted
   - Windows/Linux: System will request permissions if needed

3. **Click the Record Button** ▶️
   - Text will appear in real-time in the overlay
   - Audio levels shown in the control panel

4. **Save Your Transcript**
   - Press `Cmd+Enter` (macOS) or use File menu
   - Choose format: SRT, TXT, or JSON
   - File saved to `exports/` directory

### Keyboard Shortcuts

#### Overlay Window
| Shortcut | Action |
|----------|--------|
| `ESC` | Toggle recording on/off |
| `Cmd+Enter` (macOS) | Save transcript |
| `Ctrl+Shift+C` (Windows/Linux) | Clear transcript |
| `Cmd+Shift+C` (macOS) | Clear transcript |

#### Control Panel
| Shortcut | Action |
|----------|--------|
| `Ctrl+Space` | Toggle recording |
| `Cmd+S` (macOS) | Save transcript |
| `Cmd+,` (macOS) | Show settings |

### Customizing the Overlay

**Position & Size**
- Drag the title bar to move the window
- Drag edges to resize
- Position is automatically saved

**Appearance**
- **Transparency**: Use slider in control panel (10-100%)
- **Font Size**: Adjustable in settings
- **Font Color**: Customize text color
- **Background Opacity**: Adjust overlay background

**Audio Settings**
- **Input Device**: Select microphone from dropdown
- **Sample Rate**: Default 16kHz (optimal for Whisper)
- **Sensitivity**: Threshold for audio detection
- **Noise Filter**: Enable/disable high-pass filtering

### Exporting Transcripts

The app supports multiple export formats:

**SRT Format** (for video subtitles)
```
1
00:00:01,000 --> 00:00:04,500
First transcribed sentence here.

2
00:00:04,500 --> 00:00:08,200
Second transcribed sentence continues.
```

**TXT Format** (plain text)
```
First transcribed sentence here.
Second transcribed sentence continues.
...
```

**JSON Format** (structured data)
```json
{
  "timestamp": "2025-10-21T10:30:00Z",
  "model": "base.en",
  "language": "en",
  "segments": [
    {
      "start": 1000,
      "end": 4500,
      "text": "First transcribed sentence here.",
      "confidence": 0.95
    }
  ]
}
```

---

## ⚙️ Configuration

### Settings File Location
- **macOS**: `~/Library/Application Support/Whisper Transcriber/config.json`
- **Windows**: `%APPDATA%/Whisper Transcriber/config.json`
- **Linux**: `~/.config/Whisper Transcriber/config.json`

### Common Configuration Options

```javascript
{
  // Window settings
  "overlayOpacity": 0.8,          // 0.1 to 1.0
  "overlayPosition": { "x": 100, "y": 100 },
  "overlaySize": { "width": 1000, "height": 600 },

  // Audio settings
  "audioSampleRate": 16000,       // Hz
  "audioChannels": 1,             // Mono
  "audioThreshold": 0.5,          // 0.0 to 1.0
  "silenceDuration": 300,         // Milliseconds

  // Transcription settings
  "whisperModel": "base.en",      // base.en, small.en, medium.en
  "language": "en",               // Language code
  "enablePunctuation": true,      // Add punctuation to output
  "enableCapitalization": true,   // Capitalize sentences

  // Advanced settings
  "enableGPU": true,              // Use GPU if available
  "enableAdvancedVAD": true,      // Advanced voice detection
  "enableAGC": true               // Automatic gain control
}
```

---

## 📁 Project Structure

```
whisper-transcriber/
├── src/
│   ├── main/                    # Main process (backend)
│   │   ├── main.js              # Application initialization & IPC handlers
│   │   ├── audioManager.js       # Microphone capture & stream management
│   │   ├── bufferManager.js      # Audio buffering & preprocessing
│   │   ├── whisperProcessor.js   # Whisper transcription engine
│   │   ├── modelManager.js       # Whisper model management
│   │   ├── gpuDetector.js        # GPU capability detection
│   │   ├── languageDetector.js   # Multilingual support
│   │   ├── punctuationProcessor.js # Text enhancement
│   │   ├── speakerDiarizer.js    # Speaker identification (experimental)
│   │   ├── grammarCorrector.js   # Grammar enhancement (experimental)
│   │   ├── vocabularyManager.js  # Custom vocabulary (experimental)
│   │   └── emotionAnalyzer.js    # Emotion detection (experimental)
│   │
│   ├── renderer/                 # Renderer process (frontend)
│   │   ├── overlay.html          # Main transcription display
│   │   ├── overlay.js            # Overlay logic & event handling
│   │   ├── overlay.css           # Overlay styling
│   │   ├── controls.html         # Control panel UI
│   │   ├── controls.js           # Control logic
│   │   └── controls.css          # Control styling
│   │
│   └── preload/
│       └── preload.js            # Secure IPC bridge
│
├── assets/                       # Icons and resources
├── models/                       # Whisper model cache directory
├── exports/                      # Generated transcript files
├── docs/                         # Documentation
├── dist/                         # Built application packages
├── package.json                  # Dependencies & build config
├── CLAUDE.md                     # Developer reference
└── README.md                     # This file
```

---

## 🔧 Advanced Audio Processing Features

### Audio Buffer Management
The BufferManager handles sophisticated audio processing:
- **Circular Buffering**: Continuous audio capture with efficient memory management
- **Chunk Overlap**: 0.5-second overlap between chunks for seamless transcription
- **Silence Detection**: Identifies and processes only speech segments
- **Audio Normalization**: Maintains consistent levels across different microphones

### Voice Activity Detection (VAD)
- **Dual Detection Method**: Combines energy analysis and zero-crossing rate
- **Configurable Thresholds**: Fine-tune sensitivity to your environment
- **Adaptive Silence Handling**: Handles background noise intelligently

### Audio Filtering
- **High-Pass Filter**: Removes low-frequency noise (default 300Hz cutoff)
- **Automatic Gain Control**: Normalizes volume automatically
- **Frequency Response**: Optimized for human speech (300Hz - 8kHz)

---

## 🚀 GPU Acceleration

The application automatically detects and can utilize:

**NVIDIA CUDA**
- Requires: CUDA Toolkit 11.0+
- Benefit: 3-5x faster transcription on supported GPUs

**AMD Radeon**
- Requires: AMD Radeon drivers
- Benefit: GPU-accelerated audio processing

**Apple Metal** (macOS)
- Native: Automatic on M1/M2/M3 Macs
- Benefit: Excellent performance on Apple Silicon

**Vulkan**
- Cross-platform alternative
- Fallback option for other systems

**GPU Status**: Check the logs for GPU detection results:
```
[GPU] NVIDIA CUDA detected: RTX 3070
[GPU] Recommended batch size: 4
```

---

## 🌍 Supported Languages

The app supports 15+ languages with automatic detection:

| Language | Code | Status |
|----------|------|--------|
| English | en | ✅ Optimized |
| Spanish | es | ✅ Supported |
| French | fr | ✅ Supported |
| German | de | ✅ Supported |
| Italian | it | ✅ Supported |
| Portuguese | pt | ✅ Supported |
| Dutch | nl | ✅ Supported |
| Russian | ru | ✅ Supported |
| Polish | pl | ✅ Supported |
| Turkish | tr | ✅ Supported |
| Arabic | ar | ✅ Supported |
| Chinese | zh | ✅ Supported |
| Japanese | ja | ✅ Supported |
| Korean | ko | ✅ Supported |
| Hindi | hi | ✅ Supported |

**Enable Auto-Detection**: Leave language set to "auto" for automatic language detection.

---

## 🧪 Experimental Features

These advanced features are available but still in development:

### Speaker Diarization
Identifies and labels different speakers in your transcript.
- Status: 🔧 Experimental
- Use Case: Interviews, meetings, podcasts
- Enable in: Settings → Advanced → Speaker Detection

### Grammar Correction
Automatically corrects grammar and improves sentence structure.
- Status: 🔧 Experimental
- Use Case: Formal documents, professional communication
- Enable in: Settings → Advanced → Grammar Correction

### Vocabulary Manager
Maintains custom dictionary for domain-specific terms.
- Status: 🔧 Experimental
- Use Case: Medical, legal, technical transcription
- Enable in: Settings → Advanced → Vocabulary

### Emotion Analysis
Detects emotional tone in speech patterns.
- Status: 🔧 Experimental
- Use Case: Customer service, content analysis
- Enable in: Settings → Advanced → Emotion Detection

---

## 🐛 Troubleshooting

### "Microphone not found" Error
**Solution:**
1. Check System Preferences → Security & Privacy → Microphone
2. Ensure the app is in the allowed list
3. Try selecting a different input device in settings
4. Restart the application

### Audio Playback Issues
**Check:**
- Sample rate matches system setting (usually 16000 Hz)
- No other app is exclusively using the microphone
- Audio input device is properly connected
- Try adjusting the sensitivity threshold

**Solution:**
```bash
# Reset settings to defaults
rm ~/Library/Application\ Support/Whisper\ Transcriber/config.json
npm start
```

### Transcription is Slow
**Optimization steps:**
1. Ensure GPU is being utilized (check logs with `npm run dev`)
2. Close other applications to free memory
3. Use a smaller model: `base.en` instead of `medium.en`
4. Increase chunk size in settings (trade-off: less real-time)

### "Permission denied" on macOS
**Solution:**
```bash
# Grant microphone permission via command line
sudo tccutil reset Microphone com.whispertranscriber.app
# Then restart the app and grant permission when prompted
```

### High CPU Usage
**Causes:**
- Transcription is CPU-intensive by design
- GPU not properly detected or utilized
- Audio buffering set too aggressively

**Solutions:**
1. Enable GPU acceleration if available
2. Reduce buffer chunk size (Settings → Audio)
3. Use a faster model: `base.en` instead of `small.en`

### Text Not Appearing in Overlay
**Check:**
1. Recording is actually started (look for red indicator)
2. Audio is being captured (check audio levels)
3. Overlay window is in focus (not minimized)
4. Whisper model is properly loaded

**Fix:**
```bash
npm run dev  # See detailed logs
```

---

## 📝 File Formats Reference

### SRT Format
Standard SubRip format for video subtitles. Compatible with:
- Adobe Premiere Pro
- Final Cut Pro
- DaVinci Resolve
- VLC Media Player
- Most video editing software

### JSON Format
Structured data format with metadata:
```json
{
  "timestamp": "ISO 8601 datetime",
  "model": "base.en",
  "language": "en",
  "segments": [
    {
      "id": 1,
      "start": 1000,        // milliseconds
      "end": 4500,
      "text": "...",
      "confidence": 0.95    // 0-1 scale
    }
  ]
}
```

### Text Format
Plain text with optional timestamps:
```
[00:00:01] First sentence here.
[00:00:04] Second sentence here.
```

---

## 🔒 Privacy & Security

- **Local Processing**: All audio processing happens locally on your machine
- **No Cloud Storage**: Transcripts are never sent to external servers
- **No Telemetry**: Application doesn't track usage or collect data
- **Open Source Ready**: Architecture supports open-source Whisper models
- **Secure IPC**: Electron context isolation prevents renderer access to system

---

## 💻 Developer Information

### Building for Your Platform

```bash
# macOS
npm run dist  # Builds .dmg installer

# Windows
npm run dist  # Builds .exe installer

# Linux
npm run dist  # Builds AppImage
```

### Architecture Overview

The application uses a **multi-process architecture**:

```
┌─ Main Process ─────────────────────┐
│ • Window management                 │
│ • IPC coordination                  │
│ • Audio capture & processing        │
│ • File I/O & export                 │
└──────────────────────────────────────┘
        ↓                      ↓
   ┌─ Overlay ─┐         ┌─ Control ─┐
   │ Renderer  │         │ Renderer  │
   └───────────┘         └───────────┘
```

### IPC Events Reference

**From Overlay to Main:**
- `transcription:start` - Begin recording
- `transcription:stop` - End recording
- `transcription:pause` - Pause recording
- `transcript:save` - Export transcript
- `settings:update` - Change configuration

**From Main to Overlay:**
- `transcription:data` - New transcript text
- `audio:level` - Audio input level update
- `recording:status` - Recording state change
- `error:notification` - Error message

---

## 📚 Additional Resources

- **Developer Guide**: See `CLAUDE.md` for architecture details
- **Implementation Plan**: See `docs/plan.md` for development roadmap
- **Whisper Documentation**: https://github.com/openai/whisper
- **Electron Docs**: https://www.electronjs.org/docs

---

## 📄 License

This project is licensed under the ISC License. See LICENSE file for details.

---

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. Code follows existing style guidelines
2. New features include documentation
3. Changes are tested on target platforms
4. Commit messages are clear and descriptive
5. Update relevant documentation

---

## 🆘 Support & Issues

Found a bug? Have a feature request?

1. Check existing issues on GitHub
2. Enable detailed logging: `npm run dev`
3. Include system information (OS, Node version, RAM)
4. Provide steps to reproduce the issue

---

## 🎉 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Uses [OpenAI Whisper](https://github.com/openai/whisper)
- Audio processing with [node-record-lpcm16](https://github.com/gillesdemey/node-record-lpcm16)
- Powered by the Node.js community

---

**Last Updated**: October 21, 2025
**Version**: 1.0.0
**Status**: Active Development
