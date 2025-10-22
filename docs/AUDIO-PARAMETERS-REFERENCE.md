# Audio Parameters - Complete Reference

**Feature**: Audio Parameter Control Sliders
**Status**: ✅ Implementation Complete
**Last Updated**: October 22, 2025

---

## Parameter Overview

The audio parameter sliders allow precise fine-tuning of 7 critical parameters that directly impact transcription quality. Each parameter is color-coded by impact level and integrated with both the audio buffer processing and transcription engine.

---

## Parameter Specifications

### 1. Silence Threshold 🔴 CRITICAL
**Location**: Advanced Audio Processing > Silence Threshold
**Backend**: BufferManager
**Purpose**: Detect and skip audio chunks that are too quiet to contain meaningful speech

**Specification**:
```
Range:          -60 dB to -10 dB
Default:        -40 dB
Step:           2 dB increments
Unit:           Decibels (dB)
Type:           Numeric
Validation:     -60 ≤ value ≤ -10
```

**How It Works**:
- Audio chunks with amplitude below this threshold are considered silence
- Helps skip background noise and quiet periods
- Lower values (more negative) = more aggressive silence detection
- Higher values (less negative) = less aggressive silence detection

**Tuning Guidance**:
- **Too High** (-10 dB): May skip actual speech
- **Too Low** (-60 dB): May process too much background noise
- **Optimal**: Usually around -40 dB for typical office environment

**Impact on Performance**:
- Critical impact on detection sensitivity
- Affects buffer reprocessing when changed

---

### 2. Normalization Target 🔴 CRITICAL
**Location**: Advanced Audio Processing > Normalization Target
**Backend**: BufferManager
**Purpose**: Set the target audio level during preprocessing normalization

**Specification**:
```
Range:          -30 dB to -10 dB
Default:        -20 dB
Step:           1 dB increments
Unit:           Decibels (dB)
Type:           Numeric
Validation:     -30 ≤ value ≤ -10
```

**How It Works**:
- Audio is normalized to reach this target level
- Ensures consistent audio levels across recordings
- Helps with transcription accuracy by standardizing input
- Triggered when buffer is reprocessed

**Tuning Guidance**:
- **Too Low** (-30 dB): Audio may be too quiet, reducing accuracy
- **Too High** (-10 dB): Audio may clip or distort
- **Optimal**: Usually around -20 dB for balanced levels

**Impact on Performance**:
- Critical for audio preprocessing
- Triggers buffer reprocessing when changed
- Affects overall transcription accuracy

---

### 3. Confidence Threshold 🔴 CRITICAL
**Location**: Advanced Audio Processing > Confidence Threshold
**Backend**: WhisperProcessor
**Purpose**: Only display transcriptions with confidence above this threshold

**Specification**:
```
Range:          0.3 to 0.9
Default:        0.6
Step:           0.05 increments
Unit:           Percentage (0.0-1.0 scale)
Display:        Percentage (e.g., 60%)
Type:           Numeric (decimal)
Validation:     0.3 ≤ value ≤ 0.9
```

**How It Works**:
- Whisper model generates confidence scores (0.0-1.0)
- Only transcriptions above this threshold are displayed
- Filters out uncertain predictions
- Controls transcription quality vs. completeness tradeoff

**Tuning Guidance**:
- **Lower Values** (0.3-0.4): More transcriptions shown, may include errors
- **Higher Values** (0.8-0.9): Only very confident transcriptions, may miss some speech
- **Optimal**: Usually around 0.6 for balanced accuracy

**Impact on Performance**:
- Critical for output quality control
- Filters transcriptions at display time
- No impact on processing speed

**Common Use Cases**:
- **Casual Recording**: 0.4-0.5 (capture everything)
- **Standard Use**: 0.6-0.7 (balanced)
- **Formal Document**: 0.7-0.8 (high quality only)

---

### 4. High-Pass Filter Cutoff 🟡 MEDIUM
**Location**: Advanced Audio Processing > High-Pass Filter Cutoff
**Backend**: BufferManager
**Purpose**: Remove low-frequency noise and rumble

**Specification**:
```
Range:          100 Hz to 800 Hz
Default:        300 Hz
Step:           50 Hz increments
Unit:           Hertz (Hz)
Type:           Numeric (integer)
Validation:     100 ≤ value ≤ 800
```

**How It Works**:
- A high-pass filter removes frequencies below the cutoff
- Eliminates low-frequency noise (room rumble, HVAC, traffic)
- Preserves human speech (typically 80 Hz - 12 kHz)
- Applied during audio preprocessing

**Frequency Reference**:
```
100 Hz  → Aggressive filtering, may remove some deep voices
300 Hz  → Standard setting, removes most background noise
500 Hz  → Lighter filtering, preserves more bass
800 Hz  → Minimal filtering, only removes extreme lows
```

**Tuning Guidance**:
- **Too High**: May remove voice fundamentals from deep voices
- **Too Low**: May not effectively filter background noise
- **Optimal**: Usually 300-400 Hz for typical speech

**Audio Characteristics by Frequency**:
- 50-100 Hz: Room rumble, HVAC noise
- 100-200 Hz: Traffic noise, distant voices
- 200-500 Hz: Important voice information
- 500+ Hz: Consonants and clarity

**Impact on Performance**:
- Medium impact on audio quality
- Helps reduce background noise intelligibility

---

### 5. AGC Target Level 🟡 MEDIUM
**Location**: Advanced Audio Processing > AGC Target Level
**Backend**: BufferManager
**Purpose**: Set target level for Automatic Gain Control

**Specification**:
```
Range:          -30 dB to -10 dB
Default:        -20 dB
Step:           1 dB increments
Unit:           Decibels (dB)
Type:           Numeric
Validation:     -30 ≤ value ≤ -10
```

**How It Works**:
- Automatic Gain Control (AGC) dynamically adjusts volume
- Compressor/expander algorithm maintains consistent levels
- Adapts to changing input levels in real-time
- Prevents clipping (too loud) and inadequate gain (too quiet)

**Tuning Guidance**:
- **Lower Values** (-30 dB): Less aggressive gain adjustment
- **Higher Values** (-10 dB): More aggressive gain adjustment
- **Optimal**: Usually -20 dB for typical room conditions

**Use Cases**:
- **Quiet Environment**: -25 to -30 dB (gentle adjustment)
- **Variable Volume**: -20 dB (standard setting)
- **Loud Environment**: -15 to -10 dB (aggressive adjustment)

**Impact on Performance**:
- Medium impact on consistent volume levels
- Helps prevent audio clipping
- Improves transcription consistency

---

### 6. Max Parallel Chunks 🟡 MEDIUM
**Location**: Advanced Audio Processing > Max Parallel Chunks
**Backend**: WhisperProcessor
**Purpose**: Number of audio chunks to process simultaneously

**Specification**:
```
Range:          1 to 4
Default:        2
Step:           1 (integer only)
Unit:           Count (chunks)
Type:           Integer
Validation:     1 ≤ value ≤ 4
```

**How It Works**:
- Divides audio into chunks and processes multiple in parallel
- Higher values = faster processing (if hardware supports)
- Lower values = lower resource usage
- Trade-off between speed and system resources

**Parallel Processing Models**:
```
1 Chunk:  Sequential processing, minimal resources, slowest
2 Chunks: Balanced, moderate resources, good speed (default)
3 Chunks: Faster, higher resources, may slow system
4 Chunks: Fastest, maximum resources, potential system impact
```

**System Impact**:
- **Memory**: Increases with more parallel chunks
- **CPU**: Higher utilization with more chunks
- **Disk I/O**: Minimal impact
- **Temperature**: May increase with more chunks

**Tuning Guidance**:
- **Weak Hardware**: Keep at 1-2
- **Standard Hardware**: Use 2-3 (default is 2)
- **Powerful Hardware**: Can use 3-4
- **System Responsive**: Reduce if other apps sluggish

**Performance Trade-offs**:
```
Value   Speed    Memory  CPU  System Impact
1       Slowest  Low     Low  None
2       Good     Normal  Normal  Minimal (default)
3       Better   High    High  Noticeable
4       Fastest  High    High  Significant
```

---

### 7. VAD Energy Threshold 🟡 LOW-MEDIUM
**Location**: Advanced Audio Processing > VAD Energy Threshold
**Backend**: BufferManager
**Purpose**: Minimum energy level for Voice Activity Detection

**Specification**:
```
Range:          -40 dB to -20 dB
Default:        -35 dB
Step:           1 dB increments
Unit:           Decibels (dB)
Type:           Numeric
Validation:     -40 ≤ value ≤ -20
```

**How It Works**:
- Voice Activity Detection (VAD) detects presence of speech
- Distinguishes voice from silence and background noise
- Uses energy/power measurements
- Lower threshold = more sensitive detection

**Threshold Reference**:
```
-40 dB: Very sensitive, may detect subtle sounds
-35 dB: Balanced (default), good voice detection
-30 dB: Less sensitive, may miss quiet speech
-20 dB: Very insensitive, only loud speech detected
```

**Tuning Guidance**:
- **Noisy Environment**: Higher value (-25 to -20 dB)
- **Quiet Environment**: Lower value (-35 to -40 dB)
- **Optimal**: Usually -35 dB as standard balance

**Relationship to Silence Threshold**:
- **Silence Threshold**: Absolute level (what's considered silence)
- **VAD Energy Threshold**: Relative sensitivity (how to detect voice)
- Both work together for optimal detection

**Impact on Performance**:
- Low-Medium impact on detection accuracy
- Affects when recording starts/stops
- Influences buffer processing decisions

---

## Parameter Interaction Matrix

How parameters work together:

| Parameter Pair | Interaction | Notes |
|---|---|---|
| Silence ↔ VAD | Both detect voice activity | Work complementarily |
| Silence ↔ Normalization | Buffer reprocessing | Both trigger when changed |
| Filter Cutoff ↔ AGC | Audio preprocessing | Applied in sequence |
| Confidence ↔ Parallel Chunks | Transcription stage | Independent effects |
| AGC Target ↔ Confidence | Quality chain | Good AGC → better confidence |

---

## Recommended Presets

### Preset 1: Default (Balanced)
```
Silence Threshold:       -40 dB
Normalization Target:    -20 dB
Confidence Threshold:    0.6 (60%)
High-Pass Filter:        300 Hz
AGC Target Level:        -20 dB
Max Parallel Chunks:     2
VAD Energy Threshold:    -35 dB
```
**Use**: General purpose, office environments

### Preset 2: Quiet Office (Noise-Free)
```
Silence Threshold:       -50 dB
Normalization Target:    -22 dB
Confidence Threshold:    0.7 (70%)
High-Pass Filter:        200 Hz
AGC Target Level:        -25 dB
Max Parallel Chunks:     2
VAD Energy Threshold:    -40 dB
```
**Use**: Silent environments, dictation, meetings

### Preset 3: Noisy Environment
```
Silence Threshold:       -30 dB
Normalization Target:    -18 dB
Confidence Threshold:    0.5 (50%)
High-Pass Filter:        500 Hz
AGC Target Level:        -15 dB
Max Parallel Chunks:     3
VAD Energy Threshold:    -25 dB
```
**Use**: Cafes, offices with background noise

### Preset 4: Fast Processing
```
Silence Threshold:       -40 dB
Normalization Target:    -20 dB
Confidence Threshold:    0.6 (60%)
High-Pass Filter:        300 Hz
AGC Target Level:        -20 dB
Max Parallel Chunks:     4
VAD Energy Threshold:    -35 dB
```
**Use**: Real-time transcription, prioritize speed

### Preset 5: High Accuracy
```
Silence Threshold:       -45 dB
Normalization Target:    -22 dB
Confidence Threshold:    0.8 (80%)
High-Pass Filter:        250 Hz
AGC Target Level:        -22 dB
Max Parallel Chunks:     2
VAD Energy Threshold:    -37 dB
```
**Use**: Document transcription, formal records

---

## Monitoring & Adjustment Guide

### How to Know If Settings Are Optimal

#### Too Sensitive (detecting noise as speech)
- Indicators: Many false positives, transcribing background noise
- Adjust: Increase silence threshold, VAD threshold
- Alternative: Increase confidence threshold

#### Too Insensitive (missing actual speech)
- Indicators: Missing parts of speech, gaps in transcription
- Adjust: Decrease silence threshold, VAD threshold
- Alternative: Decrease confidence threshold

#### Audio Quality Issues
- **Clipping**: Reduce normalization target, AGC target
- **Too Quiet**: Increase normalization target, AGC target
- **Muffled**: Increase high-pass filter cutoff
- **Noisy**: Increase high-pass filter cutoff, reduce silence threshold

#### Transcription Quality Issues
- **Missing words**: Decrease confidence threshold
- **Too many errors**: Increase confidence threshold
- **Slow processing**: Increase parallel chunks
- **System sluggish**: Decrease parallel chunks

---

## Technical Details

### Parameter Validation
All parameters are validated at three levels:

1. **HTML Level** (Browser)
   - HTML5 range input enforces min/max
   - User cannot select invalid value

2. **JavaScript Level** (Renderer)
   - Type checking before IPC call
   - Range validation with clipping

3. **IPC Level** (Main)
   - Type validation on receipt
   - Range checking before applying
   - Error response if invalid

### Storage
- Parameters saved in `electron-store`
- Persists across application restarts
- Stored in JSON format locally
- Encrypted if store encryption enabled

### Performance Impact
- Minimal memory overhead (~140 bytes for all 7 parameters)
- Negligible CPU impact (validation only)
- Debounced IPC calls prevent excessive updates (500ms minimum)
- No network traffic (all local)

---

## Advanced Topics

### Parameter Combinations
For optimal results, consider:
- **Silence Threshold + VAD Threshold**: Both affect detection
- **Normalization + AGC**: Both affect audio levels
- **High-Pass Filter + Silence**: Filter reduces noise, silence detects speech
- **Confidence + Parallel Chunks**: Confidence affects output, chunks affect speed

### Debugging
Enable console logging to see:
- Parameter change events
- Validation results
- IPC communication
- Settings persistence

Check browser DevTools Console for detailed parameter information.

### Performance Tuning
For better performance:
1. Reduce parallel chunks if system sluggish
2. Increase high-pass filter to reduce noise processing
3. Adjust silence threshold to process less data
4. Consider confidence threshold to reduce output filtering

---

## Troubleshooting

### Issue: Settings not persisting
**Solution**: Check electron-store configuration, verify disk space

### Issue: Parameters not affecting transcription
**Solution**: Verify backend processors running, check console for errors

### Issue: Application slow when adjusting parameters
**Solution**: Reduce parallel chunks, check CPU/memory usage

### Issue: Missing speech in transcription
**Solution**: Decrease confidence threshold, check silence threshold

### Issue: Too much background noise transcribed
**Solution**: Increase high-pass filter cutoff, increase silence threshold

---

## Resources

- **Implementation Guide**: `docs/audio-parameter-sliders-plan.md`
- **Testing Guide**: `docs/audio-parameter-testing-guide.md`
- **Quick Reference**: `docs/AUDIO-PARAMETERS-IMPLEMENTATION.md`
- **Verification Report**: `docs/PHASE-7-TEST-VERIFICATION.md`
- **Deployment Checklist**: `AUDIO-PARAMETERS-DEPLOYMENT-CHECKLIST.md`

---

**Document Version**: 1.0
**Last Updated**: October 22, 2025
**Status**: Complete ✅
