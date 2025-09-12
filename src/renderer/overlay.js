class WhisperOverlay {
    constructor() {
        this.isRecording = false;
        this.transcriptData = [];
        this.currentTranscript = '';
        this.startTime = null;
        this.srtCounter = 1;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeTranscription();
    }

    initializeElements() {
        this.statusText = document.getElementById('status-text');
        this.recordingIndicator = document.getElementById('recording-indicator');
        this.transcriptDisplay = document.getElementById('transcript-text');
        this.currentText = document.getElementById('current-text');
        
        // Recording controls
        this.startRecordingBtn = document.getElementById('start-recording-btn');
        this.stopRecordingBtn = document.getElementById('stop-recording-btn');
        this.pauseRecordingBtn = document.getElementById('pause-recording-btn');
        
        // Window controls
        this.showControlsBtn = document.getElementById('show-controls-btn');
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.closeBtn = document.getElementById('close-btn');
        
        // Initialize recording state
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.isPaused = false;
    }

    setupEventListeners() {
        // Recording controls
        this.startRecordingBtn.addEventListener('click', () => {
            this.startRecording();
        });

        this.stopRecordingBtn.addEventListener('click', () => {
            this.stopRecording();
        });

        this.pauseRecordingBtn.addEventListener('click', () => {
            this.pauseRecording();
        });

        // Window controls
        this.showControlsBtn.addEventListener('click', () => {
            window.electronAPI.showControls();
        });

        this.minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeOverlay();
        });

        this.closeBtn.addEventListener('click', () => {
            window.electronAPI.closeOverlay();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.toggleRecording();
            } else if (event.key === 'Enter' && event.metaKey) {
                this.saveTranscript();
            }
        });

        // Transcription event listeners
        window.electronAPI.onTranscriptionData((event, data) => {
            this.handleTranscriptionData(data);
        });

        window.electronAPI.onTranscriptionError((event, error) => {
            this.handleTranscriptionError(error);
        });

        window.electronAPI.onTranscriptionStatus((event, status) => {
            this.handleTranscriptionStatus(status);
        });

        // Theme management
        if (window.electronAPI.onThemeChanged) {
            window.electronAPI.onThemeChanged((event, theme) => {
                this.applyTheme(theme);
            });
        }

        // Load initial theme
        this.loadTheme();
    }

    async initializeTranscription() {
        try {
            const hasPermission = await window.electronAPI.checkMicrophonePermission();
            
            if (!hasPermission) {
                this.updateStatus('Microphone permission required', 'error');
                const granted = await window.electronAPI.requestMicrophonePermission();
                
                if (!granted) {
                    this.updateStatus('Microphone access denied', 'error');
                    return;
                }
            }

            this.updateStatus('Ready to transcribe', 'ready');
        } catch (error) {
            console.error('Error initializing transcription:', error);
            this.updateStatus('Initialization error', 'error');
        }
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = Date.now();
            this.startTime = Date.now();
            this.transcriptData = [];
            this.srtCounter = 1;
            
            // Update button states
            this.startRecordingBtn.disabled = true;
            this.startRecordingBtn.classList.add('recording');
            this.stopRecordingBtn.disabled = false;
            this.pauseRecordingBtn.disabled = false;
            
            this.updateStatus('Starting recording...', 'starting');
            
            await window.electronAPI.startTranscription();
            
            this.updateStatus('Recording and transcribing...', 'recording');
            this.recordingIndicator.classList.remove('hidden');
            this.startRecordingTimer();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.updateStatus('Failed to start recording', 'error');
            this.isRecording = false;
            this.resetButtonStates();
        }
    }

    async stopRecording() {
        if (!this.isRecording) return;

        try {
            this.isRecording = false;
            this.isPaused = false;
            
            await window.electronAPI.stopTranscription();
            
            this.updateStatus('Recording stopped', 'stopped');
            this.recordingIndicator.classList.add('hidden');
            this.currentText.textContent = '';
            this.stopRecordingTimer();
            this.resetButtonStates();
            
            if (this.transcriptData.length > 0) {
                this.promptSaveTranscript();
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.updateStatus('Error stopping recording', 'error');
        }
    }

    async pauseRecording() {
        if (!this.isRecording) return;

        try {
            this.isPaused = !this.isPaused;
            
            if (this.isPaused) {
                await window.electronAPI.pauseTranscription();
                this.updateStatus('Recording paused', 'paused');
                this.pauseRecordingBtn.textContent = '▶️';
                this.pauseRecordingBtn.title = 'Resume Recording';
                this.stopRecordingTimer();
            } else {
                await window.electronAPI.resumeTranscription();
                this.updateStatus('Recording resumed', 'recording');
                this.pauseRecordingBtn.textContent = '⏸️';
                this.pauseRecordingBtn.title = 'Pause Recording';
                this.startRecordingTimer();
            }
        } catch (error) {
            console.error('Error pausing recording:', error);
            this.updateStatus('Error pausing recording', 'error');
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    resetButtonStates() {
        this.startRecordingBtn.disabled = false;
        this.startRecordingBtn.classList.remove('recording');
        this.stopRecordingBtn.disabled = true;
        this.pauseRecordingBtn.disabled = true;
        this.pauseRecordingBtn.textContent = '⏸️';
        this.pauseRecordingBtn.title = 'Pause Recording';
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            if (this.recordingStartTime && !this.isPaused) {
                const elapsed = Date.now() - this.recordingStartTime;
                this.updateRecordingTime(elapsed);
            }
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    updateRecordingTime(elapsed) {
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update title or status to show recording time (optional)
        document.title = this.isRecording ? `Recording: ${timeString} - Whisper Transcriber` : 'Whisper Transcriber Overlay';
    }

    handleTranscriptionData(data) {
        const { text, startTime, endTime, confidence } = data;
        
        if (data.isFinal) {
            // Add to permanent transcript
            this.addTranscriptLine(text, startTime, endTime, confidence);
            this.currentText.textContent = '';
        } else {
            // Show as current/partial transcription
            this.currentText.textContent = text;
        }
    }

    handleTranscriptionError(error) {
        console.error('Transcription error:', error);
        this.updateStatus('Transcription error occurred', 'error');
    }

    handleTranscriptionStatus(status) {
        this.updateStatus(status.message, status.type);
    }

    addTranscriptLine(text, startTime, endTime, confidence) {
        if (!text.trim()) return;

        const transcriptEntry = {
            id: this.srtCounter++,
            text: text.trim(),
            startTime,
            endTime,
            confidence,
            timestamp: new Date()
        };

        this.transcriptData.push(transcriptEntry);

        // Add to display
        const line = document.createElement('div');
        line.className = `transcript-line ${confidence < 0.7 ? 'low-confidence' : ''}`;
        line.textContent = text;
        
        this.transcriptDisplay.appendChild(line);
        this.transcriptDisplay.scrollTop = this.transcriptDisplay.scrollHeight;
    }

    updateStatus(message, type) {
        this.statusText.textContent = message;
        this.statusText.className = type || '';
    }

    generateSRT() {
        if (this.transcriptData.length === 0) return '';

        return this.transcriptData.map(entry => {
            const startTime = this.formatSRTTime(entry.startTime);
            const endTime = this.formatSRTTime(entry.endTime);
            
            return `${entry.id}\n${startTime} --> ${endTime}\n${entry.text}\n`;
        }).join('\n');
    }

    formatSRTTime(timestamp) {
        // Convert timestamp to relative time from recording start
        const recordingElapsed = timestamp - this.startTime;
        const totalSeconds = Math.floor(recordingElapsed / 1000);
        const milliseconds = recordingElapsed % 1000;
        
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        const ms = milliseconds.toString().padStart(3, '0');
        
        return `${hours}:${minutes}:${seconds},${ms}`;
    }

    async saveTranscript() {
        if (this.transcriptData.length === 0) {
            this.updateStatus('No transcript to save', 'warning');
            return;
        }

        try {
            const srtContent = this.generateSRT();
            const saved = await window.electronAPI.saveTranscript(srtContent);
            
            if (saved) {
                this.updateStatus('Transcript saved successfully', 'success');
            } else {
                this.updateStatus('Save cancelled', 'info');
            }
        } catch (error) {
            console.error('Error saving transcript:', error);
            this.updateStatus('Failed to save transcript', 'error');
        }
    }

    async promptSaveTranscript() {
        const shouldSave = confirm('Would you like to save the transcript?');
        if (shouldSave) {
            await this.saveTranscript();
        }
    }

    clearTranscript() {
        this.transcriptData = [];
        this.transcriptDisplay.innerHTML = '';
        this.currentText.textContent = '';
        this.srtCounter = 1;
        this.updateStatus('Transcript cleared', 'info');
    }

    // Theme management
    async loadTheme() {
        try {
            if (window.electronAPI.getTheme) {
                const theme = await window.electronAPI.getTheme();
                this.applyTheme(theme);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    }

    applyTheme(theme) {
        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', systemTheme);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

}

// Initialize overlay when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhisperOverlay();
});