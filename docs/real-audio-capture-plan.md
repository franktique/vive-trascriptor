# Real-Time Audio Capture Implementation Plan

## Overview

This document outlines the implementation strategy for replacing the mock transcription system with real-time audio capture and Whisper integration in the Whisper Transcriber application.

## Current State Analysis

### ✅ Completed Infrastructure
- Transparent overlay window with transcript display
- Control panel with recording controls
- IPC communication system between processes
- Mock transcription system demonstrating data flow
- SRT file generation with proper timestamps
- Settings persistence and window state management

### 🎯 Target Implementation
Replace `simulateTranscription()` in `src/renderer/overlay.js` with real audio capture pipeline that feeds into Whisper processing.

## Library Selection & Research Findings

### Audio Capture Library Comparison

#### Option 1: `node-record-lpcm16-v2` (RECOMMENDED)
- **Status**: Active fork of original library (updated for 2024-2025)
- **Pros**: Modern codebase, Electron compatibility, 16-bit PCM output
- **Cons**: Requires SoX installation
- **Compatibility**: Works on macOS, potential Windows issues

#### Option 2: `node-audiorecorder` 
- **Status**: Alternative based on node-record-lpcm16
- **Pros**: Similar functionality, some Electron examples
- **Cons**: Also requires SoX, less active development

#### Option 3: Native Web Audio API
- **Status**: Browser-native solution
- **Pros**: No external dependencies, built-in support
- **Cons**: More complex implementation, requires manual PCM conversion

### Whisper Integration Analysis

#### `nodejs-whisper` Package
- **Version**: 0.2.9 (3 months old, actively maintained)
- **Limitation**: No native streaming support
- **Solution**: Implement chunked processing approach
- **Performance**: CPU-based processing, suitable for real-time with proper chunking

## Technical Architecture Design

### Audio Processing Pipeline

```
Microphone Input
       ↓
Audio Capture (Main Process)
       ↓
Circular Buffer (1-3 second chunks)
       ↓
Audio Preprocessing (format conversion)
       ↓
Whisper Processing Queue
       ↓
Transcript Results
       ↓
IPC to Renderer Process
       ↓
UI Update & SRT Generation
```

### Process Architecture

#### Main Process (`src/main/main.js`)
- **Audio Manager**: Handle microphone access and recording
- **Buffer Manager**: Manage circular buffer for continuous audio
- **Whisper Processor**: Queue and process audio chunks
- **IPC Handlers**: Send results to renderer processes

#### Renderer Process (`src/renderer/overlay.js`)
- **Remove**: `simulateTranscription()` method
- **Replace**: Real-time data handlers for audio processing results
- **Enhance**: Error handling for audio processing failures

## Implementation Steps

### Phase 1: Audio Capture System Setup

#### Step 1.1: Dependencies Installation
```bash
npm install node-record-lpcm16-v2
# Alternative: npm install node-audiorecorder
```

#### Step 1.2: Create Audio Manager (`src/main/audioManager.js`)
```javascript
// Core functionality:
- Initialize audio recording with proper settings
- Handle platform-specific microphone access
- Manage recording state (start/stop/pause)
- Emit audio data events to main process
```

#### Step 1.3: Audio Configuration
- **Sample Rate**: 16kHz (Whisper requirement)
- **Bit Depth**: 16-bit signed integer
- **Format**: Linear PCM
- **Channels**: Mono (single channel)
- **Chunk Size**: 1-3 seconds (configurable)

### Phase 2: Buffer Management System

#### Step 2.1: Circular Buffer Implementation
```javascript
// Features needed:
- Continuous audio stream buffering
- Configurable buffer size (5-10 seconds total)
- Overlap handling for better accuracy
- Memory-efficient circular buffer
```

#### Step 2.2: Chunk Processing Strategy
- **Fixed-size chunks**: 2-second segments with 0.5-second overlap
- **Voice Activity Detection (VAD)**: Future enhancement
- **Queue management**: FIFO processing with backpressure handling

### Phase 3: Whisper Integration

#### Step 3.1: Whisper Processor (`src/main/whisperProcessor.js`)
```javascript
// Core responsibilities:
- Queue management for audio chunks
- nodejs-whisper integration
- Result formatting and confidence scoring
- Error handling and recovery
```

#### Step 3.2: Processing Configuration
- **Model Selection**: Base model initially (balanced speed/accuracy)
- **Language**: English (configurable)
- **Output Format**: Text with timestamps and confidence
- **Parallel Processing**: Single queue to avoid resource conflicts

### Phase 4: IPC Integration

#### Step 4.1: Enhanced IPC Handlers
```javascript
// New handlers in main.js:
- 'audio-transcription-start'
- 'audio-transcription-stop' 
- 'audio-transcription-pause'
- 'audio-level-update'
- 'whisper-model-change'
```

#### Step 4.2: Event System
```javascript
// Events to renderer:
- 'transcription-data' (partial and final results)
- 'transcription-error' (processing errors)
- 'audio-level' (real-time audio meter)
- 'transcription-status' (state changes)
```

### Phase 5: UI Updates

#### Step 5.1: Remove Mock System
- Delete `simulateTranscription()` from `overlay.js`
- Remove simulation-related intervals and timeouts

#### Step 5.2: Enhance Real-time Display
```javascript
// Improvements needed:
- Handle partial transcription results
- Implement proper text streaming
- Add processing state indicators
- Show real-time audio levels
```

## Error Handling Strategy

### Audio Capture Errors
- **Microphone Permission Denied**: Show clear user instructions
- **Device Not Found**: Enumerate available devices, fallback options
- **Recording Failure**: Automatic retry with exponential backoff
- **SoX Not Found**: Clear installation instructions for users

### Whisper Processing Errors
- **Model Loading Failure**: Fallback to lighter models
- **Processing Timeout**: Skip chunk and continue with next
- **Memory Issues**: Reduce chunk size or queue length
- **Transcription Failures**: Log error, continue processing

### System Resource Management
- **CPU Usage**: Monitor and throttle if needed
- **Memory Usage**: Implement buffer limits and cleanup
- **Queue Overflow**: Drop oldest chunks when queue full

## Performance Optimization

### Audio Processing
- **Chunk Size Tuning**: Balance latency vs accuracy (1-3 seconds)
- **Sample Rate Optimization**: 16kHz for Whisper compatibility
- **Buffer Management**: Efficient circular buffer implementation
- **Memory Cleanup**: Regular garbage collection of processed chunks

### Whisper Processing
- **Model Selection**: User configurable (tiny/base/small/medium)
- **Parallel Processing**: Single worker to avoid conflicts
- **Result Caching**: Cache recent results to avoid reprocessing
- **Progressive Enhancement**: Start with base model, allow upgrades

## Testing Strategy

### Unit Testing
- **Audio Capture**: Mock microphone input with test audio files
- **Buffer Management**: Test circular buffer edge cases
- **Whisper Integration**: Test with known audio samples
- **IPC Communication**: Mock IPC calls and verify responses

### Integration Testing
- **End-to-End Flow**: Complete audio → transcription → display
- **Error Scenarios**: Test all failure modes and recovery
- **Performance Testing**: Long recording sessions (30+ minutes)
- **Cross-Platform**: macOS, Windows compatibility

### User Testing
- **Audio Quality**: Various microphone types and qualities
- **Accent Support**: Different English accents and speaking styles
- **Environmental Noise**: Background noise handling
- **Real-world Usage**: Actual meeting/lecture transcription

## Configuration Options

### Audio Settings (Control Panel)
```javascript
{
  microphone: 'default|specific-device-id',
  sensitivity: 0.1-1.0,
  chunkSize: 1-5 // seconds
  noiseReduction: boolean,
  autoGainControl: boolean
}
```

### Whisper Settings
```javascript
{
  model: 'tiny|base|small|medium',
  language: 'en|auto-detect',
  confidence_threshold: 0.0-1.0,
  max_queue_size: 5-20 // chunks
}
```

## File Structure Changes

### New Files to Create
```
src/main/
├── audioManager.js      # Audio capture and recording
├── whisperProcessor.js  # Whisper integration and processing
├── bufferManager.js     # Circular buffer management
└── deviceManager.js     # Audio device enumeration

src/utils/
├── audioUtils.js        # Audio format conversion utilities
└── vadUtils.js          # Voice activity detection (future)
```

### Files to Modify
```
src/main/main.js         # Add new IPC handlers and managers
src/renderer/overlay.js  # Remove mock, add real audio handlers
src/renderer/controls.js # Add real audio device selection
```

## Implementation Timeline

### Week 1: Foundation
- Install and configure node-record-lpcm16-v2
- Create basic audioManager.js
- Implement simple audio capture
- Test microphone access and permissions

### Week 2: Processing Pipeline
- Implement bufferManager.js
- Create whisperProcessor.js
- Basic chunked processing
- IPC integration for audio data

### Week 3: Integration & Testing
- Replace mock transcription system
- Integrate real-time UI updates
- Performance optimization
- Error handling implementation

### Week 4: Polish & Testing
- Cross-platform testing
- Performance tuning
- User experience improvements
- Documentation updates

## Success Metrics

### Functional Requirements
- ✅ Real-time audio capture from microphone
- ✅ Continuous transcription with <3 second latency
- ✅ Proper SRT timestamp synchronization
- ✅ Stable operation for 30+ minute sessions

### Quality Requirements
- **Accuracy**: >90% for clear English speech
- **Latency**: <3 seconds from speech to display
- **Stability**: No crashes during normal operation
- **Resource Usage**: <100MB memory, <30% CPU on average

## Risk Mitigation

### High-Risk Items
1. **SoX Dependency**: Provide clear installation guide, consider alternatives
2. **Windows Compatibility**: Test extensively, provide troubleshooting
3. **Real-time Performance**: Profile and optimize, provide quality settings
4. **Audio Device Issues**: Robust device detection and fallback options

### Contingency Plans
- **Backup Audio Library**: Keep node-audiorecorder as fallback
- **Processing Fallback**: Cloud API integration if local processing fails
- **Quality Modes**: Multiple transcription quality/speed profiles
- **Offline Mode**: Ensure core functionality works without network

## Conclusion

This implementation plan provides a comprehensive roadmap for replacing the mock transcription system with real-time audio capture and Whisper processing. The modular approach allows for incremental development and testing, while the robust error handling ensures a stable user experience.

The key to success will be balancing real-time performance with transcription accuracy through proper chunk sizing, buffer management, and user-configurable quality settings.