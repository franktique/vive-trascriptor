# Audio Parameter Sliders Implementation Plan

**Branch:** advanced-features
**Date:** October 22, 2025
**Focus:** Add interactive sliders for key audio processing parameters in the control panel with testing guide

---

## Overview

This plan adds interactive sliders to the control panel for the most impactful audio processing parameters identified in the Transcription Accuracy Improvement Plan. Users can adjust these parameters in real-time and test their effects on transcription quality.

**Target Impact:**
- Enable users to tune audio processing for their specific environment
- Provide real-time feedback on parameter changes
- Create a guided testing experience
- Improve overall transcription accuracy

---

## High-Impact Parameters (Priority Order)

### Tier 1: Critical Parameters (Highest Impact)

1. **Silence Threshold** (Current: -40 dB)
   - Impact: 10% speed improvement + eliminates noise-only results
   - Range: -60 to -10 dB
   - Step: 2 dB
   - Use Case: Adjust for noisy environments or quiet speakers

2. **Normalization Target** (Current: -20 dB)
   - Impact: 15-20% accuracy improvement for varied input levels
   - Range: -30 to -10 dB
   - Step: 1 dB
   - Use Case: Optimize audio levels before processing

3. **Confidence Threshold** (Current: 0.6)
   - Impact: 10-15% effective accuracy by filtering unreliable results
   - Range: 0.3 to 0.9
   - Step: 0.05
   - Use Case: Control which results are displayed

### Tier 2: Mid-Level Parameters (Medium Impact)

4. **High-Pass Filter Cutoff** (Current: 300 Hz)
   - Impact: 10-15% improvement in noisy environments
   - Range: 100 to 800 Hz
   - Step: 50 Hz
   - Use Case: Remove background rumble and hum

5. **AGC Target Level** (Current: -20 dB)
   - Impact: 15-20% improvement for varied speaker volumes
   - Range: -30 to -10 dB
   - Step: 1 dB
   - Use Case: Consistent levels across different speakers

6. **Max Parallel Chunks** (Current: 2)
   - Impact: 40-50% latency reduction
   - Range: 1 to 4
   - Step: 1
   - Use Case: Balance speed vs. resource usage

### Tier 3: Supporting Parameters (Lower Impact)

7. **VAD Energy Threshold** (Current: -35 dB)
   - Impact: 20-25% speed improvement, reduces false positives
   - Range: -40 to -20 dB
   - Step: 1 dB
   - Use Case: Fine-tune voice detection sensitivity

---

## Implementation Plan

### Phase 1: UI Structure & HTML Updates

**File:** `src/renderer/controls.html`

- [ ] Create new "Advanced Audio Processing" collapsible section
- [ ] Add toggle switch to show/hide advanced parameters
- [ ] Add 7 slider groups with:
  - Label with description
  - Slider input with range
  - Value display (numeric + unit)
  - Reset button (back to default)
  - Tooltip with quick help text

**HTML Structure:**
```html
<div class="section">
    <div class="section-header">
        <h3>Advanced Audio Processing</h3>
        <label class="toggle">
            <input type="checkbox" id="advanced-toggle" checked>
            <span class="toggle-label">Show Advanced Settings</span>
        </label>
    </div>

    <div id="advanced-settings" class="advanced-settings-hidden">
        <!-- Slider groups will go here -->
    </div>
</div>
```

### Phase 2: CSS Styling

**File:** `src/renderer/controls.css` (or new `src/renderer/advanced-settings.css`)

- [ ] Style slider containers with better visual hierarchy
- [ ] Add color coding for parameter impacts (critical, medium, low)
- [ ] Create responsive layout for slider groups
- [ ] Add visual feedback for edited vs. default values
- [ ] Style toggle switch for showing/hiding advanced settings
- [ ] Add info icons and tooltips

**Styling Features:**
- Green/yellow/orange color coding by impact level
- Value display box with background color change
- "Reset" button styling
- Smooth transitions for value changes
- Disabled state for parameters being tested

### Phase 3: JavaScript Event Handling

**File:** `src/renderer/controls.js`

Add to `ControlPanel` class:

- [ ] Initialize slider elements and values on load
- [ ] Create `initializeAudioSliders()` method
- [ ] Add event listeners for each slider
- [ ] Add debounced IPC calls to main process
- [ ] Load saved slider values from settings
- [ ] Add reset-to-default functionality
- [ ] Track which parameters have been modified
- [ ] Add parameter description tooltips

**Key Methods to Add:**
```javascript
initializeAudioSliders()
updateAudioSlider(parameterId, value)
resetAudioSlider(parameterId)
saveAudioParameter(parameterId, value)
loadAudioParameters()
toggleAdvancedSettings(visible)
updateSliderDisplay(parameterId, value)
```

### Phase 4: Main Process Integration

**File:** `src/main/main.js`

- [ ] Add IPC handlers for audio parameter updates
- [ ] Save parameters to electron-store
- [ ] Pass parameters to BufferManager
- [ ] Pass parameters to WhisperProcessor
- [ ] Log parameter changes for debugging
- [ ] Validate parameter ranges

**IPC Handlers to Add:**
```javascript
ipcMain.handle('set-audio-parameter', (event, paramId, value))
ipcMain.handle('get-audio-parameters', (event))
ipcMain.handle('reset-audio-parameter', (event, paramId))
ipcMain.handle('get-parameter-defaults', (event))
```

### Phase 5: BufferManager Integration

**File:** `src/main/bufferManager.js`

- [ ] Make silence threshold configurable
- [ ] Make normalization target configurable
- [ ] Make high-pass filter cutoff configurable
- [ ] Make AGC target level configurable
- [ ] Make VAD energy threshold configurable
- [ ] Accept parameters from main process
- [ ] Validate parameter values

### Phase 6: WhisperProcessor Integration

**File:** `src/main/whisperProcessor.js`

- [ ] Make confidence threshold configurable
- [ ] Make max parallel chunks configurable
- [ ] Accept parameters from main process
- [ ] Update parallel processing logic based on parameter
- [ ] Validate confidence threshold range

### Phase 7: Testing Guide & Documentation

**File:** `docs/audio-parameter-testing-guide.md`

Create comprehensive testing guide with:

- [ ] Parameter description and impact explanation
- [ ] Recommended ranges for different scenarios
- [ ] Step-by-step testing procedures
- [ ] Before/after comparison methodology
- [ ] Audio quality assessment checklist
- [ ] Environment-specific recommendations
- [ ] Expected accuracy improvements
- [ ] Performance benchmarking guide

---

## Parameter Configuration Details

### 1. Silence Threshold Slider
```javascript
{
  id: 'silenceThreshold',
  label: 'Silence Threshold',
  unit: 'dB',
  min: -60,
  max: -10,
  step: 2,
  default: -40,
  description: 'Skip audio chunks below this volume level',
  tooltip: 'Higher = skip more silence. Lower = process more audio.',
  impact: 'critical',
  estimatedGain: '10% speed improvement'
}
```

### 2. Normalization Target Slider
```javascript
{
  id: 'normalizationTarget',
  label: 'Normalization Target',
  unit: 'dB',
  min: -30,
  max: -10,
  step: 1,
  default: -20,
  description: 'Target audio level for normalization',
  tooltip: 'Normalizes audio to consistent volume',
  impact: 'critical',
  estimatedGain: '15-20% accuracy improvement'
}
```

### 3. Confidence Threshold Slider
```javascript
{
  id: 'confidenceThreshold',
  label: 'Confidence Threshold',
  unit: '%',
  min: 0.3,
  max: 0.9,
  step: 0.05,
  default: 0.6,
  description: 'Minimum confidence to display results',
  tooltip: 'Lower = more results shown. Higher = only high-confidence results.',
  impact: 'critical',
  estimatedGain: '10-15% effective accuracy'
}
```

### 4. High-Pass Filter Cutoff Slider
```javascript
{
  id: 'highPassCutoff',
  label: 'High-Pass Filter Cutoff',
  unit: 'Hz',
  min: 100,
  max: 800,
  step: 50,
  default: 300,
  description: 'Remove frequencies below this Hz',
  tooltip: 'Removes background rumble and hum',
  impact: 'medium',
  estimatedGain: '10-15% in noisy environments'
}
```

### 5. AGC Target Level Slider
```javascript
{
  id: 'agcTargetLevel',
  label: 'AGC Target Level',
  unit: 'dB',
  min: -30,
  max: -10,
  step: 1,
  default: -20,
  description: 'Target level for automatic gain control',
  tooltip: 'Evens out volume differences between speakers',
  impact: 'medium',
  estimatedGain: '15-20% for varied volumes'
}
```

### 6. Max Parallel Chunks Slider
```javascript
{
  id: 'maxParallelChunks',
  label: 'Parallel Processing',
  unit: 'chunks',
  min: 1,
  max: 4,
  step: 1,
  default: 2,
  description: 'Number of audio chunks to process simultaneously',
  tooltip: 'More chunks = faster but uses more CPU/GPU',
  impact: 'medium',
  estimatedGain: '40-50% latency reduction'
}
```

### 7. VAD Energy Threshold Slider
```javascript
{
  id: 'vadEnergyThreshold',
  label: 'Voice Activity Detection Energy',
  unit: 'dB',
  min: -40,
  max: -20,
  step: 1,
  default: -35,
  description: 'Minimum energy for voice detection',
  tooltip: 'Lower = detect quieter voices. Higher = ignore background noise.',
  impact: 'low-medium',
  estimatedGain: '20-25% speed, fewer false positives'
}
```

---

## Testing Guide Overview

### Quick Start Testing (5 minutes)

1. **Record baseline:** Open transcript with default settings
2. **Adjust one parameter:** Move slider and observe changes
3. **Listen to audio:** Notice improvement or degradation
4. **Record results:** Note the effect in a test log
5. **Reset and try next:** Click reset, move to next parameter

### Detailed Testing (30 minutes)

1. **Environment Assessment**
   - Quiet room: Use default or lower values
   - Noisy room: Increase silence threshold and high-pass cutoff
   - Multiple speakers: Lower confidence threshold, enable parallel chunks

2. **Parameter Testing Sequence**
   - Test one parameter at a time
   - Record baseline metrics (WER, confidence, speed)
   - Adjust parameter
   - Re-record and compare metrics
   - Document results

3. **Performance Testing**
   - Measure latency with different parallel chunk settings
   - Monitor CPU/GPU usage
   - Test with various audio lengths
   - Record performance metrics

4. **Quality Metrics**
   - **Accuracy:** Compare transcription against known text
   - **Confidence:** Average confidence scores
   - **Speed:** Measure chunk processing time
   - **Noise Resilience:** Test in different environments

---

## UI Mockup

```
┌─ Advanced Audio Processing ─────────────────────────────────┐
│ ☐ Show Advanced Settings                                     │
│                                                              │
│ Silence Threshold              [⚠️ Critical Impact]          │
│ Skip silent audio below this level                           │
│ ◉────────●────────────────◉ -40 dB  [Reset]               │
│ -60 dB                          -10 dB                       │
│                                                              │
│ Normalization Target          [⚠️ Critical Impact]          │
│ Target level for audio gain                                 │
│ ◉────────────●─────────────◉ -20 dB  [Reset]              │
│ -30 dB                          -10 dB                       │
│                                                              │
│ Confidence Threshold          [⚠️ Critical Impact]          │
│ Show only results above this confidence                      │
│ ◉────────────────●──────────◉ 60%   [Reset]               │
│ 30%                            90%                          │
│                                                              │
│ High-Pass Filter Cutoff      [⚠️ Medium Impact]            │
│ Remove low-frequency rumble                                 │
│ ◉────────────●─────────────◉ 300 Hz  [Reset]              │
│ 100 Hz                         800 Hz                       │
│                                                              │
│ [+ More Parameters] [Reset All] [Test Scenarios]            │
└────────────────────────────────────────────────────────────┘
```

---

## Testing Scenarios Guide

### Scenario 1: Quiet Office
**Settings:**
- Silence Threshold: -50 dB (detect quieter voices)
- Normalization Target: -18 dB (preserve dynamics)
- Confidence Threshold: 0.7 (strict quality)
- High-Pass Filter: 250 Hz (minimal filtering)

**Expected Results:**
- Clear, precise transcription
- High confidence scores (0.85+)
- Low latency

### Scenario 2: Noisy Cafe
**Settings:**
- Silence Threshold: -30 dB (aggressive silence detection)
- Normalization Target: -20 dB (strong normalization)
- Confidence Threshold: 0.5 (allow more results)
- High-Pass Filter: 400 Hz (aggressive filtering)
- VAD Energy Threshold: -30 dB (require strong voice signal)

**Expected Results:**
- Better noise rejection
- More processing skipped
- Fewer false positives

### Scenario 3: Multi-Speaker Meeting
**Settings:**
- Silence Threshold: -35 dB (balanced)
- Max Parallel Chunks: 4 (fast processing)
- Confidence Threshold: 0.55 (capture all speakers)
- AGC Target Level: -18 dB (even out volumes)

**Expected Results:**
- Faster transcription
- Better handling of different speaker volumes
- More complete speaker coverage

### Scenario 4: Soft-Spoken Person
**Settings:**
- Silence Threshold: -50 dB (very sensitive)
- VAD Energy Threshold: -40 dB (detect quiet speech)
- Normalization Target: -18 dB (preserve quietness)
- AGC Target Level: -18 dB (gentle gain adjustment)

**Expected Results:**
- Capture all speech
- Preserve natural voice quality
- Accurate for soft speakers

---

## Implementation Checklist

### Phase 1: UI & HTML
- [ ] Create "Advanced Audio Processing" section in HTML
- [ ] Add 7 slider input elements
- [ ] Add value display elements
- [ ] Add reset buttons
- [ ] Add toggle switch for showing/hiding

### Phase 2: CSS Styling
- [ ] Style slider containers
- [ ] Add color coding by impact level
- [ ] Add responsive layout
- [ ] Style toggle switch
- [ ] Add hover effects and tooltips

### Phase 3: JavaScript (Controls)
- [ ] Initialize sliders in ControlPanel constructor
- [ ] Add event listeners for all sliders
- [ ] Add debounced slider change handlers
- [ ] Add reset functionality
- [ ] Add tooltip system

### Phase 4: IPC Communication
- [ ] Add IPC handlers in main.js
- [ ] Add sender calls in controls.js
- [ ] Implement settings persistence
- [ ] Add validation logic

### Phase 5: Backend Integration
- [ ] Update BufferManager to accept parameters
- [ ] Update WhisperProcessor to accept parameters
- [ ] Pass parameters through IPC
- [ ] Validate parameter ranges
- [ ] Add logging for parameter changes

### Phase 6: Testing Guide
- [ ] Write parameter descriptions
- [ ] Create testing scenarios
- [ ] Add before/after comparison methodology
- [ ] Document expected improvements
- [ ] Create quick-start guide

### Phase 7: Documentation
- [ ] Add usage guide to README
- [ ] Document all parameters
- [ ] Add troubleshooting section
- [ ] Create video/screenshot examples (optional)

---

## Success Criteria

✅ **UI/UX:**
- All 7 sliders functional and responsive
- Real-time value updates visible
- Reset buttons work correctly
- Toggle switch shows/hides advanced settings
- Visual feedback for edited values

✅ **Functionality:**
- Parameters persist across sessions
- Parameters affect audio processing pipeline
- Validation prevents invalid values
- Debounced updates prevent excessive calls
- Defaults can be restored with one click

✅ **Testing:**
- Complete testing guide provided
- 4+ testing scenarios documented
- Expected results for each scenario
- Methodology for measuring improvements
- Troubleshooting included

✅ **Documentation:**
- All parameters explained
- Impact levels clear
- Use cases documented
- Testing guide comprehensive
- Code comments added

---

## Notes

- All parameters should be safely configurable without breaking the app
- Changes should apply immediately for user feedback
- Parameters should persist in electron-store
- Provide sensible defaults for all settings
- Add validation to prevent out-of-range values
- Create visual distinction between critical, medium, and low-impact parameters
- Include performance impact warnings for high parallel chunk counts
- Document expected improvements for each scenario

