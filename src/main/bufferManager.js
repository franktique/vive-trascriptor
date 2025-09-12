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
            cleanupInterval: options.cleanupInterval || 30000 // 30 seconds
        };

        this.buffer = Buffer.alloc(0);
        this.chunks = new Map(); // Store processed chunks with timestamps
        this.chunkCounter = 0;
        this.startTime = null;
        this.lastChunkTime = 0;
        this.cleanupTimer = null;

        this.calculateChunkSize();
        this.startCleanupTimer();
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
            const chunkData = this.buffer.subarray(0, this.chunkSizeBytes);
            
            // Create chunk object
            const chunk = {
                id: chunkId,
                data: Buffer.from(chunkData), // Create copy
                startTime: chunkStartTime,
                endTime: chunkStartTime + this.settings.chunkDurationMs,
                size: chunkData.length,
                sampleRate: this.settings.sampleRate,
                timestamp: currentTimestamp
            };

            // Store chunk for reference
            this.chunks.set(chunkId, chunk);

            // Emit chunk for processing
            this.emit('chunk-ready', chunk);

            // Remove processed data from buffer, keeping overlap
            const removeBytes = Math.max(this.chunkSizeBytes - this.overlapSizeBytes, 0);
            this.buffer = this.buffer.subarray(removeBytes);

            this.lastChunkTime = currentTimestamp;
            
            console.log(`BufferManager: Processed chunk ${chunkId}, remaining buffer: ${this.buffer.length} bytes`);
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