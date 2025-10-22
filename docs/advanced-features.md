# Advanced Features Documentation

This document provides in-depth information about the advanced audio processing and AI features available in the Whisper Transcriber application.

---

## Table of Contents

1. [Audio Processing Pipeline](#audio-processing-pipeline)
2. [GPU Acceleration](#gpu-acceleration)
3. [Multilingual Support](#multilingual-support)
4. [Punctuation & Capitalization](#punctuation--capitalization)
5. [Experimental AI Features](#experimental-ai-features)
6. [Performance Tuning](#performance-tuning)
7. [Configuration Reference](#configuration-reference)

---

## Audio Processing Pipeline

### Overview

The audio processing pipeline transforms raw microphone input into high-quality transcriptions through a series of specialized processing stages.

```
Microphone Input
     ↓
┌─────────────────────────────┐
│   AudioManager              │
│   • Capture raw PCM data    │
│   • Manage recording state  │
└─────────────────────────────┘
     ↓
┌─────────────────────────────┐
│   BufferManager             │
│   • Audio buffering         │
│   • Preprocessing           │
│   • Silence detection       │
│   • Chunk generation        │
└─────────────────────────────┘
     ↓
┌─────────────────────────────┐
│   WhisperProcessor          │
│   • Transcription           │
│   • Model management        │
│   • Post-processing         │
└─────────────────────────────┘
     ↓
Formatted Transcript
```

### Audio Manager

**File**: `src/main/audioManager.js`

The AudioManager handles raw microphone input capture with configurable settings.

#### Configuration Options

```javascript
{
  "recorder": "sox",              // Audio recorder backend (sox or ffmpeg)
  "sampleRate": 16000,            // Hz - Must be 16kHz for Whisper
  "channels": 1,                  // Mono (1) or Stereo (2)
  "audioType": "wav",             // WAV format (standard for Whisper)
  "threshold": 0.5,               // Voice detection threshold (0-1)
  "silence": "1.0",               // Silence duration in seconds
  "device": null                  // null = default device, or device ID
}
```

#### Key Methods

- `initialize()` - Verify recording capability and dependencies
- `start()` - Begin microphone capture
- `stop()` - End recording session
- `getAudioLevel()` - Get current input level (0-1)
- `setDevice(deviceId)` - Switch input device
- `listDevices()` - Enumerate available microphones

#### Events Emitted

- `initialized` - Audio system ready
- `recording-started` - Microphone began capturing
- `recording-stopped` - Microphone stopped
- `audio-data` - New audio chunk available
- `error` - Error occurred

#### Platform-Specific Considerations

**macOS**
- Uses Core Audio backend via SoX
- Requires microphone permission in System Preferences
- Automatic fallback if SoX not installed

**Windows**
- WASAPI audio capture
- Windows Audio Session API for device enumeration
- Direct audio access, no additional permissions needed

**Linux**
- ALSA (Advanced Linux Sound Architecture)
- PulseAudio support
- May require ALSA configuration

---

### Buffer Manager

**File**: `src/main/bufferManager.js`

The BufferManager is the intelligence center of audio processing. It handles sophisticated audio chunking, preprocessing, and analysis.

#### Key Features

##### 1. Circular Buffering
```
┌─ Audio Buffer ─────────────────────────┐
│ [....existing audio chunks....]        │
│                            ↑            │
│                      write pointer      │
└────────────────────────────────────────┘
```

- Efficient memory usage
- Continuous stream handling
- Configurable maximum size

##### 2. Audio Chunking
Creates overlapping chunks for seamless transcription:

```
Timeline:  [Chunk 1]
                  [Chunk 2 with 0.5s overlap]
                           [Chunk 3 with 0.5s overlap]
```

**Configuration**:
- `chunkDurationMs`: Duration of each chunk (default: 2000ms)
- `overlapMs`: Overlap between chunks (default: 500ms)
- Larger chunks = better accuracy, higher latency
- Smaller chunks = lower latency, might miss context

##### 3. Voice Activity Detection (VAD)

**Dual-Method Approach**:

**Energy-Based Detection**
- Measures RMS (root mean square) energy
- Compares against threshold (-40dB default)
- Fast computation
- Effective for moderate noise levels

**Zero-Crossing Rate (ZCR) Analysis**
- Counts signal level crossings
- Complements energy detection
- Distinguishes silence from noise
- More robust to background noise

**Configuration**:
```javascript
{
  "enableAdvancedVAD": true,
  "vadEnergyThreshold": -35,      // dB (RMS threshold)
  "vadZcrThreshold": 0.1,         // 0-1 scale
  "vadFrameSize": 512,            // Samples per analysis frame
  "silenceDurationMs": 300        // Minimum silence duration
}
```

##### 4. Audio Normalization

Maintains consistent audio levels across different microphones:

```
Before:  ▂▃▄█▆ (inconsistent peaks)
After:   ▃▄▅█▅ (normalized)
```

**Configuration**:
```javascript
{
  "enableNormalization": true,
  "normalizationTarget": -20      // Target peak dB level
}
```

**Benefits**:
- Consistent transcription quality
- Better Whisper model input
- Reduced sensitivity to volume changes

##### 5. High-Pass Filtering

Removes low-frequency noise (rumble, HVAC, traffic):

```
Frequency Response (Hz):
┌─────────────────────────────┐
│  ▁▂▃▄▅ cutoff (300Hz) ████  │ Speech optimized
│  ▂▃▄ Filtered    ▅▆▇█████  │
└─────────────────────────────┘
  0    300         8000   16000
```

**Configuration**:
```javascript
{
  "enableHighPassFilter": true,
  "highPassCutoffHz": 300        // Frequencies below this removed
}
```

**Typical Settings**:
- Office environment: 300Hz (default)
- Outdoor/noisy: 500Hz (higher cutoff)
- Controlled environment: 100Hz (lower cutoff)

##### 6. Automatic Gain Control (AGC)

Dynamically adjusts microphone gain for consistent levels:

```
Input Levels:          Gain Adjusted:
Quiet: ▂▃▃ → +12dB → ▅▆▆
Normal: ▅▆▇ → 0dB  → ▅▆▇
Loud: ▇█▉ → -6dB  → ▅▆▇
```

**Configuration**:
```javascript
{
  "enableAGC": true,
  "agcTargetLevel": -20,          // Target RMS level (dB)
  "agcAttackTime": 0.01,          // Response time to increase (seconds)
  "agcReleaseTime": 0.1           // Response time to decrease (seconds)
}
```

**Use Cases**:
- Variable volume speakers
- Multiple participant conversations
- Outdoor recording with wind/traffic

#### Buffer Manager Configuration Reference

```javascript
{
  // Chunk settings
  "chunkDurationMs": 2000,         // 2 seconds
  "overlapMs": 500,                // 0.5 second overlap
  "maxBufferSize": 10485760,       // 10MB maximum

  // Audio settings
  "sampleRate": 16000,             // 16kHz (Whisper requirement)
  "bytesPerSample": 2,             // 16-bit audio

  // Maintenance
  "cleanupInterval": 30000,        // Cleanup old data every 30s

  // Normalization
  "enableNormalization": true,
  "normalizationTarget": -20,      // Peak dB

  // Silence detection
  "enableSilenceDetection": true,
  "silenceThreshold": -40,         // RMS dB
  "silenceDurationMs": 300,        // Min silence duration

  // Advanced VAD
  "enableAdvancedVAD": true,
  "vadEnergyThreshold": -35,
  "vadZcrThreshold": 0.1,
  "vadFrameSize": 512,

  // High-pass filter
  "enableHighPassFilter": true,
  "highPassCutoffHz": 300,

  // AGC
  "enableAGC": true,
  "agcTargetLevel": -20,
  "agcAttackTime": 0.01,
  "agcReleaseTime": 0.1
}
```

---

## GPU Acceleration

### GPU Detector

**File**: `src/main/gpuDetector.js`

Automatically detects available GPU resources and provides optimization recommendations.

### Supported GPU Platforms

#### NVIDIA CUDA
- **Models**: Tesla, GeForce RTX, GeForce GTX series
- **Required**: CUDA Toolkit 11.0+, cuDNN 8.0+
- **Benefit**: 3-5x faster transcription
- **Detection**: Looks for `nvidia-smi` command
- **Memory**: Allocates up to GPU memory available

```bash
# Check NVIDIA GPU availability
nvidia-smi

# Output:
# GPU 0: RTX 3070 with 8GB memory
# Recommended batch size: 4
```

#### AMD Radeon
- **Models**: Radeon RX series
- **Required**: AMD Radeon drivers
- **Benefit**: GPU-accelerated computation
- **Detection**: rocm-smi command
- **Alternative**: HIP (Heterogeneous-compute Interface for Portability)

#### Apple Metal (macOS)
- **Models**: M1, M2, M3, M3 Pro/Max
- **Benefit**: Native GPU acceleration
- **Automatic**: No setup needed on Apple Silicon
- **Performance**: Excellent for base/small models

#### Vulkan
- **Cross-platform**: Windows, Linux, macOS
- **Use Case**: Fallback for unsupported GPUs
- **Performance**: Lower than native implementations

### GPU Detection Results

The application logs GPU information on startup:

```
[GPU Detector] Platform: darwin (macOS)
[GPU Detector] CPU Cores: 8
[GPU Detector] Total Memory: 16GB
[GPU Detector] NVIDIA GPU: Not detected
[GPU Detector] AMD GPU: Not detected
[GPU Detector] Metal (macOS): Supported ✓
[GPU Detector] Vulkan: Not available
[GPU Detector] Recommended: Use Metal acceleration
[GPU Detector] Batch Size: 2
```

### GPU Configuration

```javascript
{
  "enableGPU": true,
  "preferredGPU": "auto",         // auto, cuda, amd, metal, vulkan
  "gpuMemoryLimit": 4096,         // MB (0 = unlimited)
  "batchSize": 2,                 // Concurrent processing
  "enableMixedPrecision": true    // FP16/FP32 mixed for speed
}
```

### Performance Impact

**Transcription Speed** (relative to CPU):
- NVIDIA CUDA: **3-5x faster**
- AMD Radeon: **2-4x faster**
- Apple Metal: **2-3x faster**
- Vulkan: **1.5-2x faster**

**Memory Usage**:
- CPU Processing: ~2GB per chunk
- GPU Processing: Shared with system RAM

### Fallback Behavior

If GPU initialization fails:
1. Logs warning message
2. Falls back to CPU processing
3. Application continues normally
4. No user intervention required

---

## Multilingual Support

### Language Detector

**File**: `src/main/languageDetector.js`

Provides automatic language detection and switching for 15+ languages.

### Supported Languages

```
English    (en) - ✅ Optimized (base.en model)
Spanish    (es) - ✅ Supported
French     (fr) - ✅ Supported
German     (de) - ✅ Supported
Italian    (it) - ✅ Supported
Portuguese (pt) - ✅ Supported
Dutch      (nl) - ✅ Supported
Russian    (ru) - ✅ Supported
Polish     (pl) - ✅ Supported
Turkish    (tr) - ✅ Supported
Arabic     (ar) - ✅ Supported
Chinese    (zh) - ✅ Supported
Japanese   (ja) - ✅ Supported
Korean     (ko) - ✅ Supported
Hindi      (hi) - ✅ Supported
```

### Detection Methods

#### 1. Automatic Language Detection

Uses multilingual Whisper models to detect language:

```
Input Audio: [captures speech]
         ↓
Analysis: Compare against language patterns
         ↓
Result: "Detected Language: Spanish (es)"
```

**Configuration**:
```javascript
{
  "enableAutoDetect": true,
  "defaultLanguage": "en",
  "enableMultilingual": true
}
```

#### 2. Pattern-Based Detection

Falls back to common word patterns:

```javascript
// Example: English pattern matching
const patterns = ['the', 'be', 'to', 'of', 'and', ...];
// Counts occurrences in text
// Matches to most likely language
```

#### 3. Manual Language Selection

Set specific language for optimal accuracy:

```javascript
{
  "language": "fr",               // Force French transcription
  "enableAutoDetect": false       // Disable auto-detection
}
```

### Model Selection by Language

Different Whisper models work best for different languages:

**English-Specific** (Recommended for English):
- `base.en` - Fast, accurate for English
- `small.en` - Smaller, slightly less accurate
- `medium.en` - More accurate, slower

**Multilingual** (For non-English):
- `base` - Works for all 99 languages
- `small` - Smaller, multilingual
- `medium` - More accurate, slower

**Automatic Model Selection**:

```javascript
const modelMap = {
  'en': 'base.en',    // Use English-optimized
  'es': 'base',       // Use multilingual
  'fr': 'base',
  'de': 'base',
  // ... etc
}
```

### Language Switching

The application automatically switches models when language changes:

```
Current: English (base.en)
         ↓
User changes to: Spanish
         ↓
Action: Unload base.en, load base (multilingual)
         ↓
Resume transcription in Spanish
```

**No Loss of Transcript**: Previous transcript maintained when switching languages.

### Configuration Reference

```javascript
{
  // Language settings
  "language": "auto",             // auto, en, es, fr, etc.
  "enableAutoDetect": true,
  "defaultLanguage": "en",
  "enableMultilingual": true,

  // Model settings
  "whisperModel": "base.en",
  "autoSelectModel": true,        // Automatically pick best model

  // Dialect handling
  "treatVariants": true,          // Treat en-US, en-GB same as en
  "preserveAccents": false        // Keep accent marks in output
}
```

---

## Punctuation & Capitalization

### Punctuation Processor

**File**: `src/main/punctuationProcessor.js`

Adds professional formatting (punctuation and capitalization) to raw Whisper output.

### Why It's Needed

Whisper transcribes audio but doesn't include punctuation:

```
Raw Output:
"hello world this is a test"

After Processing:
"Hello world. This is a test."
```

### Processing Methods

#### 1. Sentence Detection

Identifies sentence boundaries using:

**Sentence Starters**:
```javascript
// Words that typically start sentences
['the', 'a', 'an', 'i', 'you', 'he', 'she', 'what', 'how', ...]
```

**Sentence Terminators**:
```javascript
// Words that typically end sentences
['now', 'then', 'thanks', 'please', 'right', 'okay', ...]
```

#### 2. Capitalization

**First Word**: Always capitalized
**Proper Nouns**: Detected from common names database
**I**: Always capitalized (personal pronoun)
**After Punctuation**: Next word capitalized

#### 3. Abbreviation Preservation

Maintains correct abbreviations:

```javascript
{
  'mr': 'Mr.',       // Mr.
  'mrs': 'Mrs.',     // Mrs.
  'dr': 'Dr.',       // Dr.
  'prof': 'Prof.',   // Prof.
  'etc': 'etc.',     // etc.
  'usa': 'USA',      // USA
  'uk': 'UK'         // UK
}
```

### Heuristic Rules

**Question Detection**:
- Patterns like "what", "how", "why", "do you" → add "?"

**Exclamation Detection**:
- Patterns like "wow", "amazing", "incredible" → add "!"

**List Detection**:
- Comma separation for series
- "and" before last item

**Quotation Handling**:
- Detects quoted speech
- Adds quotes around quoted text

### Configuration

```javascript
{
  "enablePunctuation": true,
  "enableCapitalization": true,
  "useHeuristics": true,          // Enable pattern matching

  // Advanced options
  "preserveEllipsis": false,      // Keep "..." when appropriate
  "addCommas": true,              // Add commas in lists
  "detectQuotes": true            // Detect and quote speech
}
```

### Examples

**Input** (raw Whisper):
```
hello my name is john and i work for acme corporation
we specialize in widgets widgets and more widgets
what do you think about our products
```

**Output** (with punctuation):
```
Hello, my name is John and I work for ACME Corporation.
We specialize in widgets, widgets, and more widgets.
What do you think about our products?
```

---

## Experimental AI Features

These advanced features are currently experimental and under development. Use with caution in production.

### Speaker Diarization

**File**: `src/main/speakerDiarizer.js`
**Status**: 🔧 Experimental

Identifies and labels different speakers in multi-speaker recordings.

#### Configuration

```javascript
{
  "enableSpeakerDiarization": false,  // Disabled by default
  "maxSpeakers": 4,                   // Maximum speakers to detect
  "minSpeakerDuration": 3000,         // Minimum 3s per speaker
  "speakerThreshold": 0.7             // Confidence threshold 0-1
}
```

#### Output Format

```
[Speaker 1 - 00:00:01]: "Hello, how are you?"
[Speaker 2 - 00:00:03]: "I'm doing well, thanks for asking."
[Speaker 1 - 00:00:05]: "That's great to hear."
```

#### Use Cases

- Interview transcription
- Meeting recordings
- Podcast episodes
- Focus group discussions

#### Known Limitations

- Requires clear audio separation between speakers
- Performance degrades with more than 4 speakers
- May struggle with overlapping speech
- Accuracy depends on speaker distinctiveness

### Grammar Correction

**File**: `src/main/grammarCorrector.js`
**Status**: 🔧 Experimental

Automatically corrects grammatical errors and improves sentence structure.

#### Configuration

```javascript
{
  "enableGrammarCorrection": false,   // Disabled by default
  "correctionLevel": "moderate",      // light, moderate, aggressive
  "preserveStyle": true,              // Keep original voice/style
  "reportChanges": true               // Log all corrections
}
```

#### Correction Types

- Subject-verb agreement
- Tense consistency
- Article usage (a/an/the)
- Preposition selection
- Fragment/run-on sentence fixing

#### Example

**Input**:
```
"I has three apple in the table. They is very red."
```

**Output** (moderate level):
```
"I have three apples on the table. They are very red."
```

#### Known Limitations

- May overcorrect informal speech
- Struggles with intentional dialect
- Can change intended meaning
- Performance varies by text length

### Vocabulary Manager

**File**: `src/main/vocabularyManager.js`
**Status**: 🔧 Experimental

Maintains custom dictionary for domain-specific terms.

#### Configuration

```javascript
{
  "enableVocabularyManager": false,   // Disabled by default
  "vocabularyFile": "./custom_vocab.json",
  "priority": "custom",               // custom or standard
  "enableAutolearn": true             // Learn new terms
}
```

#### Vocabulary File Format

```json
{
  "medical": {
    "rx": "prescription",
    "bp": "blood pressure",
    "ekg": "electrocardiogram"
  },
  "technical": {
    "api": "Application Programming Interface",
    "cpu": "Central Processing Unit",
    "gpu": "Graphics Processing Unit"
  }
}
```

#### Use Cases

- Medical transcription
- Legal document preparation
- Technical documentation
- Industry-specific terminology

#### Example

**Input**:
```
"Patient has high BP and needs an ekg."
```

**Output** (with medical vocabulary):
```
"Patient has high blood pressure and needs an electrocardiogram."
```

### Emotion Analysis

**File**: `src/main/emotionAnalyzer.js`
**Status**: 🔧 Experimental

Detects emotional tone in speech patterns.

#### Configuration

```javascript
{
  "enableEmotionAnalysis": false,     // Disabled by default
  "emotionCategories": [
    "positive",
    "negative",
    "neutral",
    "excited",
    "sad",
    "angry"
  ],
  "confidenceThreshold": 0.6
}
```

#### Detected Emotions

- **Positive**: Happy, satisfied, content
- **Negative**: Upset, frustrated, disappointed
- **Neutral**: Informative, matter-of-fact
- **Excited**: Enthusiastic, energetic
- **Sad**: Sorrowful, dejected
- **Angry**: Frustrated, irritated

#### Output Format

```json
{
  "text": "That's amazing news!",
  "emotion": "excited",
  "confidence": 0.92,
  "timestamp": "00:00:15",
  "emotionScores": {
    "positive": 0.92,
    "excited": 0.88,
    "neutral": 0.15,
    "negative": 0.05
  }
}
```

#### Use Cases

- Customer service analysis
- Content sentiment tracking
- Engagement measurement
- Therapy session notes

#### Known Limitations

- Works best with clear emotion expression
- Cultural differences in emotional expression
- Struggles with sarcasm
- Requires training data tuning

---

## Performance Tuning

### Optimization Strategies

#### For Real-Time Performance

```javascript
{
  // Smaller model for speed
  "whisperModel": "base.en",

  // Smaller chunks for lower latency
  "chunkDurationMs": 1000,        // 1 second instead of 2
  "overlapMs": 250,               // 0.25s overlap

  // Disable heavy processing
  "enablePunctuation": false,
  "enableAdvancedVAD": false,
  "enableGrammarCorrection": false,

  // Enable GPU if available
  "enableGPU": true,
  "maxParallelChunks": 2
}
```

**Result**: Lower latency, slight accuracy reduction

#### For Maximum Accuracy

```javascript
{
  // Larger model
  "whisperModel": "medium.en",

  // Larger chunks for context
  "chunkDurationMs": 3000,        // 3 seconds
  "overlapMs": 1000,              // 1s overlap

  // Enable all processing
  "enablePunctuation": true,
  "enableAdvancedVAD": true,
  "enableCapitalization": true,

  // Use GPU
  "enableGPU": true
}
```

**Result**: Higher accuracy, higher latency (~3-5 seconds)

#### Balanced Configuration

```javascript
{
  "whisperModel": "base.en",
  "chunkDurationMs": 2000,
  "overlapMs": 500,
  "enablePunctuation": true,
  "enableAdvancedVAD": true,
  "enableGPU": true,
  "maxParallelChunks": 1
}
```

**Result**: Moderate latency (~1-2s), good accuracy

### Memory Management

**Monitoring Memory Usage**:

```bash
# Development mode shows memory stats
npm run dev

# Check app memory in Activity Monitor
```

**Optimization Tips**:
- Close other applications
- Reduce buffer size: `maxBufferSize: 5242880` (5MB instead of 10MB)
- Disable parallel processing: `maxParallelChunks: 1`
- Use model caching: `enableModelCache: true`

### CPU Usage Reduction

1. **Use GPU acceleration** (3-5x faster)
2. **Reduce audio processing**: Disable VAD, normalization
3. **Smaller model**: `base.en` vs `medium.en`
4. **Larger chunks**: Process less frequently

---

## Configuration Reference

### Complete Settings JSON

```javascript
{
  // Application
  "appVersion": "1.0.0",
  "logLevel": "info",             // debug, info, warn, error

  // Window Settings
  "overlayOpacity": 0.85,
  "overlayPosition": { "x": 100, "y": 100 },
  "overlaySize": { "width": 1000, "height": 600 },
  "overlayMinimized": false,

  // Audio Input Settings
  "audioDevice": null,            // null = default
  "audioSampleRate": 16000,
  "audioChannels": 1,
  "audioThreshold": 0.5,

  // AudioManager settings
  "audioRecorder": "sox",
  "audioSilence": "1.0",

  // BufferManager settings
  "chunkDurationMs": 2000,
  "overlapMs": 500,
  "maxBufferSize": 10485760,      // 10MB
  "cleanupInterval": 30000,

  // Audio Processing
  "enableNormalization": true,
  "normalizationTarget": -20,
  "enableSilenceDetection": true,
  "silenceThreshold": -40,
  "silenceDurationMs": 300,

  // Advanced VAD
  "enableAdvancedVAD": true,
  "vadEnergyThreshold": -35,
  "vadZcrThreshold": 0.1,
  "vadFrameSize": 512,

  // High-Pass Filter
  "enableHighPassFilter": true,
  "highPassCutoffHz": 300,

  // AGC Settings
  "enableAGC": true,
  "agcTargetLevel": -20,
  "agcAttackTime": 0.01,
  "agcReleaseTime": 0.1,

  // Whisper Settings
  "whisperModel": "base.en",
  "whisperLanguage": "en",
  "whisperTemperature": 0.0,
  "whisperTranslate": false,
  "enableModelCache": true,
  "modelCacheTimeout": 1800000,   // 30 minutes
  "enableParallelProcessing": true,
  "maxParallelChunks": 2,

  // Post-Processing
  "enablePunctuation": true,
  "enableCapitalization": true,
  "preserveStyle": true,

  // GPU Settings
  "enableGPU": true,
  "preferredGPU": "auto",

  // Multilingual
  "language": "auto",
  "enableAutoDetect": true,
  "enableMultilingual": true,

  // Experimental Features
  "enableSpeakerDiarization": false,
  "enableGrammarCorrection": false,
  "enableVocabularyManager": false,
  "enableEmotionAnalysis": false
}
```

---

## Troubleshooting Advanced Features

### GPU Not Being Detected

**Check**:
```bash
npm run dev  # Look for GPU detection messages
```

**Solution**:
1. Update graphics drivers
2. Verify CUDA/Metal/Vulkan installation
3. Restart application
4. Falls back to CPU automatically

### Audio Processing Not Working

**Check**:
1. Audio input levels in control panel
2. Verify microphone is selected correctly
3. Check `silenceDuration` isn't too long

**Reset**:
```bash
rm ~/Library/Application\ Support/Whisper\ Transcriber/config.json
npm start
```

### High CPU Usage Despite GPU

**Solutions**:
1. Verify GPU actually enabled: `npm run dev`
2. Check system GPU memory isn't full
3. Reduce `maxParallelChunks`
4. Disable advanced features not needed

### Punctuation Seems Wrong

**Solutions**:
1. Disable punctuation: `"enablePunctuation": false`
2. Disable capitalization: `"enableCapitalization": false`
3. Use raw output without processing
4. File issue for specific patterns

### Language Detection Incorrect

**Solution**:
1. Set language manually: `"language": "es"` (don't auto-detect)
2. Verify audio quality is good
3. Use multilingual model: `"whisperModel": "base"`

---

## Performance Benchmarks

**Test System**: MacBook Pro M1, 16GB RAM

| Model | Speed | Accuracy | Memory | GPU |
|-------|-------|----------|--------|-----|
| base.en | Real-time | High | 1.5GB | Metal |
| small.en | 1.2x realtime | Very High | 2GB | Metal |
| medium.en | 2x realtime | Excellent | 3GB | Metal |

*Note: Actual performance varies by audio quality and system load.*

---

## Additional Resources

- **BufferManager Deep Dive**: See source code comments in `src/main/bufferManager.js`
- **WhisperProcessor Details**: See `src/main/whisperProcessor.js`
- **Whisper Official Docs**: https://github.com/openai/whisper
- **OpenAI Blog**: https://openai.com/blog/whisper/

---

**Last Updated**: October 21, 2025
**Status**: Active Development
