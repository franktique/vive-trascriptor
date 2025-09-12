const Recording = require('node-record-lpcm16-v2').default;
const { EventEmitter } = require('events');

class AudioManager extends EventEmitter {
    constructor() {
        super();
        this.isRecording = false;
        this.recordingInstance = null;
        this.audioStream = null;
        this.settings = {
            recorder: 'sox',
            sampleRate: 16000,
            channels: 1,
            audioType: 'wav',
            threshold: 0.5,
            silence: '1.0',
            device: null // null for default device
        };
    }

    /**
     * Initialize audio manager and check dependencies
     */
    async initialize() {
        try {
            // Test if recording is available
            await this.testRecordingCapability();
            this.emit('initialized');
            console.log('AudioManager initialized successfully');
            return true;
        } catch (error) {
            console.error('AudioManager initialization failed:', error);
            this.emit('error', {
                type: 'initialization',
                message: 'Failed to initialize audio recording',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Test if recording capability is available
     */
    async testRecordingCapability() {
        return new Promise((resolve, reject) => {
            try {
                const testRecording = new Recording({
                    ...this.settings,
                    verbose: false
                });

                testRecording.start();
                
                // Test for 100ms then stop
                setTimeout(() => {
                    testRecording.stop();
                    resolve(true);
                }, 100);

                testRecording.stream().on('error', (error) => {
                    reject(new Error(`Recording test failed: ${error.message}`));
                });

            } catch (error) {
                reject(new Error(`Recording capability test failed: ${error.message}`));
            }
        });
    }

    /**
     * Start audio recording
     */
    startRecording() {
        if (this.isRecording) {
            console.warn('Recording already in progress');
            return false;
        }

        try {
            console.log('Starting audio recording with settings:', this.settings);
            
            this.recordingInstance = new Recording(this.settings);
            this.recordingInstance.start();
            this.audioStream = this.recordingInstance.stream();
            this.isRecording = true;

            // Set up stream event handlers
            this.setupStreamHandlers();

            this.emit('recording-started');
            console.log('Audio recording started successfully');
            return true;

        } catch (error) {
            console.error('Failed to start recording:', error);
            this.emit('error', {
                type: 'recording-start',
                message: 'Failed to start audio recording',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Stop audio recording
     */
    stopRecording() {
        if (!this.isRecording) {
            console.warn('No recording in progress');
            return false;
        }

        try {
            if (this.recordingInstance) {
                this.recordingInstance.stop();
            }

            this.cleanup();
            this.emit('recording-stopped');
            console.log('Audio recording stopped successfully');
            return true;

        } catch (error) {
            console.error('Failed to stop recording:', error);
            this.emit('error', {
                type: 'recording-stop',
                message: 'Failed to stop audio recording',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Pause audio recording
     */
    pauseRecording() {
        if (!this.isRecording) {
            console.warn('No recording in progress to pause');
            return false;
        }

        try {
            if (this.recordingInstance) {
                this.recordingInstance.pause();
            }
            
            this.emit('recording-paused');
            console.log('Audio recording paused');
            return true;

        } catch (error) {
            console.error('Failed to pause recording:', error);
            this.emit('error', {
                type: 'recording-pause',
                message: 'Failed to pause audio recording',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Resume audio recording
     */
    resumeRecording() {
        if (!this.isRecording) {
            console.warn('No recording to resume');
            return false;
        }

        try {
            if (this.recordingInstance) {
                this.recordingInstance.resume();
            }
            
            this.emit('recording-resumed');
            console.log('Audio recording resumed');
            return true;

        } catch (error) {
            console.error('Failed to resume recording:', error);
            this.emit('error', {
                type: 'recording-resume',
                message: 'Failed to resume audio recording',
                details: error.message
            });
            return false;
        }
    }

    /**
     * Set up audio stream event handlers
     */
    setupStreamHandlers() {
        if (!this.audioStream) return;

        this.audioStream.on('data', (chunk) => {
            // Emit audio data for processing
            this.emit('audio-data', {
                data: chunk,
                timestamp: Date.now(),
                sampleRate: this.settings.sampleRate,
                format: 'pcm16'
            });

            // Calculate and emit audio level for UI
            const audioLevel = this.calculateAudioLevel(chunk);
            this.emit('audio-level', audioLevel);
        });

        this.audioStream.on('error', (error) => {
            console.error('Audio stream error:', error);
            this.emit('error', {
                type: 'stream',
                message: 'Audio stream error',
                details: error.message
            });
            this.cleanup();
        });

        this.audioStream.on('end', () => {
            console.log('Audio stream ended');
            this.emit('stream-ended');
            this.cleanup();
        });
    }

    /**
     * Calculate audio level for visualization
     */
    calculateAudioLevel(buffer) {
        if (!buffer || buffer.length === 0) return 0;

        let sum = 0;
        const samples = buffer.length / 2; // 16-bit samples

        for (let i = 0; i < buffer.length; i += 2) {
            // Read 16-bit sample
            const sample = buffer.readInt16LE(i);
            sum += Math.abs(sample);
        }

        const average = sum / samples;
        const normalized = Math.min(average / 32768, 1.0); // Normalize to 0-1
        return normalized;
    }

    /**
     * Update audio settings
     */
    updateSettings(newSettings) {
        const wasRecording = this.isRecording;
        
        if (wasRecording) {
            this.stopRecording();
        }

        this.settings = {
            ...this.settings,
            ...newSettings
        };

        console.log('Audio settings updated:', this.settings);
        this.emit('settings-updated', this.settings);

        // Restart recording if it was running
        if (wasRecording) {
            setTimeout(() => {
                this.startRecording();
            }, 500);
        }
    }

    /**
     * Get current audio settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            settings: this.getSettings(),
            hasStream: !!this.audioStream
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.isRecording = false;
        this.audioStream = null;
        this.recordingInstance = null;
    }

    /**
     * Dispose of the audio manager
     */
    dispose() {
        this.stopRecording();
        this.removeAllListeners();
        console.log('AudioManager disposed');
    }
}

module.exports = AudioManager;