const { nodewhisper } = require('nodejs-whisper');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');


class WhisperProcessor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.settings = {
            model: options.model || 'base.en',
            language: options.language || 'en',
            temperature: options.temperature || 0.0,
            max_len: options.max_len || 0,
            split_on_word: options.split_on_word !== false,
            speed_up: options.speed_up || false,
            translate: options.translate || false,
            suppress_blank: options.suppress_blank !== false,
            suppress_non_speech_tokens: options.suppress_non_speech_tokens !== false,
            max_queue_size: options.max_queue_size || 10
        };

        this.processingQueue = [];
        this.isProcessing = false;
        this.isInitialized = false;
        this.modelPath = null;
        this.tempDir = null;
        this.modelManager = null;
        this.processingStats = {
            totalProcessed: 0,
            totalErrors: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
        };
    }

    /**
     * Set the ModelManager instance
     */
    setModelManager(modelManager) {
        this.modelManager = modelManager;
    }

    /**
     * Initialize Whisper processor
     */
    async initialize() {
        try {
            console.log('WhisperProcessor: Initializing...');
            
            // Create temporary directory for audio files
            this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whisper-'));
            console.log(`WhisperProcessor: Created temp directory: ${this.tempDir}`);

            // Check if local model exists
            await this.checkLocalModel();

            // Skip Whisper test during initialization to avoid Node.js path issues
            // await this.testWhisperCapability();

            this.isInitialized = true;
            this.emit('initialized');
            console.log('WhisperProcessor: Initialized successfully');
            return true;

        } catch (error) {
            console.error('WhisperProcessor: Initialization failed:', error);
            this.emit('error', {
                type: 'initialization',
                message: 'Failed to initialize Whisper processor',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Check if local model exists and set model path
     */
    async checkLocalModel() {
        if (!this.modelManager) {
            console.warn('WhisperProcessor: ModelManager not set, using default model path');
            return;
        }

        try {
            const modelStatus = await this.modelManager.getModelStatus(this.settings.model);
            
            if (modelStatus.exists) {
                this.modelPath = modelStatus.path;
                console.log(`WhisperProcessor: Using local model at ${this.modelPath}`);
            } else {
                console.warn(`WhisperProcessor: Model ${this.settings.model} not found locally`);
                this.emit('model-not-found', {
                    model: this.settings.model,
                    message: `Model ${this.settings.model} needs to be downloaded`
                });
            }
        } catch (error) {
            console.error('WhisperProcessor: Error checking local model:', error);
        }
    }

    /**
     * Update model settings and check local availability
     */
    async updateModel(modelName) {
        this.settings.model = modelName;
        await this.checkLocalModel();
        
        this.emit('model-changed', {
            model: modelName,
            available: !!this.modelPath
        });
    }

    /**
     * Test Whisper capability with a small silent audio file
     */
    async testWhisperCapability() {
        try {
            // Create a small silent WAV file for testing
            const testFilePath = path.join(this.tempDir, 'test_silent.wav');
            await this.createSilentWavFile(testFilePath, 1.0); // 1 second of silence

            // Test transcription with simplified options
            const result = await nodewhisper(testFilePath, {
                modelName: this.settings.model,
                verbose: false,
                removeWavFileAfterTranscription: true,
                language: this.settings.language
            });

            // Clean up test file
            await fs.unlink(testFilePath);
            
            console.log('WhisperProcessor: Test transcription successful');
            return true;

        } catch (error) {
            throw new Error(`Whisper test failed: ${error.message}`);
        }
    }

    /**
     * Create a silent WAV file for testing
     */
    async createSilentWavFile(filePath, durationSeconds) {
        const sampleRate = 16000;
        const channels = 1;
        const bitsPerSample = 16;
        const dataSize = sampleRate * channels * (bitsPerSample / 8) * durationSeconds;
        const fileSize = 44 + dataSize;

        const buffer = Buffer.alloc(fileSize);
        let offset = 0;

        // WAV header
        buffer.write('RIFF', offset); offset += 4;
        buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
        buffer.write('WAVE', offset); offset += 4;
        buffer.write('fmt ', offset); offset += 4;
        buffer.writeUInt32LE(16, offset); offset += 4; // PCM header size
        buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
        buffer.writeUInt16LE(channels, offset); offset += 2;
        buffer.writeUInt32LE(sampleRate, offset); offset += 4;
        buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), offset); offset += 4;
        buffer.writeUInt16LE(channels * (bitsPerSample / 8), offset); offset += 2;
        buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
        buffer.write('data', offset); offset += 4;
        buffer.writeUInt32LE(dataSize, offset); offset += 4;

        // Silent audio data (zeros)
        buffer.fill(0, offset);

        await fs.writeFile(filePath, buffer);
    }

    /**
     * Add audio chunk to processing queue
     */
    async processChunk(chunk) {
        if (!this.isInitialized) {
            console.error('WhisperProcessor: Not initialized');
            return false;
        }

        if (this.processingQueue.length >= this.settings.max_queue_size) {
            console.warn('WhisperProcessor: Queue full, dropping oldest chunk');
            const dropped = this.processingQueue.shift();
            this.emit('chunk-dropped', { chunkId: dropped.id });
        }

        // Add chunk to queue
        this.processingQueue.push({
            ...chunk,
            queuedAt: Date.now()
        });

        console.log(`WhisperProcessor: Queued chunk ${chunk.id}, queue size: ${this.processingQueue.length}`);

        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }

        return true;
    }

    /**
     * Process the chunk queue
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log('WhisperProcessor: Starting queue processing');

        while (this.processingQueue.length > 0) {
            const chunk = this.processingQueue.shift();
            await this.processSingleChunk(chunk);
        }

        this.isProcessing = false;
        console.log('WhisperProcessor: Queue processing completed');
    }

    /**
     * Process a single audio chunk
     */
    async processSingleChunk(chunk) {
        const startTime = Date.now();
        let tempFilePath = null;

        try {
            console.log(`WhisperProcessor: Processing chunk ${chunk.id}`);

            // Convert PCM data to WAV file
            tempFilePath = path.join(this.tempDir, `chunk_${chunk.id}_${Date.now()}.wav`);
            await this.pcmToWav(chunk.data, tempFilePath, chunk.sampleRate);

            // Transcribe with Whisper - use just modelName, no auto-download
            const result = await nodewhisper(tempFilePath, {
                modelName: this.settings.model,
                verbose: false,
                removeWavFileAfterTranscription: true,
                language: this.settings.language
            });

            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, false);

            // Extract text and confidence
            const text = typeof result === 'string' ? result.trim() : 
                         Array.isArray(result) ? result.map(r => r.text || r.speech || '').join(' ').trim() : 
                         (result?.text || '').trim();
            const confidence = this.calculateConfidence(result);

            const transcriptionResult = {
                chunkId: chunk.id,
                text: text,
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                confidence: confidence,
                processingTime: processingTime,
                isFinal: true
            };

            this.emit('transcription-result', transcriptionResult);
            console.log(`WhisperProcessor: Completed chunk ${chunk.id} in ${processingTime}ms: "${text}"`);

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, true);

            console.error(`WhisperProcessor: Error processing chunk ${chunk.id}:`, error);
            this.emit('transcription-error', {
                chunkId: chunk.id,
                error: error.message,
                processingTime: processingTime
            });

        } finally {
            // Clean up temporary file
            if (tempFilePath) {
                try {
                    await fs.unlink(tempFilePath);
                } catch (cleanupError) {
                    console.warn(`WhisperProcessor: Failed to cleanup temp file: ${cleanupError.message}`);
                }
            }
        }
    }

    /**
     * Convert PCM data to WAV file
     */
    async pcmToWav(pcmData, outputPath, sampleRate = 16000) {
        const channels = 1;
        const bitsPerSample = 16;
        const dataSize = pcmData.length;
        const fileSize = 44 + dataSize;

        const buffer = Buffer.alloc(44 + dataSize);
        let offset = 0;

        // WAV header
        buffer.write('RIFF', offset); offset += 4;
        buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
        buffer.write('WAVE', offset); offset += 4;
        buffer.write('fmt ', offset); offset += 4;
        buffer.writeUInt32LE(16, offset); offset += 4;
        buffer.writeUInt16LE(1, offset); offset += 2; // PCM
        buffer.writeUInt16LE(channels, offset); offset += 2;
        buffer.writeUInt32LE(sampleRate, offset); offset += 4;
        buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), offset); offset += 4;
        buffer.writeUInt16LE(channels * (bitsPerSample / 8), offset); offset += 2;
        buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
        buffer.write('data', offset); offset += 4;
        buffer.writeUInt32LE(dataSize, offset); offset += 4;

        // Copy PCM data
        pcmData.copy(buffer, offset);

        await fs.writeFile(outputPath, buffer);
    }

    /**
     * Calculate confidence score from Whisper result
     */
    calculateConfidence(result) {
        if (!result || !Array.isArray(result)) {
            return 0.5; // Default confidence
        }

        // Extract confidence scores if available
        const confidences = result
            .filter(r => r.confidence !== undefined)
            .map(r => r.confidence);

        if (confidences.length === 0) {
            return 0.8; // Good default for successful transcription
        }

        // Return average confidence
        return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    }

    /**
     * Update processing statistics
     */
    updateProcessingStats(processingTime, isError) {
        this.processingStats.totalProcessed++;
        
        if (isError) {
            this.processingStats.totalErrors++;
        } else {
            this.processingStats.totalProcessingTime += processingTime;
            this.processingStats.averageProcessingTime = 
                this.processingStats.totalProcessingTime / 
                (this.processingStats.totalProcessed - this.processingStats.totalErrors);
        }

        this.emit('stats-updated', { ...this.processingStats });
    }

    /**
     * Update Whisper settings
     */
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };

        console.log('WhisperProcessor: Settings updated', this.settings);
        this.emit('settings-updated', this.settings);
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get processing status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            queueSize: this.processingQueue.length,
            stats: { ...this.processingStats },
            settings: this.getSettings()
        };
    }

    /**
     * Clear processing queue
     */
    clearQueue() {
        const droppedCount = this.processingQueue.length;
        this.processingQueue = [];
        
        console.log(`WhisperProcessor: Cleared queue, dropped ${droppedCount} chunks`);
        this.emit('queue-cleared', { droppedCount });
    }

    /**
     * Dispose of the processor
     */
    async dispose() {
        console.log('WhisperProcessor: Disposing...');
        
        this.clearQueue();
        
        // Clean up temporary directory
        if (this.tempDir) {
            try {
                const files = await fs.readdir(this.tempDir);
                for (const file of files) {
                    await fs.unlink(path.join(this.tempDir, file));
                }
                await fs.rmdir(this.tempDir);
                console.log(`WhisperProcessor: Cleaned up temp directory: ${this.tempDir}`);
            } catch (error) {
                console.warn(`WhisperProcessor: Failed to cleanup temp directory: ${error.message}`);
            }
        }

        this.removeAllListeners();
        this.isInitialized = false;
        
        console.log('WhisperProcessor: Disposed');
    }
}

module.exports = WhisperProcessor;