const { EventEmitter } = require('events');

class BufferManager extends EventEmitter {
    constructor(options = {}) {
        super();

        this.settings = {
            chunkDurationMs: options.chunkDurationMs || 2000, // 2 seconds
            overlapMs: options.overlapMs || 500, // 0.5 second overlap
            maxBufferSize: options.maxBufferSize || 10 * 1024 * 1024, // 10MB max
            sampleRate: options.sampleRate || 16000, // 16kHz
            bytesPerSample: 2, // 16-bit = 2 bytes
            cleanupInterval: options.cleanupInterval || 30000, // 30 seconds
            // Audio processing settings
            enableNormalization: options.enableNormalization !== false, // Normalize audio
            normalizationTarget: options.normalizationTarget || -20, // dB (peak normalization)
            enableSilenceDetection: options.enableSilenceDetection !== false, // Detect silence
            silenceThreshold: options.silenceThreshold || -40, // dB (RMS threshold)
            silenceDurationMs: options.silenceDurationMs || 300, // Minimum silence duration
            // Advanced VAD settings
            enableAdvancedVAD: options.enableAdvancedVAD !== false, // Use zero-crossing rate + energy
            vadEnergyThreshold: options.vadEnergyThreshold || -35, // dB energy threshold
            vadZcrThreshold: options.vadZcrThreshold || 0.1, // Zero-crossing rate threshold (0-1)
            vadFrameSize: options.vadFrameSize || 512, // Samples per frame for ZCR calculation
            // Frequency filtering settings
            enableHighPassFilter: options.enableHighPassFilter !== false, // Filter low frequencies
            highPassCutoffHz: options.highPassCutoffHz || 300, // High-pass filter cutoff frequency
            // Automatic Gain Adjustment (AGC) settings
            enableAGC: options.enableAGC !== false, // Enable adaptive gain control
            agcTargetLevel: options.agcTargetLevel || -20, // Target RMS level in dB
            agcAttackTime: options.agcAttackTime || 0.01, // Attack time (seconds)
            agcReleaseTime: options.agcReleaseTime || 0.1 // Release time (seconds)
        };

        this.buffer = Buffer.alloc(0);
        this.chunks = new Map(); // Store processed chunks with timestamps
        this.chunkCounter = 0;
        this.startTime = null;
        this.lastChunkTime = 0;
        this.cleanupTimer = null;

        // AGC state tracking
        this.agcGain = 1.0; // Current gain level
        this.agcPeakLevel = 0; // Peak level from previous chunk

        this.calculateChunkSize();
        this.startCleanupTimer();
    }

    /**
     * Calculate peak amplitude of audio data (16-bit PCM)
     * Returns value between 0 and 1, where 1 is max amplitude
     */
    calculatePeakAmplitude(audioData) {
        let maxSample = 0;

        for (let i = 0; i < audioData.length; i += 2) {
            // Read 16-bit signed integer (little-endian)
            const sample = audioData.readInt16LE(i);
            const absSample = Math.abs(sample);
            if (absSample > maxSample) {
                maxSample = absSample;
            }
        }

        // Normalize to 0-1 range (max 16-bit value is 32767)
        return maxSample / 32767;
    }

    /**
     * Convert amplitude (0-1) to dB scale
     */
    amplitudeToDb(amplitude) {
        if (amplitude === 0) return -Infinity;
        return 20 * Math.log10(amplitude);
    }

    /**
     * Convert dB to amplitude (0-1)
     */
    dbToAmplitude(db) {
        return Math.pow(10, db / 20);
    }

    /**
     * Calculate RMS (Root Mean Square) level for silence detection
     * Returns value in dB
     */
    calculateRmsLevel(audioData) {
        let sumSquares = 0;

        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i);
            sumSquares += sample * sample;
        }

        const mean = sumSquares / (audioData.length / 2);
        const rms = Math.sqrt(mean);
        const rmsNormalized = rms / 32767; // Normalize to 0-1

        return this.amplitudeToDb(rmsNormalized);
    }

    /**
     * Apply high-pass filter to remove low-frequency rumble and noise
     * Uses a simple 1st-order IIR filter for efficiency
     */
    applyHighPassFilter(audioData, cutoffHz = 300) {
        if (cutoffHz <= 0 || cutoffHz >= this.settings.sampleRate / 2) {
            return Buffer.from(audioData); // No filtering needed
        }

        // Calculate filter coefficient (alpha) for 1st-order IIR high-pass filter
        // Normalized frequency: f = cutoffHz / sampleRate
        const normalizedCutoff = cutoffHz / this.settings.sampleRate;
        // Filter coefficient
        const alpha = 1 / (1 + 2 * Math.PI * normalizedCutoff);

        const filteredData = Buffer.alloc(audioData.length);
        let prevSample = 0;
        let prevOutput = 0;

        // Apply high-pass filter using difference equation:
        // y[n] = alpha * (y[n-1] + x[n] - x[n-1])
        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i);

            // High-pass filter difference equation
            const output = alpha * (prevOutput + sample - prevSample);

            // Store output with clipping protection
            const clippedOutput = Math.max(-32768, Math.min(32767, Math.round(output)));
            filteredData.writeInt16LE(clippedOutput, i);

            prevSample = sample;
            prevOutput = output;
        }

        return filteredData;
    }

    /**
     * Apply Automatic Gain Adjustment (AGC)
     * Adaptively adjusts gain to maintain target RMS level
     */
    applyAGC(audioData) {
        const currentRmsDb = this.calculateRmsLevel(audioData);
        const targetDb = this.settings.agcTargetLevel;

        // Calculate desired gain based on error from target
        const gainDb = targetDb - currentRmsDb;
        const gainLinear = this.dbToAmplitude(gainDb);

        // Calculate smoothing coefficients based on attack/release times
        const attackCoeff = Math.exp(-2 * Math.PI / (this.settings.agcAttackTime * this.settings.sampleRate));
        const releaseCoeff = Math.exp(-2 * Math.PI / (this.settings.agcReleaseTime * this.settings.sampleRate));

        // Choose attack or release based on whether gain is increasing or decreasing
        const smoothingCoeff = gainLinear > this.agcGain ? attackCoeff : releaseCoeff;

        // Smooth the gain adjustment to avoid abrupt changes
        this.agcGain = smoothingCoeff * this.agcGain + (1 - smoothingCoeff) * gainLinear;

        // Apply gain with clipping protection
        const agcData = Buffer.alloc(audioData.length);

        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i);
            let agcSample = sample * this.agcGain;

            // Clip to prevent overflow
            agcSample = Math.max(-32768, Math.min(32767, agcSample));

            agcData.writeInt16LE(Math.round(agcSample), i);
        }

        return agcData;
    }

    /**
     * Normalize audio data to target dB level
     * Default target is -20dB (preventing clipping while maintaining volume)
     */
    normalizeAudio(audioData, targetDb = -20) {
        const peakAmplitude = this.calculatePeakAmplitude(audioData);
        const currentDb = this.amplitudeToDb(peakAmplitude);

        // Calculate gain needed to reach target dB
        const gainDb = targetDb - currentDb;
        const gainLinear = this.dbToAmplitude(gainDb);

        // If gain is very close to 1.0, skip processing to avoid unnecessary work
        if (Math.abs(gainLinear - 1.0) < 0.01) {
            return Buffer.from(audioData);
        }

        // Apply gain to all samples with clipping protection
        const normalizedData = Buffer.alloc(audioData.length);

        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i);
            let normalizedSample = sample * gainLinear;

            // Clip to prevent overflow
            normalizedSample = Math.max(-32768, Math.min(32767, normalizedSample));

            normalizedData.writeInt16LE(Math.round(normalizedSample), i);
        }

        return normalizedData;
    }

    /**
     * Calculate zero-crossing rate (ZCR) for advanced VAD
     * ZCR is the rate at which the signal changes sign
     * High ZCR indicates voiceless consonants/noise, low ZCR indicates voiced sounds/silence
     */
    calculateZeroCrossingRate(audioData, frameSize = 512) {
        let frameIndex = 0;
        const zeroCrossingRates = [];

        while (frameIndex + frameSize <= audioData.length) {
            let zeroCrossings = 0;
            let prevSample = 0;

            for (let i = frameIndex; i < frameIndex + frameSize; i += 2) {
                const sample = audioData.readInt16LE(i);

                if (prevSample !== 0 && sample !== 0) {
                    // Check if sign changed
                    if ((prevSample > 0 && sample < 0) || (prevSample < 0 && sample > 0)) {
                        zeroCrossings++;
                    }
                }

                prevSample = sample;
            }

            // Normalize ZCR to 0-1 range (max crossings = frameSize/2)
            const zcr = zeroCrossings / (frameSize / 2);
            zeroCrossingRates.push(zcr);
            frameIndex += frameSize;
        }

        // Return average ZCR
        if (zeroCrossingRates.length === 0) return 0;
        return zeroCrossingRates.reduce((a, b) => a + b) / zeroCrossingRates.length;
    }

    /**
     * Advanced Voice Activity Detection using multiple features
     * Combines energy (RMS), zero-crossing rate, and entropy
     */
    isVoiceActivity(audioData) {
        const rmsDb = this.calculateRmsLevel(audioData);
        const zcr = this.calculateZeroCrossingRate(audioData, this.settings.vadFrameSize);

        // Voice activity heuristics:
        // 1. Energy above threshold (speech has energy)
        // 2. ZCR in typical speech range (0.08-0.15 for speech, <0.05 for pure tone/silence, >0.2 for noise)
        // 3. Avoid pure tones which have low ZCR but are not speech

        const hasEnergy = rmsDb > this.settings.vadEnergyThreshold;
        const isPlausibleSpeech = zcr > 0.03 && zcr < 0.35; // Typical speech ZCR range

        return {
            isVoice: hasEnergy && isPlausibleSpeech,
            rmsDb: parseFloat(rmsDb.toFixed(2)),
            zcr: parseFloat(zcr.toFixed(4)),
            energyThreshold: this.settings.vadEnergyThreshold,
            hasEnergy,
            isPlausibleSpeech
        };
    }

    /**
     * Detect if audio chunk is silent based on RMS threshold
     */
    isSilentChunk(audioData, thresholdDb = -40) {
        const rmsDb = this.calculateRmsLevel(audioData);
        const isSilent = rmsDb < thresholdDb;

        return {
            isSilent,
            rmsDb: parseFloat(rmsDb.toFixed(2)),
            thresholdDb
        };
    }

    /**
     * Get audio statistics for a chunk
     */
    getAudioStats(audioData) {
        const peak = this.calculatePeakAmplitude(audioData);
        const peakDb = this.amplitudeToDb(peak);
        const rms = this.calculateRmsLevel(audioData);

        return {
            peakAmplitude: parseFloat(peak.toFixed(4)),
            peakDb: parseFloat(peakDb.toFixed(2)),
            rmsDb: parseFloat(rms.toFixed(2)),
            dynamicRange: parseFloat((peakDb - rms).toFixed(2))
        };
    }

    /**
     * Calculate chunk size in bytes based on duration and audio settings
     */
    calculateChunkSize() {
        const samplesPerSecond = this.settings.sampleRate;
        const bytesPerSecond = samplesPerSecond * this.settings.bytesPerSample;
        
        this.chunkSizeBytes = Math.floor(
            (this.settings.chunkDurationMs / 1000) * bytesPerSecond
        );
        
        this.overlapSizeBytes = Math.floor(
            (this.settings.overlapMs / 1000) * bytesPerSecond
        );

        console.log(`BufferManager: Chunk size = ${this.chunkSizeBytes} bytes (${this.settings.chunkDurationMs}ms)`);
        console.log(`BufferManager: Overlap size = ${this.overlapSizeBytes} bytes (${this.settings.overlapMs}ms)`);
    }

    /**
     * Add audio data to the buffer
     */
    addAudioData(audioData) {
        const { data, timestamp, sampleRate } = audioData;
        
        if (!Buffer.isBuffer(data)) {
            console.error('BufferManager: Invalid audio data - expected Buffer');
            return;
        }

        if (!this.startTime) {
            this.startTime = timestamp;
            console.log('BufferManager: Started buffering at', new Date(timestamp).toISOString());
        }

        // Append new data to buffer
        this.buffer = Buffer.concat([this.buffer, data]);

        // Check if buffer exceeds maximum size
        if (this.buffer.length > this.settings.maxBufferSize) {
            console.warn('BufferManager: Buffer size exceeded maximum, trimming...');
            this.trimBuffer();
        }

        // Process available chunks
        this.processAvailableChunks(timestamp);

        this.emit('buffer-updated', {
            bufferSize: this.buffer.length,
            timestamp: timestamp
        });
    }

    /**
     * Process available chunks from the buffer
     */
    processAvailableChunks(currentTimestamp) {
        while (this.buffer.length >= this.chunkSizeBytes) {
            const chunkId = this.chunkCounter++;
            const chunkStartTime = this.calculateChunkTimestamp(chunkId);

            // Extract chunk data
            let chunkData = this.buffer.subarray(0, this.chunkSizeBytes);

            // Get audio statistics before processing
            const audioStats = this.getAudioStats(chunkData);

            // Apply normalization if enabled
            if (this.settings.enableNormalization) {
                chunkData = this.normalizeAudio(chunkData, this.settings.normalizationTarget);
            }

            // Apply high-pass filtering if enabled
            if (this.settings.enableHighPassFilter) {
                chunkData = this.applyHighPassFilter(chunkData, this.settings.highPassCutoffHz);
            }

            // Apply AGC if enabled
            if (this.settings.enableAGC) {
                chunkData = this.applyAGC(chunkData);
            }

            // Check for voice activity using advanced or simple VAD
            let voiceActivityInfo = null;
            let shouldProcess = true;

            if (this.settings.enableSilenceDetection) {
                if (this.settings.enableAdvancedVAD) {
                    // Use advanced VAD with ZCR + energy
                    voiceActivityInfo = this.isVoiceActivity(chunkData);
                    shouldProcess = voiceActivityInfo.isVoice;

                    if (!shouldProcess) {
                        console.log(`BufferManager: Advanced VAD skipped chunk ${chunkId} (RMS: ${voiceActivityInfo.rmsDb.toFixed(1)}dB, ZCR: ${voiceActivityInfo.zcr.toFixed(4)})`);
                    }
                } else {
                    // Use simple RMS-based silence detection
                    voiceActivityInfo = this.isSilentChunk(chunkData, this.settings.silenceThreshold);
                    shouldProcess = !voiceActivityInfo.isSilent;

                    if (!shouldProcess) {
                        console.log(`BufferManager: Skipped silent chunk ${chunkId} (RMS: ${voiceActivityInfo.rmsDb.toFixed(1)}dB < ${voiceActivityInfo.thresholdDb}dB)`);
                    }
                }
            }

            // Create chunk object
            const chunk = {
                id: chunkId,
                data: Buffer.from(chunkData), // Create copy of normalized data
                startTime: chunkStartTime,
                endTime: chunkStartTime + this.settings.chunkDurationMs,
                size: chunkData.length,
                sampleRate: this.settings.sampleRate,
                timestamp: currentTimestamp,
                audioStats: audioStats,
                voiceActivityInfo: voiceActivityInfo
            };

            // Store chunk for reference
            this.chunks.set(chunkId, chunk);

            // Only emit if voice activity detected (or if silence detection is disabled)
            if (shouldProcess) {
                this.emit('chunk-ready', chunk);
                console.log(`BufferManager: Processed chunk ${chunkId} (Peak: ${audioStats.peakDb.toFixed(1)}dB, RMS: ${audioStats.rmsDb.toFixed(1)}dB)`);
            } else {
                this.emit('chunk-skipped', {
                    chunkId,
                    reason: 'no-voice-activity',
                    voiceActivityInfo
                });
            }

            // Remove processed data from buffer, keeping overlap
            const removeBytes = Math.max(this.chunkSizeBytes - this.overlapSizeBytes, 0);
            this.buffer = this.buffer.subarray(removeBytes);

            this.lastChunkTime = currentTimestamp;
            console.log(`BufferManager: Remaining buffer: ${this.buffer.length} bytes`);
        }
    }

    /**
     * Calculate timestamp for a chunk based on chunk ID
     */
    calculateChunkTimestamp(chunkId) {
        if (!this.startTime) return Date.now();
        
        const effectiveChunkDuration = this.settings.chunkDurationMs - this.settings.overlapMs;
        return this.startTime + (chunkId * effectiveChunkDuration);
    }

    /**
     * Trim buffer when it gets too large
     */
    trimBuffer() {
        const keepSize = Math.floor(this.settings.maxBufferSize * 0.7); // Keep 70%
        const trimSize = this.buffer.length - keepSize;
        
        this.buffer = this.buffer.subarray(trimSize);
        
        console.log(`BufferManager: Trimmed ${trimSize} bytes from buffer`);
        
        this.emit('buffer-trimmed', {
            trimmedBytes: trimSize,
            remainingBytes: this.buffer.length
        });
    }

    /**
     * Get chunk by ID
     */
    getChunk(chunkId) {
        return this.chunks.get(chunkId);
    }

    /**
     * Get buffer status information
     */
    getStatus() {
        return {
            bufferSize: this.buffer.length,
            chunkCount: this.chunks.size,
            lastChunkId: this.chunkCounter - 1,
            startTime: this.startTime,
            lastChunkTime: this.lastChunkTime,
            settings: { ...this.settings }
        };
    }

    /**
     * Update buffer settings
     */
    updateSettings(newSettings) {
        const wasProcessing = this.buffer.length > 0;

        this.settings = {
            ...this.settings,
            ...newSettings
        };

        this.calculateChunkSize();

        console.log('BufferManager: Settings updated', this.settings);
        this.emit('settings-updated', this.settings);

        if (wasProcessing) {
            console.log('BufferManager: Reprocessing buffer with new settings');
            this.processAvailableChunks(Date.now());
        }
    }

    /**
     * Update a single audio parameter at runtime
     * Maps parameter IDs to their corresponding setting keys
     */
    updateParameter(paramId, value) {
        try {
            // Map parameter IDs to setting keys
            const parameterMap = {
                silenceThreshold: 'silenceThreshold',
                normalizationTarget: 'normalizationTarget',
                highPassCutoff: 'highPassCutoffHz',
                agcTargetLevel: 'agcTargetLevel',
                vadEnergyThreshold: 'vadEnergyThreshold'
                // Note: confidenceThreshold and maxParallelChunks are handled by WhisperProcessor
            };

            const settingKey = parameterMap[paramId];
            if (!settingKey) {
                console.warn(`BufferManager: Unknown parameter ${paramId}, ignoring`);
                return { success: false, error: `Unknown parameter: ${paramId}` };
            }

            // Validate parameter ranges
            const parameterLimits = {
                silenceThreshold: { min: -60, max: -10, type: 'number' },
                normalizationTarget: { min: -30, max: -10, type: 'number' },
                highPassCutoffHz: { min: 100, max: 800, type: 'number' },
                agcTargetLevel: { min: -30, max: -10, type: 'number' },
                vadEnergyThreshold: { min: -40, max: -20, type: 'number' }
            };

            const limits = parameterLimits[settingKey];
            if (!limits) {
                console.warn(`BufferManager: No validation rules for ${settingKey}`);
                return { success: false, error: `No validation rules for: ${settingKey}` };
            }

            // Type check
            if (typeof value !== limits.type) {
                console.error(`BufferManager: Invalid type for ${paramId}. Expected ${limits.type}, got ${typeof value}`);
                return { success: false, error: `Invalid type for ${paramId}` };
            }

            // Range check
            if (value < limits.min || value > limits.max) {
                console.error(`BufferManager: Parameter ${paramId} out of range [${limits.min}, ${limits.max}]`);
                return { success: false, error: `Parameter ${paramId} out of range [${limits.min}, ${limits.max}]` };
            }

            // Update the setting
            const oldValue = this.settings[settingKey];
            this.settings[settingKey] = value;

            console.log(`BufferManager: Parameter updated - ${paramId} (${settingKey}): ${oldValue} → ${value}`);
            this.emit('parameter-updated', { paramId, settingKey, oldValue, newValue: value });

            // Trigger recalculation of chunk size if needed
            if (paramId === 'silenceThreshold' || paramId === 'normalizationTarget') {
                if (this.buffer.length > 0) {
                    console.log(`BufferManager: Reprocessing buffer with updated parameter: ${paramId}`);
                    this.processAvailableChunks(Date.now());
                }
            }

            return { success: true, paramId, settingKey, value };
        } catch (error) {
            console.error(`BufferManager: Error updating parameter ${paramId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all audio processing parameters
     */
    getAudioParameters() {
        return {
            silenceThreshold: this.settings.silenceThreshold,
            normalizationTarget: this.settings.normalizationTarget,
            highPassCutoff: this.settings.highPassCutoffHz,
            agcTargetLevel: this.settings.agcTargetLevel,
            vadEnergyThreshold: this.settings.vadEnergyThreshold,
            enableNormalization: this.settings.enableNormalization,
            enableSilenceDetection: this.settings.enableSilenceDetection,
            enableAdvancedVAD: this.settings.enableAdvancedVAD,
            enableHighPassFilter: this.settings.enableHighPassFilter,
            enableAGC: this.settings.enableAGC
        };
    }

    /**
     * Clear all buffers and reset state
     */
    clear() {
        this.buffer = Buffer.alloc(0);
        this.chunks.clear();
        this.chunkCounter = 0;
        this.startTime = null;
        this.lastChunkTime = 0;
        
        console.log('BufferManager: Cleared all buffers');
        this.emit('buffer-cleared');
    }

    /**
     * Start cleanup timer to remove old chunks
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldChunks();
        }, this.settings.cleanupInterval);
    }

    /**
     * Clean up old chunks to prevent memory leaks
     */
    cleanupOldChunks() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        let removedCount = 0;

        for (const [chunkId, chunk] of this.chunks.entries()) {
            if (now - chunk.timestamp > maxAge) {
                this.chunks.delete(chunkId);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`BufferManager: Cleaned up ${removedCount} old chunks`);
            this.emit('chunks-cleaned', { removedCount });
        }
    }

    /**
     * Get memory usage statistics
     */
    getMemoryUsage() {
        const bufferMemory = this.buffer.length;
        const chunksMemory = Array.from(this.chunks.values())
            .reduce((total, chunk) => total + chunk.size, 0);
        
        return {
            bufferMemory,
            chunksMemory,
            totalMemory: bufferMemory + chunksMemory,
            chunkCount: this.chunks.size
        };
    }

    /**
     * Force garbage collection of processed chunks
     */
    forceCleanup() {
        this.cleanupOldChunks();
        
        // Also force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        this.emit('forced-cleanup-complete');
    }

    /**
     * Dispose of the buffer manager
     */
    dispose() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        
        this.clear();
        this.removeAllListeners();
        
        console.log('BufferManager: Disposed');
    }
}

module.exports = BufferManager;