class ControlPanel {
    constructor() {
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.stats = {
            totalWords: 0,
            totalTime: 0,
            avgConfidence: 0
        };

        this.initializeElements();
        this.setupEventListeners();
        this.loadSettings();
        this.initializeAudioDevices();
    }

    initializeElements() {
        // Opacity controls
        this.opacitySlider = document.getElementById('opacity-slider');
        this.opacityValue = document.getElementById('opacity-value');
        
        // Font controls
        this.fontSizeSlider = document.getElementById('font-size');
        this.fontSizeValue = document.getElementById('font-size-value');
        
        // Recording controls
        this.startRecordingBtn = document.getElementById('start-recording');
        this.stopRecordingBtn = document.getElementById('stop-recording');
        this.pauseRecordingBtn = document.getElementById('pause-recording');
        this.recordingStatus = document.getElementById('recording-status');
        this.recordingTime = document.getElementById('recording-time');
        
        // Audio controls
        this.microphoneSelect = document.getElementById('microphone-select');
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.sensitivityValue = document.getElementById('sensitivity-value');
        this.audioLevelBar = document.getElementById('audio-level-bar');
        
        // Whisper settings
        this.modelSelect = document.getElementById('model-select');
        this.languageSelect = document.getElementById('language-select');
        
        // Export controls
        this.saveTranscriptBtn = document.getElementById('save-transcript');
        this.clearTranscriptBtn = document.getElementById('clear-transcript');
        this.exportFormat = document.getElementById('export-format');
        
        // Stats
        this.totalWordsEl = document.getElementById('total-words');
        this.totalTimeEl = document.getElementById('total-time');
        this.avgConfidenceEl = document.getElementById('avg-confidence');
    }

    setupEventListeners() {
        // Opacity control
        this.opacitySlider.addEventListener('input', (e) => {
            const opacity = parseFloat(e.target.value);
            this.updateOpacity(opacity);
        });

        // Font size control
        this.fontSizeSlider.addEventListener('input', (e) => {
            const fontSize = parseInt(e.target.value);
            this.updateFontSize(fontSize);
        });

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

        // Audio sensitivity
        this.sensitivitySlider.addEventListener('input', (e) => {
            const sensitivity = parseFloat(e.target.value);
            this.updateSensitivity(sensitivity);
        });

        // Microphone selection
        this.microphoneSelect.addEventListener('change', (e) => {
            this.updateMicrophone(e.target.value);
        });

        // Whisper settings
        this.modelSelect.addEventListener('change', (e) => {
            this.updateModel(e.target.value);
        });

        this.languageSelect.addEventListener('change', (e) => {
            this.updateLanguage(e.target.value);
        });

        // Export controls
        this.saveTranscriptBtn.addEventListener('click', () => {
            this.saveTranscript();
        });

        this.clearTranscriptBtn.addEventListener('click', () => {
            this.clearTranscript();
        });

        // Listen for transcription events
        window.electronAPI.onTranscriptionData((event, data) => {
            this.updateStats(data);
        });

        window.electronAPI.onTranscriptionStatus((event, status) => {
            this.updateRecordingStatus(status);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && e.ctrlKey) {
                e.preventDefault();
                this.toggleRecording();
            } else if (e.key === 's' && e.metaKey) {
                e.preventDefault();
                this.saveTranscript();
            }
        });

        // Simulate audio level monitoring
        this.startAudioLevelMonitoring();
    }

    async loadSettings() {
        try {
            // Load opacity setting
            const opacity = await window.electronAPI.getOverlayOpacity();
            this.opacitySlider.value = opacity;
            this.updateOpacityDisplay(opacity);
            
            // Load other settings from electron-store
            const fontSize = await window.electronAPI.getSetting('fontSize') || 16;
            this.fontSizeSlider.value = fontSize;
            this.updateFontSizeDisplay(fontSize);

            const sensitivity = await window.electronAPI.getSetting('sensitivity') || 0.5;
            this.sensitivitySlider.value = sensitivity;
            this.updateSensitivityDisplay(sensitivity);

            const model = await window.electronAPI.getSetting('whisperModel') || 'base';
            this.modelSelect.value = model;

            const language = await window.electronAPI.getSetting('language') || 'en';
            this.languageSelect.value = language;

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async initializeAudioDevices() {
        try {
            // In a real implementation, this would enumerate audio devices
            // For now, we'll add some mock devices
            const devices = [
                { id: 'default', label: 'Default Microphone' },
                { id: 'builtin', label: 'Built-in Microphone' },
                { id: 'usb', label: 'USB Microphone' }
            ];

            this.microphoneSelect.innerHTML = '';
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = device.label;
                this.microphoneSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error initializing audio devices:', error);
        }
    }

    async updateOpacity(opacity) {
        try {
            await window.electronAPI.setOverlayOpacity(opacity);
            this.updateOpacityDisplay(opacity);
        } catch (error) {
            console.error('Error updating opacity:', error);
        }
    }

    updateOpacityDisplay(opacity) {
        this.opacityValue.textContent = Math.round(opacity * 100) + '%';
    }

    async updateFontSize(fontSize) {
        try {
            await window.electronAPI.setSetting('fontSize', fontSize);
            this.updateFontSizeDisplay(fontSize);
        } catch (error) {
            console.error('Error updating font size:', error);
        }
    }

    updateFontSizeDisplay(fontSize) {
        this.fontSizeValue.textContent = fontSize + 'px';
    }

    async updateSensitivity(sensitivity) {
        try {
            await window.electronAPI.setSetting('sensitivity', sensitivity);
            this.updateSensitivityDisplay(sensitivity);
        } catch (error) {
            console.error('Error updating sensitivity:', error);
        }
    }

    updateSensitivityDisplay(sensitivity) {
        this.sensitivityValue.textContent = Math.round(sensitivity * 100) + '%';
    }

    async updateMicrophone(deviceId) {
        try {
            await window.electronAPI.setSetting('microphone', deviceId);
            console.log('Microphone updated to:', deviceId);
        } catch (error) {
            console.error('Error updating microphone:', error);
        }
    }

    async updateModel(model) {
        try {
            await window.electronAPI.setSetting('whisperModel', model);
            console.log('Whisper model updated to:', model);
        } catch (error) {
            console.error('Error updating model:', error);
        }
    }

    async updateLanguage(language) {
        try {
            await window.electronAPI.setSetting('language', language);
            console.log('Language updated to:', language);
        } catch (error) {
            console.error('Error updating language:', error);
        }
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            await window.electronAPI.startTranscription();
            
            this.startRecordingBtn.disabled = true;
            this.stopRecordingBtn.disabled = false;
            this.pauseRecordingBtn.disabled = false;
            
            this.updateRecordingStatus({ message: 'Recording...', type: 'recording' });
            this.startRecordingTimer();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;
            this.updateRecordingStatus({ message: 'Error starting recording', type: 'error' });
        }
    }

    async stopRecording() {
        if (!this.isRecording) return;

        try {
            this.isRecording = false;
            
            await window.electronAPI.stopTranscription();
            
            this.startRecordingBtn.disabled = false;
            this.stopRecordingBtn.disabled = true;
            this.pauseRecordingBtn.disabled = true;
            
            this.updateRecordingStatus({ message: 'Stopped', type: 'stopped' });
            this.stopRecordingTimer();
            
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.updateRecordingStatus({ message: 'Error stopping recording', type: 'error' });
        }
    }

    async pauseRecording() {
        try {
            await window.electronAPI.pauseTranscription();
            this.updateRecordingStatus({ message: 'Paused', type: 'paused' });
        } catch (error) {
            console.error('Error pausing recording:', error);
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            if (this.recordingStartTime) {
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
        
        this.recordingTime.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateRecordingStatus(status) {
        this.recordingStatus.textContent = status.message;
        this.recordingStatus.className = status.type;
    }

    updateStats(data) {
        if (data.isFinal && data.text) {
            this.stats.totalWords += data.text.split(' ').length;
            this.totalWordsEl.textContent = this.stats.totalWords;

            // Update confidence average
            if (data.confidence) {
                this.stats.avgConfidence = (this.stats.avgConfidence + data.confidence) / 2;
                this.avgConfidenceEl.textContent = Math.round(this.stats.avgConfidence * 100) + '%';
            }

            // Update total time
            if (this.recordingStartTime) {
                const elapsed = Date.now() - this.recordingStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                this.totalTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }
    }

    async saveTranscript() {
        try {
            const format = this.exportFormat.value;
            // The actual saving is handled by the overlay window
            // This just shows a confirmation
            this.updateRecordingStatus({ message: 'Saving transcript...', type: 'saving' });
            
            setTimeout(() => {
                this.updateRecordingStatus({ message: 'Transcript saved', type: 'success' });
            }, 1000);
            
        } catch (error) {
            console.error('Error saving transcript:', error);
            this.updateRecordingStatus({ message: 'Error saving transcript', type: 'error' });
        }
    }

    clearTranscript() {
        if (confirm('Are you sure you want to clear the transcript? This cannot be undone.')) {
            this.stats = { totalWords: 0, totalTime: 0, avgConfidence: 0 };
            this.totalWordsEl.textContent = '0';
            this.totalTimeEl.textContent = '00:00';
            this.avgConfidenceEl.textContent = '0%';
            this.updateRecordingStatus({ message: 'Transcript cleared', type: 'info' });
        }
    }

    startAudioLevelMonitoring() {
        // Simulate audio level monitoring
        setInterval(() => {
            if (this.isRecording) {
                // Generate random audio level for demonstration
                const level = Math.random() * 100;
                this.audioLevelBar.style.width = level + '%';
            } else {
                this.audioLevelBar.style.width = '0%';
            }
        }, 100);
    }
}

// Initialize control panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ControlPanel();
});