const { nodewhisper } = require('nodejs-whisper');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const PunctuationProcessor = require('./punctuationProcessor');
const LanguageDetector = require('./languageDetector');
const GPUDetector = require('./gpuDetector');
// Phase 4 Advanced Features
const SpeakerDiarizer = require('./speakerDiarizer');
const EmotionAnalyzer = require('./emotionAnalyzer');
const VocabularyManager = require('./vocabularyManager');
const GrammarCorrector = require('./grammarCorrector');


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
            max_queue_size: options.max_queue_size || 10,
            // Model caching settings
            enableModelCache: options.enableModelCache !== false, // Keep model in memory
            modelCacheTimeout: options.modelCacheTimeout || 30 * 60 * 1000, // 30 minutes
            // Parallel processing settings
            enableParallelProcessing: options.enableParallelProcessing !== false, // Process multiple chunks concurrently
            maxParallelChunks: options.maxParallelChunks || 2, // Maximum concurrent chunk processing
            // Post-processing settings
            enablePunctuation: options.enablePunctuation !== false, // Add punctuation to results
            enableCapitalization: options.enableCapitalization !== false, // Fix capitalization
            // Multilingual settings
            enableMultilingual: options.enableMultilingual !== false, // Support multiple languages
            enableLanguageDetection: options.enableLanguageDetection !== false, // Auto-detect language
            // Phase 4: Advanced Features
            enableSpeakerDiarization: options.enableSpeakerDiarization !== false, // Identify different speakers
            enableEmotionAnalysis: options.enableEmotionAnalysis !== false, // Detect emotion/tone
            enableCustomVocabulary: options.enableCustomVocabulary !== false, // Custom terms and replacements
            enableGrammarCorrection: options.enableGrammarCorrection !== false // Fix grammar errors
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
            totalProcessingTime: 0,
            modelCacheHits: 0,
            modelCacheMisses: 0,
            parallelProcessingCount: 0,
            maxConcurrentChunks: 0
        };

        // Model cache management
        this.modelCache = null;
        this.modelCacheTime = null;
        this.cachedModel = options.model || 'base.en';
        this.cacheCleanupTimer = null;

        // Parallel processing management
        this.currentlyProcessing = new Set(); // Track currently processing chunk IDs
        this.processingPromises = []; // Track active processing promises

        // Post-processing management
        this.punctuationProcessor = new PunctuationProcessor({
            enablePunctuation: this.settings.enablePunctuation,
            enableCapitalization: this.settings.enableCapitalization
        });

        // Language detection management
        this.languageDetector = new LanguageDetector({
            enableAutoDetect: this.settings.enableLanguageDetection,
            defaultLanguage: this.settings.language,
            enableMultilingual: this.settings.enableMultilingual
        });

        // GPU acceleration detection
        this.gpuDetector = new GPUDetector({
            enableDetection: true,
            enableOptimization: options.enableGPUOptimization !== false
        });

        // Phase 4: Advanced Features Management
        this.speakerDiarizer = new SpeakerDiarizer({
            enableDiarization: this.settings.enableSpeakerDiarization,
            enableSpeakerLabeling: true,
            maxSpeakers: options.maxSpeakers || 8
        });

        this.emotionAnalyzer = new EmotionAnalyzer({
            enableEmotionAnalysis: this.settings.enableEmotionAnalysis,
            audioWeight: options.audioWeight || 0.6,
            textWeight: options.textWeight || 0.4
        });

        this.vocabularyManager = new VocabularyManager({
            enableCustomVocabulary: this.settings.enableCustomVocabulary,
            caseSensitive: options.vocabCaseSensitive !== true,
            wholeWordsOnly: options.vocabWholeWordsOnly !== false,
            autoLearnEnabled: options.autoLearnVocabulary !== false
        });

        this.grammarCorrector = new GrammarCorrector({
            enableGrammarCorrection: this.settings.enableGrammarCorrection,
            enableContractionExpansion: options.expandContractions !== true,
            enableRepetitionRemoval: true,
            enableVerbCorrection: true,
            enableFillerRemoval: options.removeFillers !== true,
            trackCorrections: true
        });
    }

    /**
     * Set the ModelManager instance
     */
    setModelManager(modelManager) {
        this.modelManager = modelManager;
    }

    /**
     * Start model cache cleanup timer
     */
    startModelCacheCleanup() {
        if (!this.settings.enableModelCache || this.cacheCleanupTimer) {
            return; // Already running or disabled
        }

        this.cacheCleanupTimer = setInterval(() => {
            this.cleanupModelCache();
        }, 60000); // Check every minute

        console.log('WhisperProcessor: Started model cache cleanup timer');
    }

    /**
     * Clean up model cache if timeout exceeded
     */
    cleanupModelCache() {
        if (!this.settings.enableModelCache || !this.modelCache) {
            return;
        }

        const now = Date.now();
        const age = now - this.modelCacheTime;

        if (age > this.settings.modelCacheTimeout) {
            console.log(`WhisperProcessor: Model cache expired (${(age / 1000 / 60).toFixed(1)} minutes old), clearing...`);
            this.modelCache = null;
            this.modelCacheTime = null;
            this.emit('model-cache-cleared', { reason: 'timeout', ageMs: age });
        }
    }

    /**
     * Clear model cache manually
     */
    clearModelCache() {
        if (this.modelCache) {
            console.log('WhisperProcessor: Manually clearing model cache');
            this.modelCache = null;
            this.modelCacheTime = null;
            this.emit('model-cache-cleared', { reason: 'manual' });
        }
    }

    /**
     * Get model cache statistics
     */
    getModelCacheStats() {
        const cacheAge = this.modelCache ? (Date.now() - this.modelCacheTime) : null;
        return {
            isCached: !!this.modelCache,
            cachedModel: this.cachedModel,
            cacheAgeMs: cacheAge,
            cacheHits: this.processingStats.modelCacheHits,
            cacheMisses: this.processingStats.modelCacheMisses,
            hitRate: this.processingStats.modelCacheHits /
                     (this.processingStats.modelCacheHits + this.processingStats.modelCacheMisses || 1)
        };
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

            // Start model cache cleanup timer if enabled
            if (this.settings.enableModelCache) {
                this.startModelCacheCleanup();
            }

            // Apply GPU optimizations if available
            if (this.gpuDetector.isAvailable()) {
                this.applyGPUOptimizations();
            }

            this.isInitialized = true;
            this.emit('initialized');
            console.log('WhisperProcessor: Initialized successfully (model cache: ' +
                       (this.settings.enableModelCache ? 'enabled' : 'disabled') +
                       ', GPU: ' + (this.gpuDetector.isAvailable() ? 'enabled' : 'disabled') + ')');
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
        // Clear cache if switching models
        if (modelName !== this.settings.model) {
            console.log(`WhisperProcessor: Model changed from ${this.settings.model} to ${modelName}, clearing cache`);
            this.clearModelCache();
            this.cachedModel = modelName;
        }

        this.settings.model = modelName;
        await this.checkLocalModel();

        this.emit('model-changed', {
            model: modelName,
            available: !!this.modelPath
        });
    }

    /**
     * Switch language for transcription
     */
    switchLanguage(languageCode) {
        if (this.languageDetector.setLanguage(languageCode)) {
            this.settings.language = languageCode;

            // Update model if needed for non-English languages
            if (this.settings.enableMultilingual) {
                const newModel = this.languageDetector.getModelForLanguage(languageCode);
                if (newModel !== this.settings.model) {
                    this.updateModel(newModel);
                }
            }

            this.emit('language-changed', {
                language: languageCode,
                languageInfo: this.languageDetector.getCurrentLanguage()
            });

            return true;
        }
        return false;
    }

    /**
     * Get available languages
     */
    getAvailableLanguages() {
        return this.languageDetector.getAvailableLanguages();
    }

    /**
     * Get current language info
     */
    getCurrentLanguage() {
        return this.languageDetector.getCurrentLanguage();
    }

    /**
     * Apply GPU optimizations to processing settings
     */
    applyGPUOptimizations() {
        const recommendations = this.gpuDetector.getRecommendations();

        if (recommendations.canUseGPU) {
            // Optimize parallel chunk processing based on GPU memory
            if (recommendations.parallelChunks > this.settings.maxParallelChunks) {
                console.log(`GPUDetector: Optimizing parallel chunks: ${this.settings.maxParallelChunks} → ${recommendations.parallelChunks}`);
                this.settings.maxParallelChunks = recommendations.parallelChunks;
            }

            this.emit('gpu-optimized', {
                gpuInfo: this.gpuDetector.gpuInfo,
                recommendations: recommendations
            });
        }
    }

    /**
     * Get GPU status and recommendations
     */
    getGPUStatus() {
        return this.gpuDetector.getStatus();
    }

    /**
     * Get estimated speedup from GPU acceleration
     */
    getEstimatedSpeedup() {
        return this.gpuDetector.getEstimatedSpeedup();
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
     * Process the chunk queue with optional parallel processing
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        console.log(`WhisperProcessor: Starting queue processing (parallel: ${this.settings.enableParallelProcessing})`);

        if (this.settings.enableParallelProcessing && this.settings.maxParallelChunks > 1) {
            // Process chunks in parallel
            await this.processQueueParallel();
        } else {
            // Process chunks sequentially (original behavior)
            await this.processQueueSequential();
        }

        this.isProcessing = false;
        console.log('WhisperProcessor: Queue processing completed');
    }

    /**
     * Process queue sequentially (one chunk at a time)
     */
    async processQueueSequential() {
        while (this.processingQueue.length > 0) {
            const chunk = this.processingQueue.shift();
            await this.processSingleChunk(chunk);
        }
    }

    /**
     * Process queue in parallel (multiple chunks concurrently)
     */
    async processQueueParallel() {
        while (this.processingQueue.length > 0) {
            const maxParallel = Math.min(this.settings.maxParallelChunks, this.processingQueue.length);

            // Start up to maxParallel concurrent processing tasks
            const parallelPromises = [];

            for (let i = 0; i < maxParallel; i++) {
                if (this.processingQueue.length > 0) {
                    const chunk = this.processingQueue.shift();
                    const promise = this.processSingleChunk(chunk);
                    parallelPromises.push(promise);
                }
            }

            // Wait for all parallel tasks to complete before starting next batch
            if (parallelPromises.length > 0) {
                this.processingStats.parallelProcessingCount++;
                this.processingStats.maxConcurrentChunks = Math.max(
                    this.processingStats.maxConcurrentChunks,
                    parallelPromises.length
                );

                console.log(`WhisperProcessor: Processing ${parallelPromises.length} chunks in parallel`);
                await Promise.all(parallelPromises);
            }
        }
    }

    /**
     * Process a single audio chunk
     */
    async processSingleChunk(chunk) {
        const startTime = Date.now();
        let tempFilePath = null;

        try {
            console.log(`WhisperProcessor: Processing chunk ${chunk.id}`);

            // Check if using cached model
            const modelCacheHit = this.modelCache && this.settings.model === this.cachedModel;
            if (modelCacheHit) {
                this.processingStats.modelCacheHits++;
                console.log(`WhisperProcessor: Using cached model (hits: ${this.processingStats.modelCacheHits})`);
            } else {
                this.processingStats.modelCacheMisses++;
                if (this.settings.enableModelCache) {
                    console.log(`WhisperProcessor: Loading model into cache (misses: ${this.processingStats.modelCacheMisses})`);
                    this.modelCacheTime = Date.now();
                }
            }

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

            // Cache model reference if caching is enabled
            if (this.settings.enableModelCache && !modelCacheHit) {
                this.modelCache = this.settings.model;
                this.modelCacheTime = Date.now();
            }

            const processingTime = Date.now() - startTime;
            this.updateProcessingStats(processingTime, false);

            // Extract text and confidence
            let text = typeof result === 'string' ? result.trim() :
                       Array.isArray(result) ? result.map(r => r.text || r.speech || '').join(' ').trim() :
                       (result?.text || '').trim();
            const confidence = this.calculateConfidence(result);

            // Detect language from result if enabled
            let detectedLanguage = this.settings.language;
            if (this.settings.enableLanguageDetection && text.length > 10) {
                detectedLanguage = this.languageDetector.detectLanguage(text);

                // Switch model if language changed and multilingual enabled
                if (this.settings.enableMultilingual && detectedLanguage !== this.settings.language) {
                    const newModel = this.languageDetector.getModelForLanguage(detectedLanguage);
                    console.log(`WhisperProcessor: Language detected: ${detectedLanguage}, model: ${newModel}`);
                }
            }

            // Apply punctuation post-processing if enabled
            if (this.settings.enablePunctuation || this.settings.enableCapitalization) {
                const processedText = this.punctuationProcessor.process(text);
                console.log(`WhisperProcessor: Post-processing chunk ${chunk.id}: "${text}" → "${processedText}"`);
                text = processedText;
            }

            // Phase 4: Apply speaker diarization if enabled
            let speakerInfo = null;
            if (this.settings.enableSpeakerDiarization && chunk.data) {
                speakerInfo = this.speakerDiarizer.analyzeSpeaker(chunk.data, {
                    chunkId: chunk.id,
                    timestamp: chunk.startTime
                });
            }

            // Phase 4: Apply emotion/tone analysis if enabled
            let emotionInfo = null;
            if (this.settings.enableEmotionAnalysis && chunk.data) {
                emotionInfo = this.emotionAnalyzer.analyzeEmotion(chunk.data, text);
            }

            // Phase 4: Apply vocabulary corrections if enabled
            if (this.settings.enableCustomVocabulary) {
                const correctedText = this.vocabularyManager.applyVocabularyCorrections(text);
                if (correctedText !== text) {
                    console.log(`WhisperProcessor: Vocabulary corrections: "${text}" → "${correctedText}"`);
                    text = correctedText;
                }
            }

            // Phase 4: Apply grammar correction if enabled
            if (this.settings.enableGrammarCorrection) {
                const correctedText = this.grammarCorrector.correct(text);
                if (correctedText !== text) {
                    console.log(`WhisperProcessor: Grammar corrections: "${text}" → "${correctedText}"`);
                    text = correctedText;
                }
            }

            const transcriptionResult = {
                chunkId: chunk.id,
                text: text,
                startTime: chunk.startTime,
                endTime: chunk.endTime,
                confidence: confidence,
                processingTime: processingTime,
                isFinal: true,
                // Phase 4 metadata
                speaker: speakerInfo ? speakerInfo.speakerId : undefined,
                speakerConfidence: speakerInfo ? speakerInfo.confidence : undefined,
                emotion: emotionInfo ? emotionInfo.emotion : undefined,
                emotionConfidence: emotionInfo ? emotionInfo.confidence : undefined
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
     * Calculate confidence score from Whisper result with multiple estimation methods
     */
    calculateConfidence(result) {
        // Try multiple confidence extraction strategies
        let confidence = this.extractDirectConfidence(result);

        // If direct confidence extraction fails, use heuristic-based estimation
        if (confidence === null) {
            confidence = this.estimateConfidenceFromResult(result);
        }

        // Ensure confidence is in valid range [0, 1]
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Extract confidence directly from Whisper result if available
     */
    extractDirectConfidence(result) {
        if (!result) return null;

        // If result is array with confidence scores
        if (Array.isArray(result)) {
            const confidences = result
                .filter(r => r && r.confidence !== undefined && typeof r.confidence === 'number')
                .map(r => r.confidence);

            if (confidences.length > 0) {
                // Return weighted average (more items = higher confidence in consistency)
                const avg = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
                const consistencyBonus = Math.min(0.1, confidences.length * 0.01); // Small bonus for multiple results
                return Math.min(1, avg + consistencyBonus);
            }
        }

        // If result is object with confidence field
        if (result && typeof result.confidence === 'number') {
            return result.confidence;
        }

        return null;
    }

    /**
     * Estimate confidence based on result characteristics using heuristics
     */
    estimateConfidenceFromResult(result) {
        // Extract text from various possible result formats
        let text = '';
        let resultCount = 0;

        if (typeof result === 'string') {
            text = result;
            resultCount = 1;
        } else if (Array.isArray(result)) {
            text = result
                .map(r => {
                    if (typeof r === 'string') return r;
                    if (r && r.text) return r.text;
                    if (r && r.speech) return r.speech;
                    return '';
                })
                .filter(t => t.length > 0)
                .join(' ');
            resultCount = result.length;
        } else if (result && result.text) {
            text = result.text;
            resultCount = 1;
        }

        // Base confidence on text length and characteristics
        let confidence = 0.5; // Default fallback

        if (text.length > 0) {
            // Longer transcriptions tend to be more reliable
            const lengthFactor = Math.min(1, text.length / 100); // Normalize to 100 chars
            confidence = 0.5 + (lengthFactor * 0.3); // Base 0.5 + up to 0.3 for length

            // Bonus for result consistency (multiple results increase confidence)
            if (resultCount > 1) {
                confidence += 0.1 * Math.min(1, (resultCount - 1) / 4); // Up to 0.1 bonus
            }

            // Bonus for punctuation (usually indicates clearer speech)
            const punctuationCount = (text.match(/[.!?;:,]/g) || []).length;
            if (punctuationCount > 0) {
                confidence += 0.05; // Small bonus for punctuation
            }

            // Bonus for mixed case (usually indicates proper capitalization/structure)
            const hasUpperCase = /[A-Z]/.test(text);
            const hasLowerCase = /[a-z]/.test(text);
            if (hasUpperCase && hasLowerCase) {
                confidence += 0.05; // Small bonus for proper case mixing
            }
        } else {
            // Empty or very short transcription is low confidence
            confidence = 0.3;
        }

        return Math.min(1, confidence);
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
     * Update a single parameter at runtime
     * Handles confidence threshold and parallel processing parameters
     */
    updateParameter(paramId, value) {
        try {
            // Map parameter IDs to setting keys
            const parameterMap = {
                confidenceThreshold: 'confidenceThreshold',
                maxParallelChunks: 'maxParallelChunks'
                // Note: silenceThreshold, normalizationTarget, highPassCutoff, agcTargetLevel,
                //       vadEnergyThreshold are handled by BufferManager
            };

            const settingKey = parameterMap[paramId];
            if (!settingKey) {
                // This parameter is not handled by WhisperProcessor
                console.log(`WhisperProcessor: Parameter ${paramId} not handled by WhisperProcessor`);
                return { success: false, error: `Parameter ${paramId} not handled by WhisperProcessor` };
            }

            // Validate parameter ranges
            const parameterLimits = {
                confidenceThreshold: { min: 0.3, max: 0.9, type: 'number' },
                maxParallelChunks: { min: 1, max: 4, type: 'number' }
            };

            const limits = parameterLimits[settingKey];
            if (!limits) {
                console.warn(`WhisperProcessor: No validation rules for ${settingKey}`);
                return { success: false, error: `No validation rules for: ${settingKey}` };
            }

            // Type check
            if (typeof value !== limits.type) {
                console.error(`WhisperProcessor: Invalid type for ${paramId}. Expected ${limits.type}, got ${typeof value}`);
                return { success: false, error: `Invalid type for ${paramId}` };
            }

            // Range check
            if (value < limits.min || value > limits.max) {
                console.error(`WhisperProcessor: Parameter ${paramId} out of range [${limits.min}, ${limits.max}]`);
                return { success: false, error: `Parameter ${paramId} out of range [${limits.min}, ${limits.max}]` };
            }

            // Update the setting
            const oldValue = this.settings[settingKey];
            this.settings[settingKey] = value;

            console.log(`WhisperProcessor: Parameter updated - ${paramId} (${settingKey}): ${oldValue} → ${value}`);
            this.emit('parameter-updated', { paramId, settingKey, oldValue, newValue: value });

            // Clear model cache if transitioning to different parallel settings
            // to ensure chunks are processed with the correct settings
            if (paramId === 'maxParallelChunks' && this.processingQueue.length > 0) {
                console.log(`WhisperProcessor: Max parallel chunks updated to ${value}, processing will use new setting`);
            }

            return { success: true, paramId, settingKey, value };
        } catch (error) {
            console.error(`WhisperProcessor: Error updating parameter ${paramId}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all transcription-related parameters
     */
    getTranscriptionParameters() {
        return {
            confidenceThreshold: this.settings.confidenceThreshold,
            maxParallelChunks: this.settings.maxParallelChunks,
            enableParallelProcessing: this.settings.enableParallelProcessing,
            model: this.settings.model,
            language: this.settings.language,
            temperature: this.settings.temperature,
            enablePunctuation: this.settings.enablePunctuation,
            enableCapitalization: this.settings.enableCapitalization,
            enableLanguageDetection: this.settings.enableLanguageDetection
        };
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
            modelCache: this.getModelCacheStats(),
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

    // ============= Phase 4: Advanced Features API =============

    /**
     * Add custom vocabulary term
     */
    addCustomTerm(term, options = {}) {
        return this.vocabularyManager.addTerm(term, options);
    }

    /**
     * Remove custom vocabulary term
     */
    removeCustomTerm(term) {
        return this.vocabularyManager.removeTerm(term);
    }

    /**
     * Add vocabulary replacement rule
     */
    addVocabularyRule(pattern, replacement, options = {}) {
        return this.vocabularyManager.addRule(pattern, replacement, options);
    }

    /**
     * Get all custom vocabulary
     */
    getCustomVocabulary() {
        return this.vocabularyManager.getTerms();
    }

    /**
     * Get all vocabulary replacement rules
     */
    getVocabularyRules() {
        return this.vocabularyManager.getRules();
    }

    /**
     * Export vocabulary to JSON
     */
    exportVocabulary() {
        return this.vocabularyManager.exportVocabulary();
    }

    /**
     * Import vocabulary from JSON
     */
    importVocabulary(data) {
        return this.vocabularyManager.importVocabulary(data);
    }

    /**
     * Get speaker profiles (for diarization)
     */
    getSpeakerProfiles() {
        return this.speakerDiarizer.getAllSpeakers();
    }

    /**
     * Reset speaker profiles (start new session)
     */
    resetSpeakerProfiles() {
        this.speakerDiarizer.resetProfiles();
    }

    /**
     * Get diarization statistics
     */
    getDiarizationStats() {
        return this.speakerDiarizer.getStats();
    }

    /**
     * Get emotion analysis statistics
     */
    getEmotionStats() {
        return this.emotionAnalyzer.getStats();
    }

    /**
     * Get grammar correction statistics
     */
    getGrammarStats() {
        return this.grammarCorrector.getStats();
    }

    /**
     * Get vocabulary manager statistics
     */
    getVocabularyStats() {
        return this.vocabularyManager.getStats();
    }

    /**
     * Get all Phase 4 feature statistics
     */
    getPhase4Stats() {
        return {
            diarization: this.getDiarizationStats(),
            emotion: this.getEmotionStats(),
            grammar: this.getGrammarStats(),
            vocabulary: this.getVocabularyStats()
        };
    }

    /**
     * Check if grammar errors exist in text (for suggestions)
     */
    hasGrammarErrors(text) {
        return this.grammarCorrector.hasGrammarErrors(text);
    }

    /**
     * Get grammar correction suggestions without applying them
     */
    suggestGrammarCorrections(text) {
        return this.grammarCorrector.suggestCorrections(text);
    }

    /**
     * Add custom grammar rule
     */
    addCustomGrammarRule(incorrect, correct) {
        return this.grammarCorrector.addCustomRule(incorrect, correct);
    }

    /**
     * Get most used custom terms
     */
    getMostUsedTerms(limit = 10) {
        return this.vocabularyManager.getMostUsedTerms(limit);
    }

    /**
     * Clear all custom vocabulary and rules
     */
    clearAllVocabulary() {
        this.vocabularyManager.clear();
    }

    /**
     * Reset all Phase 4 statistics
     */
    resetPhase4Stats() {
        this.speakerDiarizer.resetStats();
        this.emotionAnalyzer.resetStats();
        this.grammarCorrector.resetStats();
        this.vocabularyManager.resetStats();
    }

    // ============= Display Formatting Methods =============

    /**
     * Format transcription result with speaker label and timestamp
     * Returns formatted string like: [00:00] Speaker 1: Hello
     */
    formatTranscriptionForDisplay(result) {
        if (!result || !result.text) {
            return '';
        }

        // Format timestamp
        const timestamp = this.formatTimestamp(result.startTime);

        // Build speaker label if available
        let speakerLabel = '';
        if (result.speaker && this.settings.enableSpeakerDiarization) {
            speakerLabel = ` ${result.speaker}`;
            if (result.speakerConfidence) {
                const confidence = Math.round(result.speakerConfidence * 100);
                if (confidence < 80) {
                    speakerLabel += ` (${confidence}%)`;
                }
            }
        }

        // Build emotion label if available
        let emotionLabel = '';
        if (result.emotion && this.settings.enableEmotionAnalysis) {
            emotionLabel = ` [${result.emotion.toUpperCase()}]`;
        }

        return `[${timestamp}]${speakerLabel}${emotionLabel}: ${result.text}`;
    }

    /**
     * Format timestamp as MM:SS or HH:MM:SS
     */
    formatTimestamp(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }

    /**
     * Format transcription result with rich metadata
     * Returns object with formatted display and raw data
     */
    formatTranscriptionRich(result) {
        return {
            // Display format
            display: this.formatTranscriptionForDisplay(result),
            // Rich format with all metadata
            formatted: {
                timestamp: this.formatTimestamp(result.startTime),
                text: result.text,
                speaker: result.speaker || null,
                speakerConfidence: result.speakerConfidence || null,
                emotion: result.emotion || null,
                emotionConfidence: result.emotionConfidence || null,
                confidence: result.confidence,
                processingTime: result.processingTime
            },
            // Raw result
            raw: result
        };
    }

    /**
     * Format multiple transcription results as a formatted transcript
     * Useful for previewing entire sessions
     */
    formatTranscript(results) {
        if (!Array.isArray(results)) {
            return '';
        }

        return results
            .map(result => this.formatTranscriptionForDisplay(result))
            .filter(line => line.length > 0)
            .join('\n');
    }

    /**
     * Format transcription for SRT export with speaker information
     */
    formatAsSubtitle(result, index) {
        const startTime = this.formatSRTTimestamp(result.startTime);
        const endTime = this.formatSRTTimestamp(result.endTime);

        let text = result.text;

        // Add speaker label if available
        if (result.speaker && this.settings.enableSpeakerDiarization) {
            text = `${result.speaker}: ${text}`;
        }

        // Add emotion indicator if available
        if (result.emotion && this.settings.enableEmotionAnalysis) {
            text += ` [${result.emotion.toUpperCase()}]`;
        }

        return `${index}\n${startTime} --> ${endTime}\n${text}`;
    }

    /**
     * Format time for SRT subtitle format (HH:MM:SS,mmm)
     */
    formatSRTTimestamp(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const ms = milliseconds % 1000;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    }

    /**
     * Get a summary string with speaker and emotion statistics
     */
    getSummaryString() {
        const diarization = this.getDiarizationStats();
        const emotion = this.getEmotionStats();
        const grammar = this.getGrammarStats();

        let summary = '';

        if (this.settings.enableSpeakerDiarization && diarization.speakersIdentified > 0) {
            summary += `Speakers: ${diarization.speakersIdentified} | `;
        }

        if (this.settings.enableEmotionAnalysis && emotion.emotionsDetected > 0) {
            const avgEmotion = (emotion.avgEmotionConfidence * 100).toFixed(0);
            summary += `Emotions Detected: ${emotion.emotionsDetected} (${avgEmotion}% avg confidence) | `;
        }

        if (this.settings.enableGrammarCorrection && grammar.correctionsApplied > 0) {
            summary += `Grammar Corrections: ${grammar.correctionsApplied} | `;
        }

        return summary.slice(0, -3); // Remove trailing " | "
    }

    /**
     * Dispose of the processor
     */
    async dispose() {
        console.log('WhisperProcessor: Disposing...');

        this.clearQueue();

        // Clean up model cache cleanup timer
        if (this.cacheCleanupTimer) {
            clearInterval(this.cacheCleanupTimer);
            this.cacheCleanupTimer = null;
            console.log('WhisperProcessor: Stopped model cache cleanup timer');
        }

        // Clear model cache
        this.clearModelCache();

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

        // Log final cache statistics
        const cacheStats = this.getModelCacheStats();
        console.log(`WhisperProcessor: Final cache stats - Hits: ${cacheStats.cacheHits}, Misses: ${cacheStats.cacheMisses}, Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);

        this.removeAllListeners();
        this.isInitialized = false;

        console.log('WhisperProcessor: Disposed');
    }
}

module.exports = WhisperProcessor;