/**
 * Speaker Diarization & Identification
 * Identifies and labels different speakers throughout transcription
 * Uses voice fingerprinting with pitch, tone, and speech rate analysis
 */

class SpeakerDiarizer {
    constructor(options = {}) {
        this.settings = {
            enableDiarization: options.enableDiarization !== false,
            enableSpeakerLabeling: options.enableSpeakerLabeling !== false,
            minSpeakers: options.minSpeakers || 1,
            maxSpeakers: options.maxSpeakers || 8,
            confidenceThreshold: options.confidenceThreshold || 0.65,
            clusteringDistance: options.clusteringDistance || 0.5
        };

        // Speaker profiles stored as: speakerId -> {pitch, tone, speechRate, features...}
        this.speakerProfiles = new Map();
        this.currentSpeakerId = null;
        this.speakerCount = 0;

        // Statistics
        this.stats = {
            totalChunksAnalyzed: 0,
            speakersIdentified: 0,
            speakerSwitches: 0,
            averageConfidence: 0,
            confidenceScores: []
        };
    }

    /**
     * Analyze audio chunk and identify speaker
     */
    analyzeSpeaker(audioData, metadata = {}) {
        if (!this.settings.enableDiarization) {
            return null;
        }

        this.stats.totalChunksAnalyzed++;

        try {
            // Extract voice characteristics from audio
            const features = this.extractVoiceFeatures(audioData);

            // Identify speaker based on features
            const speakerId = this.identifySpeaker(features);

            // Update speaker profile with new data
            this.updateSpeakerProfile(speakerId, features);

            const confidence = features.confidence;
            this.stats.confidenceScores.push(confidence);

            // Update average confidence
            this.stats.averageConfidence =
                this.stats.confidenceScores.reduce((a, b) => a + b, 0) /
                this.stats.confidenceScores.length;

            // Track speaker switches
            if (this.currentSpeakerId !== speakerId) {
                this.speakerSwitches++;
                this.currentSpeakerId = speakerId;
            }

            return {
                speakerId: `Speaker ${speakerId}`,
                speakerIndex: speakerId,
                confidence: confidence,
                features: features,
                metadata: metadata
            };
        } catch (error) {
            console.error('SpeakerDiarizer: Error analyzing speaker:', error.message);
            return null;
        }
    }

    /**
     * Extract voice characteristics from audio
     */
    extractVoiceFeatures(audioData) {
        const features = {};

        // Calculate pitch using autocorrelation
        features.pitch = this.detectPitch(audioData);
        features.pitchVariance = this.calculatePitchVariance(audioData);

        // Calculate speech characteristics
        features.speechRate = this.calculateSpeechRate(audioData);
        features.amplitudeEnvelope = this.calculateAmplitudeEnvelope(audioData);
        features.spectralCentroid = this.calculateSpectralCentroid(audioData);

        // Formant-like feature (simplified - center frequency energy)
        features.energyDistribution = this.calculateEnergyDistribution(audioData);

        // Overall feature vector for clustering
        features.vector = this.createFeatureVector(features);

        // Calculate confidence based on feature stability
        features.confidence = this.calculateFeatureConfidence(features);

        return features;
    }

    /**
     * Detect fundamental frequency (pitch) using autocorrelation
     */
    detectPitch(audioData) {
        const frameSize = 512;
        const minPitch = 50;  // Hz
        const maxPitch = 400; // Hz

        if (audioData.length < frameSize * 2) {
            return 0;
        }

        // Extract frame and normalize
        const frame = new Array(frameSize);
        for (let i = 0; i < frameSize; i++) {
            const idx = Math.min(i * 2, audioData.length - 2);
            frame[i] = audioData.readInt16LE(idx) / 32768;
        }

        // Apply Hann window
        for (let i = 0; i < frameSize; i++) {
            frame[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (frameSize - 1)));
        }

        // Autocorrelation
        let maxCorr = 0;
        let maxLag = 1;
        const sampleRate = 16000;

        const minLag = Math.floor(sampleRate / maxPitch);
        const maxLagBound = Math.floor(sampleRate / minPitch);

        for (let lag = minLag; lag < maxLagBound; lag++) {
            let corr = 0;
            for (let i = 0; i < frameSize - lag; i++) {
                corr += frame[i] * frame[i + lag];
            }

            if (corr > maxCorr) {
                maxCorr = corr;
                maxLag = lag;
            }
        }

        return sampleRate / maxLag;
    }

    /**
     * Calculate pitch variance over time
     */
    calculatePitchVariance(audioData) {
        const chunkSize = 512;
        const pitches = [];

        for (let i = 0; i < audioData.length - chunkSize; i += chunkSize / 2) {
            const chunk = audioData.slice(i, i + chunkSize);
            const pitch = this.detectPitch(chunk);
            if (pitch > 0) {
                pitches.push(pitch);
            }
        }

        if (pitches.length === 0) return 0;

        const mean = pitches.reduce((a, b) => a + b) / pitches.length;
        const variance = pitches.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / pitches.length;

        return Math.sqrt(variance);
    }

    /**
     * Estimate speech rate from RMS energy peaks
     */
    calculateSpeechRate(audioData) {
        const frameSize = 256;
        const threshold = 0.05;
        let peakCount = 0;

        for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
            let rms = 0;
            for (let j = 0; j < frameSize; j += 2) {
                const sample = audioData.readInt16LE(i + j) / 32768;
                rms += sample * sample;
            }
            rms = Math.sqrt(rms / (frameSize / 2));

            if (rms > threshold) {
                peakCount++;
            }
        }

        // Approximate speech rate as peaks per 0.1 second
        const duration = audioData.length / 2 / 16000; // seconds
        return peakCount / duration;
    }

    /**
     * Calculate amplitude envelope (loudness dynamics)
     */
    calculateAmplitudeEnvelope(audioData) {
        const frameSize = 256;
        const envelope = [];

        for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
            let maxAmplitude = 0;
            for (let j = 0; j < frameSize; j += 2) {
                const sample = Math.abs(audioData.readInt16LE(i + j)) / 32768;
                maxAmplitude = Math.max(maxAmplitude, sample);
            }
            envelope.push(maxAmplitude);
        }

        if (envelope.length === 0) return 0;

        // Return average envelope variation
        const mean = envelope.reduce((a, b) => a + b) / envelope.length;
        const variance = envelope.reduce((acc, e) => acc + Math.pow(e - mean, 2), 0) / envelope.length;

        return Math.sqrt(variance);
    }

    /**
     * Calculate spectral centroid (simplified)
     */
    calculateSpectralCentroid(audioData) {
        // Simplified: use RMS as proxy for spectral energy
        let rms = 0;
        for (let i = 0; i < audioData.length; i += 2) {
            const sample = audioData.readInt16LE(i) / 32768;
            rms += sample * sample;
        }

        return Math.sqrt(rms / (audioData.length / 2));
    }

    /**
     * Calculate energy distribution across amplitude ranges
     */
    calculateEnergyDistribution(audioData) {
        const bins = [0, 0, 0, 0]; // Energy in 4 amplitude ranges
        let totalEnergy = 0;

        for (let i = 0; i < audioData.length; i += 2) {
            const sample = Math.abs(audioData.readInt16LE(i)) / 32768;
            totalEnergy += sample * sample;

            if (sample < 0.25) bins[0]++;
            else if (sample < 0.5) bins[1]++;
            else if (sample < 0.75) bins[2]++;
            else bins[3]++;
        }

        // Normalize
        const total = bins.reduce((a, b) => a + b);
        return total > 0 ? bins.map(b => b / total) : [0.25, 0.25, 0.25, 0.25];
    }

    /**
     * Create normalized feature vector for clustering
     */
    createFeatureVector(features) {
        return [
            Math.min(1, features.pitch / 200),           // Normalize pitch
            Math.min(1, features.pitchVariance / 100),   // Normalize pitch variance
            Math.min(1, features.speechRate / 10),       // Normalize speech rate
            features.amplitudeEnvelope,                  // Already 0-1
            features.spectralCentroid,                   // Already 0-1
            ...features.energyDistribution               // 4 values, each 0-1
        ];
    }

    /**
     * Calculate confidence of feature measurements
     */
    calculateFeatureConfidence(features) {
        let confidence = 0.8; // Base confidence

        // Reduce confidence if pitch is very low (unvoiced)
        if (features.pitch < 50) {
            confidence -= 0.3;
        }

        // High pitch variance suggests uncertainty
        if (features.pitchVariance > 100) {
            confidence -= 0.1;
        }

        // Very low energy suggests noise
        if (features.spectralCentroid < 0.1) {
            confidence -= 0.2;
        }

        return Math.max(0.3, Math.min(1.0, confidence));
    }

    /**
     * Identify speaker from features
     */
    identifySpeaker(features) {
        if (this.speakerProfiles.size === 0) {
            // First speaker
            this.speakerCount++;
            return this.speakerCount;
        }

        // Find closest speaker profile
        let closestSpeaker = null;
        let minDistance = this.settings.clusteringDistance;

        for (const [speakerId, profile] of this.speakerProfiles) {
            const distance = this.calculateEuclideanDistance(features.vector, profile.vector);

            if (distance < minDistance) {
                minDistance = distance;
                closestSpeaker = speakerId;
            }
        }

        // If no close match found, create new speaker profile
        if (closestSpeaker === null) {
            if (this.speakerProfiles.size < this.settings.maxSpeakers) {
                this.speakerCount++;
                return this.speakerCount;
            } else {
                // Max speakers reached, assign to closest
                return this.findClosestSpeaker(features.vector);
            }
        }

        return closestSpeaker;
    }

    /**
     * Calculate Euclidean distance between two feature vectors
     */
    calculateEuclideanDistance(vector1, vector2) {
        if (vector1.length !== vector2.length) {
            return Infinity;
        }

        let sum = 0;
        for (let i = 0; i < vector1.length; i++) {
            sum += Math.pow(vector1[i] - vector2[i], 2);
        }

        return Math.sqrt(sum);
    }

    /**
     * Find closest speaker when max speakers exceeded
     */
    findClosestSpeaker(featureVector) {
        let closestSpeaker = 1;
        let minDistance = Infinity;

        for (const [speakerId, profile] of this.speakerProfiles) {
            const distance = this.calculateEuclideanDistance(featureVector, profile.vector);
            if (distance < minDistance) {
                minDistance = distance;
                closestSpeaker = speakerId;
            }
        }

        return closestSpeaker;
    }

    /**
     * Update speaker profile with new features
     */
    updateSpeakerProfile(speakerId, features) {
        if (!this.speakerProfiles.has(speakerId)) {
            // Create new profile
            this.speakerProfiles.set(speakerId, {
                pitch: features.pitch,
                pitchVariance: features.pitchVariance,
                speechRate: features.speechRate,
                amplitudeEnvelope: features.amplitudeEnvelope,
                spectralCentroid: features.spectralCentroid,
                energyDistribution: features.energyDistribution,
                vector: features.vector,
                chunkCount: 1,
                confidence: features.confidence
            });

            this.stats.speakersIdentified++;
        } else {
            // Update existing profile with weighted average
            const profile = this.speakerProfiles.get(speakerId);
            const alpha = 0.7; // Learning rate

            profile.pitch = alpha * profile.pitch + (1 - alpha) * features.pitch;
            profile.pitchVariance = alpha * profile.pitchVariance + (1 - alpha) * features.pitchVariance;
            profile.speechRate = alpha * profile.speechRate + (1 - alpha) * features.speechRate;
            profile.amplitudeEnvelope = alpha * profile.amplitudeEnvelope + (1 - alpha) * features.amplitudeEnvelope;
            profile.spectralCentroid = alpha * profile.spectralCentroid + (1 - alpha) * features.spectralCentroid;
            profile.confidence = alpha * profile.confidence + (1 - alpha) * features.confidence;
            profile.chunkCount++;

            // Update feature vector
            profile.vector = this.createFeatureVector(profile);
        }
    }

    /**
     * Get speaker profile
     */
    getSpeakerProfile(speakerId) {
        return this.speakerProfiles.get(speakerId) || null;
    }

    /**
     * Get all speaker profiles
     */
    getAllSpeakers() {
        const speakers = [];
        for (const [speakerId, profile] of this.speakerProfiles) {
            speakers.push({
                speakerId: `Speaker ${speakerId}`,
                speakerIndex: speakerId,
                profile: profile
            });
        }
        return speakers;
    }

    /**
     * Reset speaker profiles (start new session)
     */
    resetProfiles() {
        this.speakerProfiles.clear();
        this.currentSpeakerId = null;
        this.speakerCount = 0;
    }

    /**
     * Get diarization statistics
     */
    getStats() {
        return {
            totalChunksAnalyzed: this.stats.totalChunksAnalyzed,
            speakersIdentified: this.stats.speakersIdentified,
            speakerSwitches: this.stats.speakerSwitches,
            averageConfidence: this.stats.averageConfidence.toFixed(3),
            currentSpeaker: this.currentSpeakerId,
            profiles: this.getAllSpeakers()
        };
    }

    /**
     * Get formatted speaker identification for display
     */
    formatSpeakerLabel(result) {
        if (!result || !this.settings.enableSpeakerLabeling) {
            return '';
        }

        return `[${result.speakerId} (${(result.confidence * 100).toFixed(0)}%)]`;
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalChunksAnalyzed: 0,
            speakersIdentified: 0,
            speakerSwitches: 0,
            averageConfidence: 0,
            confidenceScores: []
        };
    }
}

module.exports = SpeakerDiarizer;
