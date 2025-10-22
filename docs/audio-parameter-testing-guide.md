# Audio Parameter Testing Guide

**Date:** October 22, 2025
**Version:** 1.0
**Purpose:** Step-by-step guide for testing and optimizing audio parameters in the Whisper Transcriber

---

## Table of Contents

1. [Quick Start Testing (5 minutes)](#quick-start-testing)
2. [Detailed Testing (30 minutes)](#detailed-testing)
3. [Performance Benchmarking](#performance-benchmarking)
4. [Environment-Specific Recommendations](#environment-specific-recommendations)
5. [Quality Metrics Reference](#quality-metrics-reference)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start Testing

### For the Impatient (5 Minutes)

**Goal:** Quickly test parameters and see their effects

**Steps:**

1. **Open the Transcriber**
   ```bash
   npm start
   ```

2. **Open Control Panel** (if not visible)
   - Click settings icon in overlay or use keyboard shortcut

3. **Enable Advanced Settings**
   - Check "Show Advanced Settings" checkbox

4. **Test Silence Threshold**
   - Speak normally while slider is at default (-40 dB)
   - Notice audio level meter and silence detection
   - Move slider right to -30 dB (less sensitive to silence)
   - Notice fewer chunks being skipped
   - Move slider left to -50 dB (more sensitive)
   - Notice more silence being detected
   - Pick the value that works best for your voice

5. **Test Confidence Threshold**
   - After transcribing some audio, check transcript quality
   - Move slider right (0.7) to show only high-confidence results
   - Move slider left (0.5) to show more results
   - Pick the balance you prefer between quantity and quality

6. **Save and Continue**
   - Settings auto-save
   - Test other parameters as needed
   - Record which settings work best for you

---

## Detailed Testing

### For the Thorough (30 Minutes)

### Test Environment Setup

**You'll Need:**
- Quiet room for baseline testing
- Access to different audio samples (yourself, others, background noise)
- Text file with known content for accuracy testing
- Timer or stopwatch
- Test log (spreadsheet or document)

**Test Log Template:**

| Parameter | Value | WER | Confidence | Speed | Notes |
|-----------|-------|-----|------------|-------|-------|
| Baseline | Default | - | - | - | Initial measurement |
| Silence Threshold | -40 dB | - | - | - | |
| Silence Threshold | -35 dB | - | - | - | |
| ... | ... | - | - | - | |

### Step-by-Step Testing Process

#### Phase 1: Baseline Measurement (5 minutes)

1. **Keep all parameters at defaults**
   - Silence Threshold: -40 dB
   - Normalization Target: -20 dB
   - Confidence Threshold: 0.6
   - High-Pass Filter Cutoff: 300 Hz
   - AGC Target Level: -20 dB
   - Max Parallel Chunks: 2
   - VAD Energy Threshold: -35 dB

2. **Record test audio** (30 seconds)
   - Read this test phrase 3 times naturally:
   > "The quick brown fox jumps over the lazy dog. She sells seashells by the seashore. How much wood would a woodchuck chuck."

3. **Measure baseline metrics:**
   - **WER (Word Error Rate):** Count incorrect words / total words
   - **Confidence:** Note average confidence score from control panel
   - **Speed:** Measure time from speech end to transcription complete
   - **Note:** Exact transcription vs. expected text

4. **Save results** in test log

#### Phase 2: Single Parameter Testing (20 minutes)

**Test one parameter at a time.** Change only one value between tests.

##### Test 1: Silence Threshold

| Value | Expected Behavior | Test It | Notes |
|-------|-------------------|---------|-------|
| -60 dB | Very sensitive, process nearly everything | ☐ | |
| -50 dB | Sensitive, catch quiet speakers | ☐ | |
| -40 dB | **Default**, balanced | ☐ | BASELINE |
| -30 dB | Less sensitive, skip more silence | ☐ | |
| -20 dB | Very aggressive, miss some speech | ☐ | |

**For each value:**
1. Move slider to test value
2. Record same test phrase (30 seconds)
3. Measure WER, confidence, and speed
4. Note if audio quality improved or degraded
5. Listen to transcription - does it sound better?

**When to use each:**
- **-60 dB:** Very quiet speaker, need to capture everything
- **-50 dB:** Quiet office, soft-spoken person
- **-40 dB:** Normal environment (DEFAULT)
- **-30 dB:** Noisy environment, strong background noise
- **-20 dB:** Only for very aggressive filtering (rare)

**Expected Improvements:**
- Tighter threshold → better accuracy, more processing
- Looser threshold → faster processing, may miss quiet audio

---

##### Test 2: Confidence Threshold

| Value | Expected Behavior | Test It | Notes |
|-------|-------------------|---------|-------|
| 0.3 | Show everything, even poor results | ☐ | |
| 0.5 | Show most results | ☐ | |
| 0.6 | **Default**, balanced | ☐ | BASELINE |
| 0.7 | Strict, only high-confidence | ☐ | |
| 0.8 | Very strict, may miss some speech | ☐ | |

**For each value:**
1. Move slider to test value
2. Record same test phrase (30 seconds)
3. Count visible transcription results
4. Measure visible vs. filtered out results
5. Check if accuracy improves (fewer errors shown)

**When to use each:**
- **0.3-0.5:** Noisy environment, need to capture as much as possible
- **0.6:** Normal environment (DEFAULT)
- **0.7-0.8:** Clean audio, high-quality transcription priority

**Expected Improvements:**
- Higher threshold → fewer results, but higher quality
- Lower threshold → more results, but more errors

---

##### Test 3: High-Pass Filter Cutoff

| Value | Expected Behavior | Test It | Notes |
|-------|-------------------|---------|-------|
| 100 Hz | Minimal filtering, preserve low tones | ☐ | |
| 200 Hz | Light filtering | ☐ | |
| 300 Hz | **Default**, balanced filtering | ☐ | BASELINE |
| 400 Hz | Aggressive filtering | ☐ | |
| 500+ Hz | Very aggressive, may remove voice | ☐ | |

**For each value:**
1. Move slider to test value
2. Record test audio in NOISY environment (coffee shop, street noise, etc.)
3. Measure WER and confidence scores
4. Listen for background rumble or hum reduction

**When to use each:**
- **100-200 Hz:** Clean audio, bass-heavy voices
- **300 Hz:** Normal environment (DEFAULT)
- **400-500 Hz:** Very noisy environment (construction, traffic)

**Expected Improvements:**
- More aggressive filtering → better in noisy environments
- Lighter filtering → preserves natural voice quality

---

##### Test 4: Normalization Target

| Value | Expected Behavior | Test It | Notes |
|-------|-------------------|---------|-------|
| -30 dB | Gentle normalization | ☐ | |
| -25 dB | Moderate normalization | ☐ | |
| -20 dB | **Default**, standard | ☐ | BASELINE |
| -18 dB | Stronger normalization | ☐ | |
| -15 dB | Very strong (may cause clipping) | ☐ | |

**For each value:**
1. Move slider to test value
2. Record at NORMAL voice level
3. Measure audio level consistency
4. Check for clipping or distortion in audio meter
5. Measure transcription quality

**When to use each:**
- **-30 dB:** Quiet speakers, preserve dynamics
- **-20 dB:** Normal speakers (DEFAULT)
- **-15 dB:** Multiple speakers with different volumes

**Expected Improvements:**
- Stronger normalization → more consistent volume handling
- Gentle normalization → preserves natural dynamics

---

##### Test 5: Max Parallel Chunks

| Value | Speed Impact | CPU Impact | Test It | Notes |
|-------|--------------|------------|---------|-------|
| 1 | Baseline (slowest) | Low | ☐ | Sequential only |
| 2 | ~1.5x faster | Medium | ☐ | DEFAULT |
| 3 | ~2x faster | High | ☐ | |
| 4 | ~2.5x faster | Very High | ☐ | |

**For each value:**
1. Move slider to test value
2. Record longer audio (1-2 minutes)
3. Measure total processing time
4. Monitor CPU/GPU usage if possible
5. Check if quality degrades at higher values

**When to use each:**
- **1:** Low-power devices, need quality over speed
- **2:** Balanced (DEFAULT)
- **3-4:** High-performance machines, speed priority

**Performance Testing:**
- Count seconds from end of speech to completion
- Higher number = faster, but uses more resources

---

##### Test 6: VAD Energy Threshold

| Value | Expected Behavior | Test It | Notes |
|-------|-------------------|---------|-------|
| -40 dB | Very sensitive, detect quiet speech | ☐ | |
| -35 dB | **Default**, balanced | ☐ | BASELINE |
| -30 dB | Less sensitive, skip quiet audio | ☐ | |
| -25 dB | Very insensitive (may miss speech) | ☐ | |

**For each value:**
1. Move slider to test value
2. Record test at QUIET volume level
3. Measure if quiet speech is captured
4. Check for false positives in silence
5. Measure processing speed

**When to use each:**
- **-40 dB:** Quiet speakers, must capture all speech
- **-35 dB:** Normal environment (DEFAULT)
- **-30 dB:** Noisy environment, strong filtering

---

#### Phase 3: Combined Testing (5 minutes)

After testing individual parameters, test some combinations:

**Combination 1: Quiet Office**
- Silence Threshold: -50 dB
- Confidence Threshold: 0.7
- High-Pass Filter: 250 Hz
- VAD Energy: -40 dB

**Expected Result:** Accurate, high-quality transcription with minimal false positives

**Combination 2: Noisy Cafe**
- Silence Threshold: -30 dB
- Confidence Threshold: 0.5
- High-Pass Filter: 400 Hz
- VAD Energy: -30 dB
- Max Parallel Chunks: 3

**Expected Result:** Fast processing, decent accuracy despite noise

**Combination 3: Multiple Speakers**
- Confidence Threshold: 0.55
- Max Parallel Chunks: 4
- AGC Target Level: -18 dB

**Expected Result:** Balanced capture of all speakers

---

## Performance Benchmarking

### Measuring Speed Improvements

#### Setup

1. Prepare a 2-minute audio sample
2. Keep other applications closed
3. Disable any background processing

#### Testing

**Test 1: Sequential vs. Parallel**

```
Default Settings:
  Max Parallel Chunks: 2
  Start time: [note clock time]
  End time: [note clock time]
  Total duration: [calculate]
  Audio processed: 2 minutes
  Speed ratio: 2 min / [duration] = [ratio]x
```

**Test 2: Parallel Processing Scaling**

```
With 1 chunk (sequential):
  Total time: [measure]
  Speed: 2 min / [time] = [ratio]x

With 2 chunks:
  Total time: [measure]
  Speed: 2 min / [time] = [ratio]x

With 3 chunks:
  Total time: [measure]
  Speed: 2 min / [time] = [ratio]x

With 4 chunks:
  Total time: [measure]
  Speed: 2 min / [time] = [ratio]x
```

#### Expected Results

- 1 chunk: 1.0x (baseline)
- 2 chunks: 1.3-1.5x faster
- 3 chunks: 1.8-2.0x faster
- 4 chunks: 2.0-2.5x faster

**Note:** Higher numbers may not show linear improvement due to processing overhead.

---

## Environment-Specific Recommendations

### Quiet Office Environment

```
Parameter                Value       Rationale
─────────────────────────────────────────────────────────
Silence Threshold        -50 dB      Catch quiet speakers
Normalization Target     -20 dB      Standard
Confidence Threshold     0.7         High quality priority
High-Pass Filter         250 Hz      Minimal filtering needed
AGC Target Level         -20 dB      Standard
Max Parallel Chunks      2           Balanced
VAD Energy Threshold     -40 dB      Catch all speech
```

**Expected Results:**
- High accuracy (>95% WER improvement)
- High confidence scores (0.85+)
- Minimal processing time

**Testing Focus:**
- Does quiet speech get captured?
- Are false positives eliminated?
- Is quality maintained?

---

### Noisy Coffee Shop/Street

```
Parameter                Value       Rationale
─────────────────────────────────────────────────────────
Silence Threshold        -30 dB      Skip more silence/noise
Normalization Target     -20 dB      Standard
Confidence Threshold     0.5         Allow more results
High-Pass Filter         400 Hz      Aggressive noise removal
AGC Target Level         -20 dB      Standard
Max Parallel Chunks      3           Speed priority
VAD Energy Threshold     -30 dB      Reduce false positives
```

**Expected Results:**
- Moderate accuracy (85-90%)
- Faster processing
- Better noise rejection

**Testing Focus:**
- Is background noise removed?
- How much speech is still captured?
- Is processing faster?

---

### Multiple Speakers/Meeting

```
Parameter                Value       Rationale
─────────────────────────────────────────────────────────
Silence Threshold        -35 dB      Balanced
Normalization Target     -18 dB      Even out speaker volumes
Confidence Threshold     0.55        Capture all speakers
High-Pass Filter         300 Hz      Balanced
AGC Target Level         -18 dB      Consistent levels
Max Parallel Chunks      4           Fast processing
VAD Energy Threshold     -35 dB      Balanced
```

**Expected Results:**
- Capture from all speakers
- Even out volume differences
- Fast processing for real-time use

**Testing Focus:**
- Are all speakers captured?
- Are volumes balanced?
- Is processing fast enough?

---

### Soft-Spoken Person/Low Volume

```
Parameter                Value       Rationale
─────────────────────────────────────────────────────────
Silence Threshold        -50 dB      Very sensitive
Normalization Target     -18 dB      Preserve quietness
Confidence Threshold     0.6         Balanced
High-Pass Filter         250 Hz      Minimal filtering
AGC Target Level         -18 dB      Gentle gain adjustment
Max Parallel Chunks      2           Quality priority
VAD Energy Threshold     -40 dB      Detect quiet speech
```

**Expected Results:**
- Capture all soft speech
- Maintain natural voice quality
- Accurate for quiet speakers

**Testing Focus:**
- Is quiet speech fully captured?
- Is voice quality preserved?
- Are dynamics maintained?

---

## Quality Metrics Reference

### Understanding Word Error Rate (WER)

**Formula:**
```
WER = (Substitutions + Deletions + Insertions) / Total Words × 100%
```

**Example:**
```
Expected: "The quick brown fox"
Got:      "The quick brown dog"

Errors: 1 substitution (fox → dog)
WER = 1/4 × 100% = 25%
```

**Benchmarks:**
- **<5% WER:** Excellent (professional quality)
- **5-10% WER:** Good (acceptable for most uses)
- **10-15% WER:** Fair (useful but needs review)
- **>15% WER:** Poor (requires improvement)

### Measuring Confidence Scores

**Confidence Distribution:**
- 0.9-1.0: Excellent (should trust completely)
- 0.8-0.9: Very Good (high reliability)
- 0.7-0.8: Good (generally reliable)
- 0.6-0.7: Acceptable (flag for review)
- <0.6: Low (filter out or mark uncertain)

**How to Check:**
1. Open Control Panel
2. Look at "Avg Confidence" statistic
3. Compare with different parameter settings
4. Higher values = better quality, lower values = less reliable

### Measuring Processing Speed

**Latency Metrics:**
- Chunk time: Time to process one 2-second audio chunk
- Batch time: Time to process all queued chunks
- Real-time ratio: Audio duration / Processing time

**Examples:**
- 2-second audio takes 1 second = 2x real-time (good)
- 2-second audio takes 5 seconds = 0.4x real-time (slow)

---

## Troubleshooting

### Problem: Audio cuts off or seems incomplete

**Diagnosis:**
- Silence threshold too high (-20 dB or higher)
- VAD energy threshold too low
- Check audio level meter - is speech level adequate?

**Solutions:**
1. Lower silence threshold (-50 dB or -45 dB)
2. Lower VAD energy threshold (-40 dB)
3. Increase microphone input level (check system settings)
4. Move closer to microphone

---

### Problem: Too much background noise in transcription

**Diagnosis:**
- High-pass filter too low (below 300 Hz)
- Confidence threshold too low (below 0.5)
- Silence threshold too sensitive

**Solutions:**
1. Increase high-pass filter cutoff (400-500 Hz)
2. Increase confidence threshold (0.6-0.7)
3. Increase silence threshold (-30 to -20 dB)
4. Move away from noise source
5. Use better microphone positioning

---

### Problem: Accuracy is poor even with default settings

**Diagnosis:**
- Model may be too small for your use case
- Audio quality is very poor
- Microphone issue

**Solutions:**
1. Try larger model (base.en → small.en → medium.en)
2. Check microphone - test with system recording app
3. Improve audio environment (reduce background noise)
4. Try recommended settings for your environment

---

### Problem: Processing is too slow

**Diagnosis:**
- Parallel chunks set too low (1)
- Using large model on low-power device
- Too much post-processing enabled

**Solutions:**
1. Increase max parallel chunks (2 → 3 → 4)
2. Switch to smaller model (medium.en → base.en → tiny.en)
3. Disable advanced features (grammar correction, etc.)
4. Close other applications

---

### Problem: Different settings give unpredictable results

**Diagnosis:**
- Not testing with consistent audio samples
- Changing multiple parameters at once
- Not allowing enough test samples

**Solutions:**
1. Use same test phrase for all tests (30 seconds minimum)
2. Change only one parameter per test
3. Test each setting at least 3 times
4. Wait for transcription to complete fully
5. Use consistent microphone and position

---

## Quick Reference: Parameter Cheat Sheet

| Scenario | Silence | Confidence | HPF | Parallel |
|----------|---------|------------|-----|----------|
| **Quiet Office** | -50 | 0.70 | 250 | 2 |
| **Noisy Cafe** | -30 | 0.50 | 400 | 3 |
| **Meeting** | -35 | 0.55 | 300 | 4 |
| **Soft Speaker** | -50 | 0.60 | 250 | 2 |
| **Default** | -40 | 0.60 | 300 | 2 |

---

## Next Steps

1. **Run quick start test** (5 min) to get familiar with parameters
2. **Test your environment** (10-15 min) to find optimal settings
3. **Document your findings** for your specific use case
4. **Share results** - feedback helps improve the app

**Pro Tip:** Create a bookmark for your optimal settings. When you need to test new features or updates, you can quickly return to your known-good configuration.

