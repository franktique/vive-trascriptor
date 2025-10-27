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
        this.toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        this.closeSidebarBtn = document.getElementById('close-sidebar-btn');
        this.clearScreenBtn = document.getElementById('clear-screen-btn');
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.closeBtn = document.getElementById('close-btn');

        // Sidebar
        this.sidebar = document.getElementById('settings-sidebar');

        // Settings controls
        this.themeSelect = document.getElementById('theme-select');
        this.opacitySlider = document.getElementById('opacity-slider');
        this.opacityValue = document.getElementById('opacity-value');
        this.fontSizeSlider = document.getElementById('font-size');
        this.fontSizeValue = document.getElementById('font-size-value');
        this.microphoneSelect = document.getElementById('microphone-select');
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.sensitivityValue = document.getElementById('sensitivity-value');
        this.audioLevelBar = document.getElementById('audio-level-bar');
        this.modelSelect = document.getElementById('model-select');
        this.languageSelect = document.getElementById('language-select');
        this.exportFormat = document.getElementById('export-format');
        this.saveTranscriptBtn = document.getElementById('save-transcript');
        this.clearTranscriptBtn = document.getElementById('clear-transcript');
        this.totalWordsDisplay = document.getElementById('total-words');
        this.totalTimeDisplay = document.getElementById('total-time');
        this.avgConfidenceDisplay = document.getElementById('avg-confidence');

        // Advanced Audio Sidebar controls
        this.advancedAudioBtn = document.getElementById('advanced-audio-btn');
        this.advancedAudioSidebar = document.getElementById('advanced-audio-sidebar');
        this.closeAdvancedAudioBtn = document.getElementById('close-advanced-audio-btn');
        this.advancedResetAllBtn = document.getElementById('advanced-reset-all-btn');

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
                unit: ''
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

        // Debouncing timer for audio parameters
        this.audioParamDebounceTimer = null;

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

        // Sidebar controls
        this.toggleSidebarBtn.addEventListener('click', () => {
            this.toggleSidebar();
        });

        this.closeSidebarBtn.addEventListener('click', () => {
            this.closeSidebar();
        });

        this.clearScreenBtn.addEventListener('click', () => {
            this.clearScreenFromToolbar();
        });

        this.minimizeBtn.addEventListener('click', () => {
            window.electronAPI.minimizeOverlay();
        });

        this.closeBtn.addEventListener('click', () => {
            window.electronAPI.closeOverlay();
        });

        // Settings controls
        this.themeSelect.addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });

        this.opacitySlider.addEventListener('input', (e) => {
            const opacity = parseFloat(e.target.value);
            this.opacityValue.textContent = Math.round(opacity * 100) + '%';
            window.electronAPI.setOpacity(opacity);
        });

        this.fontSizeSlider.addEventListener('input', (e) => {
            const fontSize = parseInt(e.target.value);
            this.fontSizeValue.textContent = fontSize + 'px';
            this.setFontSize(fontSize);
        });

        this.saveTranscriptBtn.addEventListener('click', () => {
            this.saveTranscript();
        });

        this.clearTranscriptBtn.addEventListener('click', () => {
            this.clearTranscript();
        });

        // Advanced Audio Sidebar controls
        this.advancedAudioBtn.addEventListener('click', () => {
            this.toggleAdvancedAudioSidebar();
        });

        this.closeAdvancedAudioBtn.addEventListener('click', () => {
            this.closeAdvancedAudioSidebar();
        });

        // Audio parameter sliders
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

        // Reset all button
        this.advancedResetAllBtn.addEventListener('click', () => {
            this.resetAllAudioParameters();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.advancedAudioSidebar.classList.contains('open')) {
                    this.closeAdvancedAudioSidebar();
                } else if (this.sidebar.classList.contains('open')) {
                    this.closeSidebar();
                } else {
                    this.toggleRecording();
                }
            } else if (event.key === 'Enter' && event.metaKey) {
                this.saveTranscript();
            } else if (event.key === 'c' && event.shiftKey && (event.ctrlKey || event.metaKey)) {
                // Ctrl+Shift+C (Windows/Linux) or Cmd+Shift+C (macOS)
                event.preventDefault();
                this.clearScreenFromToolbar();
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

        // Audio statistics listeners
        window.electronAPI.onAudioStats((event, stats) => {
            this.updateAudioMeter(stats);
        });

        window.electronAPI.onChunkSkipped((event, data) => {
            this.handleChunkSkipped(data);
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
        const { text, startTime, endTime, confidence, chunkId, speaker, speakerConfidence, emotion, emotionConfidence } = data;

        if (data.isFinal) {
            // Filter out very low confidence results (below 0.6)
            if (confidence < 0.6) {
                console.warn(`Filtering low confidence result (${confidence.toFixed(2)}): "${text}"`);
                this.updateStatus(`Low confidence result filtered (${confidence.toFixed(2)})`, 'info');
                this.currentText.textContent = '';
                return;
            }

            // Add to permanent transcript with Phase 4 metadata
            this.addTranscriptLine(text, startTime, endTime, confidence, {
                speaker: speaker,
                speakerConfidence: speakerConfidence,
                emotion: emotion,
                emotionConfidence: emotionConfidence
            });
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

    addTranscriptLine(text, startTime, endTime, confidence, metadata = {}) {
        if (!text.trim()) return;

        const transcriptEntry = {
            id: this.srtCounter++,
            text: text.trim(),
            startTime,
            endTime,
            confidence,
            // Phase 4 metadata
            speaker: metadata.speaker || null,
            speakerConfidence: metadata.speakerConfidence || null,
            emotion: metadata.emotion || null,
            emotionConfidence: metadata.emotionConfidence || null,
            timestamp: new Date()
        };

        this.transcriptData.push(transcriptEntry);

        // Add to display with confidence-based styling
        const line = document.createElement('div');
        let confidenceClass = 'confidence-high';

        if (confidence < 0.6) {
            confidenceClass = 'confidence-very-low';
        } else if (confidence < 0.7) {
            confidenceClass = 'confidence-low';
        } else if (confidence < 0.85) {
            confidenceClass = 'confidence-medium';
        }

        line.className = `transcript-line ${confidenceClass}`;

        // Add confidence indicator as a data attribute for CSS
        line.setAttribute('data-confidence', confidence.toFixed(2));

        // Add emotion indicator if available
        if (metadata.emotion) {
            line.setAttribute('data-emotion', metadata.emotion);
        }

        // Build display text with speaker label and timestamp
        let displayText = '';

        // Format timestamp as MM:SS
        const totalSeconds = Math.floor(startTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timestamp = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Build speaker label
        let speakerLabel = '';
        if (metadata.speaker) {
            speakerLabel = ` ${metadata.speaker}`;
        }

        // Build emotion label
        let emotionLabel = '';
        if (metadata.emotion) {
            emotionLabel = ` [${metadata.emotion.toUpperCase()}]`;
        }

        // Format as: [MM:SS] Speaker X [EMOTION]: text
        displayText = `[${timestamp}]${speakerLabel}${emotionLabel}: ${text}`;
        line.textContent = displayText;

        // Build detailed tooltip with all metadata
        let tooltipText = `Confidence: ${(confidence * 100).toFixed(1)}%`;
        if (metadata.speaker && metadata.speakerConfidence) {
            tooltipText += ` | ${metadata.speaker}: ${(metadata.speakerConfidence * 100).toFixed(0)}%`;
        }
        if (metadata.emotion && metadata.emotionConfidence) {
            tooltipText += ` | ${metadata.emotion}: ${(metadata.emotionConfidence * 100).toFixed(0)}%`;
        }

        line.title = tooltipText;

        this.transcriptDisplay.appendChild(line);
        this.transcriptDisplay.scrollTop = this.transcriptDisplay.scrollHeight;

        // Log with Phase 4 metadata
        if (confidence >= 0.85) {
            const metadata_str = metadata.speaker ? ` | ${metadata.speaker}` : '';
            console.log(`✓ High confidence (${confidence.toFixed(2)})${metadata_str}: ${text}`);
        } else if (confidence >= 0.7) {
            const metadata_str = metadata.speaker ? ` | ${metadata.speaker}` : '';
            console.log(`~ Medium confidence (${confidence.toFixed(2)})${metadata_str}: ${text}`);
        }
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

            // Build subtitle text with speaker and emotion labels
            let subtitleText = entry.text;

            // Add speaker label if available
            if (entry.speaker) {
                subtitleText = `${entry.speaker}: ${subtitleText}`;
            }

            // Add emotion label if available
            if (entry.emotion) {
                subtitleText += ` [${entry.emotion.toUpperCase()}]`;
            }

            return `${entry.id}\n${startTime} --> ${endTime}\n${subtitleText}\n`;
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

    updateAudioMeter(stats) {
        if (!this.audioLevelBar) return;

        const { peakDb, rmsDb, dynamicRange } = stats;

        // Normalize dB to 0-100 scale for visualization
        // Typical range: -40dB (very quiet) to 0dB (max)
        const normalizeDb = (db) => {
            // Map -60 to +12 dB to 0-100 scale
            const normalized = Math.max(0, Math.min(100, ((db + 60) / 72) * 100));
            return normalized;
        };

        const levelPercent = normalizeDb(rmsDb);
        const peakPercent = normalizeDb(peakDb);

        // Update visual bar
        this.audioLevelBar.style.width = levelPercent + '%';

        // Add color-coded feedback
        let barColor = '#4CBF56'; // Green for good level
        if (rmsDb < -40) {
            barColor = '#FF6B6B'; // Red for too quiet
        } else if (rmsDb > -10) {
            barColor = '#FFB84D'; // Orange for too loud/risk of clipping
        } else if (rmsDb > -5) {
            barColor = '#FF6B6B'; // Red for clipping risk
        }

        this.audioLevelBar.style.backgroundColor = barColor;

        // Add warning for problematic levels
        if (rmsDb < -40) {
            this.updateStatus('⚠️ Audio too quiet', 'warning');
        } else if (rmsDb > -5) {
            this.updateStatus('⚠️ Audio level may clip', 'warning');
        }

        // Optional: Log audio stats in console for debugging
        if (this.isRecording) {
            console.debug(`Audio: RMS=${rmsDb.toFixed(1)}dB, Peak=${peakDb.toFixed(1)}dB, Range=${dynamicRange.toFixed(1)}dB`);
        }
    }

    handleChunkSkipped(data) {
        if (data.reason === 'silence') {
            console.debug(`Skipped silent chunk #${data.chunkId} (RMS: ${data.silenceInfo.rmsDb.toFixed(1)}dB)`);
            // Optionally update UI - you could show a "silence detected" indicator
            // this.updateStatus('Silence detected - skipped', 'info');
        }
    }

    clearTranscript() {
        this.transcriptData = [];
        this.transcriptDisplay.innerHTML = '';
        this.currentText.textContent = '';
        this.srtCounter = 1;
        this.updateStatus('Transcript cleared', 'info');
    }

    clearScreenFromToolbar() {
        // Clear transcript from toolbar button or keyboard shortcut
        this.clearTranscript();
    }

    // ===== SIDEBAR MANAGEMENT =====
    toggleSidebar() {
        if (this.sidebar.classList.contains('open')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        // Close advanced audio sidebar if open
        if (this.advancedAudioSidebar.classList.contains('open')) {
            this.closeAdvancedAudioSidebar();
        }
        this.sidebar.classList.add('open');
        this.toggleSidebarBtn.classList.add('active');
    }

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.toggleSidebarBtn.classList.remove('active');
    }

    // ===== THEME MANAGEMENT =====
    async loadTheme() {
        try {
            if (window.electronAPI.getTheme) {
                const theme = await window.electronAPI.getTheme();
                this.applyTheme(theme);
                this.themeSelect.value = theme;
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    }

    setTheme(theme) {
        this.applyTheme(theme);
        if (window.electronAPI.setTheme) {
            window.electronAPI.setTheme(theme);
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

    // ===== FONT SIZE MANAGEMENT =====
    setFontSize(fontSize) {
        document.documentElement.style.setProperty('--transcript-font-size', fontSize + 'px');
        this.transcriptDisplay.style.fontSize = fontSize + 'px';
        if (window.electronAPI.setFontSize) {
            window.electronAPI.setFontSize(fontSize);
        }
    }

    // ===== ADVANCED AUDIO SETTINGS SIDEBAR =====
    toggleAdvancedAudioSidebar() {
        // Close settings sidebar if open
        if (this.sidebar.classList.contains('open')) {
            this.closeSidebar();
        }
        // Toggle advanced audio sidebar
        this.advancedAudioSidebar.classList.toggle('open');
        this.loadAudioParameters();
    }

    closeAdvancedAudioSidebar() {
        this.advancedAudioSidebar.classList.remove('open');
    }

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
        clearTimeout(this.audioParamDebounceTimer);
        this.audioParamDebounceTimer = setTimeout(() => {
            this.saveAudioParameter(paramId, value);
        }, 500);
    }

    async saveAudioParameter(paramId, value) {
        try {
            const result = await window.electronAPI.setAudioParameter(paramId, value);
            console.log('Audio parameter updated:', { paramId, value, result });
        } catch (error) {
            console.error('Error saving audio parameter:', error);
        }
    }

    async resetAudioParameter(paramId) {
        const config = this.audioSliders[paramId];
        if (!config) return;

        config.slider.value = config.default;
        this.updateAudioParameterDisplay(paramId, config.default);
        await this.saveAudioParameter(paramId, config.default);
    }

    async resetAllAudioParameters() {
        const confirmed = confirm('Reset all audio parameters to defaults?');
        if (!confirmed) return;

        Object.keys(this.audioSliders).forEach(paramId => {
            const config = this.audioSliders[paramId];
            config.slider.value = config.default;
            this.updateAudioParameterDisplay(paramId, config.default);
            this.saveAudioParameter(paramId, config.default);
        });
    }

    async loadAudioParameters() {
        try {
            const params = await window.electronAPI.getAllAudioParameters();

            Object.keys(this.audioSliders).forEach(paramId => {
                const config = this.audioSliders[paramId];
                const value = params[paramId] ?? config.default;

                config.slider.value = value;
                this.updateAudioParameterDisplay(paramId, value);
            });
        } catch (error) {
            console.error('Error loading audio parameters:', error);
        }
    }

}

// Initialize overlay when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhisperOverlay();
});