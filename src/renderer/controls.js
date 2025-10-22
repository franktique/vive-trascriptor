class ControlPanel {
    constructor() {
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
        // Theme controls
        this.themeSelect = document.getElementById('theme-select');

        // Opacity controls
        this.opacitySlider = document.getElementById('opacity-slider');
        this.opacityValue = document.getElementById('opacity-value');

        // Font controls
        this.fontSizeSlider = document.getElementById('font-size');
        this.fontSizeValue = document.getElementById('font-size-value');


        // Audio controls
        this.microphoneSelect = document.getElementById('microphone-select');
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.sensitivityValue = document.getElementById('sensitivity-value');
        this.audioLevelBar = document.getElementById('audio-level-bar');

        // Whisper settings
        this.modelSelect = document.getElementById('model-select');
        this.languageSelect = document.getElementById('language-select');

        // Model download controls
        this.modelStatus = document.getElementById('model-status');
        this.modelStatusText = document.getElementById('model-status-text');
        this.downloadModelBtn = document.getElementById('download-model-btn');
        this.downloadProgress = document.getElementById('download-progress');
        this.downloadProgressBar = document.getElementById('download-progress-bar');
        this.downloadStatus = document.getElementById('download-status');
        this.downloadSpeed = document.getElementById('download-speed');
        this.downloadPercent = document.getElementById('download-percent');
        this.downloadEta = document.getElementById('download-eta');

        // Export controls
        this.saveTranscriptBtn = document.getElementById('save-transcript');
        this.clearTranscriptBtn = document.getElementById('clear-transcript');
        this.exportFormat = document.getElementById('export-format');

        // Stats
        this.totalWordsEl = document.getElementById('total-words');
        this.totalTimeEl = document.getElementById('total-time');
        this.avgConfidenceEl = document.getElementById('avg-confidence');

        // Modal controls (Note: modal is now in overlay window, not control panel)
        // Modal elements are accessed from overlay.js instead

        // Audio parameter sliders
        this.audioSliders = {
            silenceThreshold: {
                slider: document.getElementById('silence-threshold-slider'),
                display: document.getElementById('silence-threshold-value'),
                resetBtn: document.querySelector('[data-param="silenceThreshold"]'),
                default: -40,
                unit: 'dB'
            },
            normalizationTarget: {
                slider: document.getElementById('normalization-target-slider'),
                display: document.getElementById('normalization-target-value'),
                resetBtn: document.querySelector('[data-param="normalizationTarget"]'),
                default: -20,
                unit: 'dB'
            },
            confidenceThreshold: {
                slider: document.getElementById('confidence-threshold-slider'),
                display: document.getElementById('confidence-threshold-value'),
                resetBtn: document.querySelector('[data-param="confidenceThreshold"]'),
                default: 0.6,
                unit: '%'
            },
            highPassCutoff: {
                slider: document.getElementById('high-pass-cutoff-slider'),
                display: document.getElementById('high-pass-cutoff-value'),
                resetBtn: document.querySelector('[data-param="highPassCutoff"]'),
                default: 300,
                unit: 'Hz'
            },
            agcTargetLevel: {
                slider: document.getElementById('agc-target-level-slider'),
                display: document.getElementById('agc-target-level-value'),
                resetBtn: document.querySelector('[data-param="agcTargetLevel"]'),
                default: -20,
                unit: 'dB'
            },
            maxParallelChunks: {
                slider: document.getElementById('max-parallel-chunks-slider'),
                display: document.getElementById('max-parallel-chunks-value'),
                resetBtn: document.querySelector('[data-param="maxParallelChunks"]'),
                default: 2,
                unit: ''
            },
            vadEnergyThreshold: {
                slider: document.getElementById('vad-energy-threshold-slider'),
                display: document.getElementById('vad-energy-threshold-value'),
                resetBtn: document.querySelector('[data-param="vadEnergyThreshold"]'),
                default: -35,
                unit: 'dB'
            }
        };

        // Store for debouncing slider updates
        this.sliderUpdateTimers = {};
    }

    setupEventListeners() {
        // Theme control
        this.themeSelect.addEventListener('change', (e) => {
            this.updateTheme(e.target.value);
        });

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
            this.checkModelStatus(e.target.value);
        });

        this.languageSelect.addEventListener('change', (e) => {
            this.updateLanguage(e.target.value);
        });

        // Model download
        this.downloadModelBtn.addEventListener('click', () => {
            this.downloadModel();
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

        // Listen for real-time audio level updates
        if (window.electronAPI.onAudioLevel) {
            window.electronAPI.onAudioLevel((event, level) => {
                this.updateAudioLevel(level);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 's' && e.metaKey) {
                e.preventDefault();
                this.saveTranscript();
            }
        });

        // Simulate audio level monitoring
        this.startAudioLevelMonitoring();

        // Listen for model download progress
        if (window.electronAPI.onModelDownloadProgress) {
            window.electronAPI.onModelDownloadProgress((event, progress) => {
                this.updateDownloadProgress(progress);
            });
        }

        // Listen for model download completion
        if (window.electronAPI.onModelDownloadComplete) {
            window.electronAPI.onModelDownloadComplete((event, result) => {
                console.log('Model download completed:', result);
                this.downloadModelBtn.disabled = false;
                this.downloadModelBtn.textContent = 'Download';
                this.downloadProgress.style.display = 'none';
                this.checkModelStatus(this.modelSelect.value);
            });
        }

        // Listen for model download errors
        if (window.electronAPI.onModelDownloadError) {
            window.electronAPI.onModelDownloadError((event, error) => {
                console.error('Model download failed:', error);
                this.downloadModelBtn.disabled = false;
                this.downloadModelBtn.textContent = 'Download';
                this.downloadProgress.style.display = 'none';
                this.updateRecordingStatus({ message: `Download failed: ${error.error}`, type: 'error' });
            });
        }

        // Audio parameter sliders (Modal is now in overlay.js)
        Object.keys(this.audioSliders).forEach(paramId => {
            const config = this.audioSliders[paramId];

            // Slider change event with debouncing
            config.slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.updateAudioParameterDisplay(paramId, value);
                this.debouncedSaveAudioParameter(paramId, value);
            });

            // Reset button
            config.resetBtn.addEventListener('click', () => {
                this.resetAudioParameter(paramId);
            });
        });

        // Reset all button in modal
        this.modalResetAllBtn.addEventListener('click', () => {
            this.resetAllAudioParameters();
        });
    }

    async loadSettings() {
        try {
            // Load theme setting
            const theme = await window.electronAPI.getSetting('theme') || 'light';
            this.themeSelect.value = theme;
            this.applyTheme(theme);

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

            const model = await window.electronAPI.getSetting('whisperModel') || 'base.en';
            this.modelSelect.value = model;
            this.checkModelStatus(model);

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

    updateAudioLevel(level) {
        // Update audio level bar (level is 0-1, convert to percentage)
        const percentage = Math.min(level * 100, 100);
        this.audioLevelBar.style.width = percentage + '%';
    }

    startAudioLevelMonitoring() {
        // Reset audio level when not recording
        setInterval(() => {
            if (!this.isRecording) {
                this.audioLevelBar.style.width = '0%';
            }
        }, 100);
    }

    updateRecordingStatus(status) {
        if (this.recordingStatus) {
            this.recordingStatus.textContent = status.message;
            this.recordingStatus.className = `recording-status ${status.type}`;
        }
        console.log('Recording status:', status);
    }

    // Theme management methods
    async updateTheme(theme) {
        try {
            await window.electronAPI.setSetting('theme', theme);
            this.applyTheme(theme);
            
            // Also update overlay window theme
            if (window.electronAPI.setTheme) {
                await window.electronAPI.setTheme(theme);
            }
        } catch (error) {
            console.error('Error updating theme:', error);
        }
    }

    applyTheme(theme) {
        // Apply theme to control panel
        if (theme === 'system') {
            // Detect system theme
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', systemTheme);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        
        // Listen for system theme changes when in system mode
        if (theme === 'system') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            });
        }
    }

    // Model management methods
    async checkModelStatus(modelName) {
        try {
            if (window.electronAPI.getModelStatus) {
                const status = await window.electronAPI.getModelStatus(modelName);
                this.updateModelStatusUI(modelName, status);
                this.modelStatus.style.display = 'block';
            }
        } catch (error) {
            console.error('Error checking model status:', error);
            this.modelStatus.style.display = 'none';
        }
    }

    updateModelStatusUI(modelName, status) {
        if (status.exists) {
            this.modelStatusText.textContent = `✓ Downloaded (${status.size})`;
            this.modelStatusText.style.color = 'var(--success)';
            this.downloadModelBtn.style.display = 'none';
        } else {
            this.modelStatusText.textContent = 'Not Downloaded';
            this.modelStatusText.style.color = 'var(--text-muted)';
            this.downloadModelBtn.style.display = 'inline-block';
            this.downloadModelBtn.textContent = 'Download';
        }
        
        // Hide progress bar if not downloading
        if (!status.downloading) {
            this.downloadProgress.style.display = 'none';
        }
    }

    async downloadModel() {
        try {
            const modelName = this.modelSelect.value;
            console.log('Starting download for model:', modelName);
            
            // Check if already downloading
            if (this.downloadModelBtn.disabled) {
                console.log('Download already in progress, ignoring click');
                return;
            }
            
            this.downloadModelBtn.disabled = true;
            this.downloadModelBtn.textContent = 'Starting...';
            this.downloadProgress.style.display = 'block';
            
            if (window.electronAPI.downloadModel) {
                console.log('Calling electronAPI.downloadModel...');
                const result = await window.electronAPI.downloadModel(modelName);
                console.log('Download result:', result);
            } else {
                console.error('electronAPI.downloadModel not available');
            }
        } catch (error) {
            console.error('Error starting model download:', error);
            this.downloadModelBtn.disabled = false;
            this.downloadModelBtn.textContent = 'Download';
            this.downloadProgress.style.display = 'none';
            this.updateRecordingStatus({ message: `Error starting download: ${error.message}`, type: 'error' });
        }
    }

    updateDownloadProgress(progress) {
        console.log('Download progress update:', progress);

        // Update progress bar
        this.downloadProgressBar.style.width = `${progress.percent}%`;
        this.downloadPercent.textContent = `${Math.round(progress.percent)}%`;

        // Update download speed
        if (progress.speed) {
            const speedMB = (progress.speed / 1024 / 1024).toFixed(1);
            this.downloadSpeed.textContent = `${speedMB} MB/s`;
        }

        // Update ETA
        if (progress.eta) {
            const minutes = Math.floor(progress.eta / 60);
            const seconds = Math.floor(progress.eta % 60);
            this.downloadEta.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
        }

        // Update status text
        if (progress.status) {
            this.downloadStatus.textContent = progress.status;
        }

        // Completion will be handled by the dedicated event handler
    }

    // ============================================
    // Advanced Audio Processing Methods
    // (Modal is now in overlay.js)
    // ============================================

    updateAudioParameterDisplay(paramId, value) {
        const config = this.audioSliders[paramId];
        if (!config) return;

        // Format the display value based on parameter type
        let displayValue;
        if (paramId === 'confidenceThreshold') {
            displayValue = `${Math.round(value * 100)}%`;
        } else if (config.unit === '') {
            displayValue = Math.round(value).toString();
        } else {
            displayValue = `${Math.round(value)} ${config.unit}`;
        }

        config.display.textContent = displayValue;
    }

    debouncedSaveAudioParameter(paramId, value) {
        // Clear existing timer for this parameter
        if (this.sliderUpdateTimers[paramId]) {
            clearTimeout(this.sliderUpdateTimers[paramId]);
        }

        // Set new timer (debounce for 500ms)
        this.sliderUpdateTimers[paramId] = setTimeout(() => {
            this.saveAudioParameter(paramId, value);
        }, 500);
    }

    async saveAudioParameter(paramId, value) {
        try {
            if (window.electronAPI.setAudioParameter) {
                await window.electronAPI.setAudioParameter(paramId, value);
            } else {
                // Fallback to regular settings
                await window.electronAPI.setSetting(`audioParam_${paramId}`, value);
            }
            console.log(`Audio parameter saved: ${paramId} = ${value}`);
        } catch (error) {
            console.error(`Error saving audio parameter ${paramId}:`, error);
        }
    }

    resetAudioParameter(paramId) {
        const config = this.audioSliders[paramId];
        if (!config) return;

        // Reset slider to default value
        config.slider.value = config.default;
        this.updateAudioParameterDisplay(paramId, config.default);
        this.saveAudioParameter(paramId, config.default);
    }

    resetAllAudioParameters() {
        if (!confirm('Reset all audio parameters to defaults?')) {
            return;
        }

        Object.keys(this.audioSliders).forEach(paramId => {
            this.resetAudioParameter(paramId);
        });

        this.updateRecordingStatus({
            message: 'All audio parameters reset to defaults',
            type: 'success'
        });
    }

    async loadAudioParameters() {
        try {
            for (const paramId in this.audioSliders) {
                const config = this.audioSliders[paramId];
                let value;

                // Try to load from custom IPC handler first, then fallback to settings
                if (window.electronAPI.getAudioParameter) {
                    try {
                        value = await window.electronAPI.getAudioParameter(paramId);
                    } catch (err) {
                        value = await window.electronAPI.getSetting(`audioParam_${paramId}`);
                    }
                } else {
                    value = await window.electronAPI.getSetting(`audioParam_${paramId}`);
                }

                // Use default if not found
                if (value === undefined || value === null) {
                    value = config.default;
                }

                // Update slider and display
                config.slider.value = value;
                this.updateAudioParameterDisplay(paramId, value);
            }

            // Advanced settings are now in a modal, no need to load visibility state
        } catch (error) {
            console.error('Error loading audio parameters:', error);
        }
    }

    openTestingGuide() {
        // Open testing guide - could open in browser or show modal
        const guideUrl = 'https://github.com/franktique/vive-translator/blob/advanced-features/docs/audio-parameter-testing-guide.md';
        console.log('Opening testing guide:', guideUrl);

        // Try to open externally
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(guideUrl).catch(err => {
                console.error('Failed to open guide:', err);
                this.updateRecordingStatus({
                    message: 'Could not open testing guide. Check console for URL.',
                    type: 'warning'
                });
            });
        } else {
            this.updateRecordingStatus({
                message: 'Testing guide available at: docs/audio-parameter-testing-guide.md',
                type: 'info'
            });
        }
    }
}

// Initialize control panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const controlPanel = new ControlPanel();
    // Load audio parameters after initialization
    controlPanel.loadAudioParameters();
});