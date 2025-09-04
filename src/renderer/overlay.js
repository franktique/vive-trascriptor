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
        
        this.showControlsBtn = document.getElementById('show-controls-btn');
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.closeBtn = document.getElementById('close-btn');
    }

    setupEventListeners() {
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

        // Auto-start transcription on load
        this.startTranscription();
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

    async startTranscription() {
        if (this.isRecording) return;

        try {
            this.isRecording = true;
            this.startTime = Date.now();
            this.transcriptData = [];
            this.srtCounter = 1;
            
            this.updateStatus('Starting transcription...', 'starting');
            
            // For now, we'll simulate starting transcription
            // In a real implementation, this would trigger the Whisper transcription
            await window.electronAPI.startTranscription();
            
            this.updateStatus('Recording and transcribing...', 'recording');
            this.recordingIndicator.classList.remove('hidden');
            
            // Simulate real-time transcription for demonstration
            this.simulateTranscription();
            
        } catch (error) {
            console.error('Error starting transcription:', error);
            this.updateStatus('Failed to start transcription', 'error');
            this.isRecording = false;
        }
    }

    async stopTranscription() {
        if (!this.isRecording) return;

        try {
            this.isRecording = false;
            
            await window.electronAPI.stopTranscription();
            
            this.updateStatus('Transcription stopped', 'stopped');
            this.recordingIndicator.classList.add('hidden');
            this.currentText.textContent = '';
            
            if (this.transcriptData.length > 0) {
                this.promptSaveTranscript();
            }
        } catch (error) {
            console.error('Error stopping transcription:', error);
            this.updateStatus('Error stopping transcription', 'error');
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopTranscription();
        } else {
            this.startTranscription();
        }
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
        const date = new Date(timestamp);
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const seconds = date.getUTCSeconds().toString().padStart(2, '0');
        const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
        
        return `${hours}:${minutes}:${seconds},${milliseconds}`;
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

    // Simulation method for demonstration (remove in production)
    simulateTranscription() {
        if (!this.isRecording) return;

        const sampleTexts = [
            "Hello, this is a test of the real-time transcription system.",
            "The weather today is quite pleasant and sunny.",
            "I'm demonstrating the Whisper transcription overlay window.",
            "This text should appear with proper timestamps in the SRT file.",
            "The transparency can be adjusted using the control panel."
        ];

        let textIndex = 0;
        const simulationInterval = setInterval(() => {
            if (!this.isRecording || textIndex >= sampleTexts.length) {
                clearInterval(simulationInterval);
                return;
            }

            const now = Date.now();
            const startTime = now;
            const endTime = now + 3000; // 3 second duration

            // Simulate partial transcription
            setTimeout(() => {
                if (this.isRecording) {
                    this.handleTranscriptionData({
                        text: sampleTexts[textIndex],
                        startTime,
                        endTime,
                        confidence: 0.85 + Math.random() * 0.15,
                        isFinal: false
                    });
                }
            }, 1000);

            // Simulate final transcription
            setTimeout(() => {
                if (this.isRecording) {
                    this.handleTranscriptionData({
                        text: sampleTexts[textIndex],
                        startTime,
                        endTime,
                        confidence: 0.85 + Math.random() * 0.15,
                        isFinal: true
                    });
                }
            }, 2500);

            textIndex++;
        }, 4000);
    }
}

// Initialize overlay when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhisperOverlay();
});