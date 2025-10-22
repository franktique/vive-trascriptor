/**
 * Emotion & Tone Analysis
 * Detects emotional tone and sentiment from both audio characteristics and text content
 * Combines acoustic signals with linguistic patterns for comprehensive analysis
 */

class EmotionAnalyzer {
    constructor(options = {}) {
        this.settings = {
            enableEmotionAnalysis: options.enableEmotionAnalysis !== false,
            audioWeight: options.audioWeight || 0.6,  // Audio: 60%, Text: 40%
            textWeight: options.textWeight || 0.4,
            confidenceThreshold: options.confidenceThreshold || 0.5
        };

        // Sentiment keywords for text analysis
        this.sentimentKeywords = {
            positive: [
                'love', 'amazing', 'great', 'awesome', 'wonderful', 'excellent',
                'perfect', 'fantastic', 'incredible', 'good', 'nice', 'glad',
                'happy', 'yes', 'thank', 'appreciate', 'beautiful', 'brilliant',
                'fantastic', 'outstanding', 'splendid', 'superb', 'delightful'
            ],
            negative: [
                'hate', 'terrible', 'awful', 'horrible', 'bad', 'worst', 'stupid',
                'ugly', 'disgusting', 'sick', 'no', 'don\'t', 'can\'t', 'won\'t',
                'angry', 'frustrated', 'sad', 'disappointed', 'poor', 'useless',
                'pathetic', 'dreadful', 'miserable', 'atrocious'
            ],
            uncertain: [
                'maybe', 'perhaps', 'probably', 'seems', 'kind of', 'sort of',
                'like', 'basically', 'uh', 'um', 'well', 'anyway', 'you know',
                'i think', 'i guess', 'not sure', 'confused'
            ]
        };

        // Interjections indicating strong emotion
        this.interjections = {
            positive: ['yeah', 'wow', 'yay', 'yes', 'hooray'],
            negative: ['oh', 'no', 'argh', 'ugh', 'gah', 'darn'],
            uncertain: ['hmm', 'huh', 'eh']
        };

        // Statistics
        this.stats = {
            textAnalyzed: 0,
            audioAnalyzed: 0,
            emotionsDetected: 0,
            avgEmotionConfidence: 0,
            emotionDistribution: {
                positive: 0,
                negative: 0,
                neutral: 0,
                uncertain: 0
            }
        };
    }

    /**
     * Analyze emotion from text content
     */
    analyzeTextEmotion(text) {
        if (!text || text.length === 0) {
            return {
                emotion: 'neutral',
                confidence: 0.0,
                sentimentScore: 0.5,
                signals: {
                    exclamationCount: 0,
                    questionCount: 0,
                    capitalizationRatio: 0,
                    sentimentKeywords: 0
                }
            };
        }

        this.stats.textAnalyzed++;

        const lowerText = text.toLowerCase();
        const signals = this.extractTextSignals(text, lowerText);

        // Calculate sentiment score (0 = negative, 0.5 = neutral, 1 = positive)
        let sentimentScore = 0.5;
        let keywordCount = 0;

        // Check positive keywords
        for (const word of this.sentimentKeywords.positive) {
            if (lowerText.includes(word)) {
                sentimentScore += 0.15;
                keywordCount++;
            }
        }

        // Check negative keywords
        for (const word of this.sentimentKeywords.negative) {
            if (lowerText.includes(word)) {
                sentimentScore -= 0.15;
                keywordCount++;
            }
        }

        // Check uncertain keywords
        let uncertainCount = 0;
        for (const word of this.sentimentKeywords.uncertain) {
            if (lowerText.includes(word)) {
                uncertainCount++;
            }
        }

        // Clamp sentiment score to [0, 1]
        sentimentScore = Math.max(0, Math.min(1, sentimentScore));

        // Determine emotion classification
        let emotion = 'neutral';
        let confidence = 0.5;

        if (sentimentScore > 0.65) {
            emotion = 'positive';
            confidence = Math.min(0.95, 0.5 + (sentimentScore - 0.5) * 0.9);
        } else if (sentimentScore < 0.35) {
            emotion = 'negative';
            confidence = Math.min(0.95, 0.5 + (0.5 - sentimentScore) * 0.9);
        } else if (uncertainCount > keywordCount / 2 || uncertainCount > 2) {
            emotion = 'uncertain';
            confidence = 0.5 + (uncertainCount * 0.1);
        } else {
            emotion = 'neutral';
            confidence = 0.3 + (Math.abs(sentimentScore - 0.5) * 0.4);
        }

        // Adjust confidence based on signals
        if (signals.exclamationCount > 0) confidence += 0.15;
        if (signals.capitalizationRatio > 0.3) confidence += 0.1;

        confidence = Math.min(0.99, confidence);

        return {
            emotion: emotion,
            confidence: confidence,
            sentimentScore: sentimentScore,
            signals: signals
        };
    }

    /**
     * Extract text signals for emotion detection
     */
    extractTextSignals(text, lowerText) {
        const exclamationCount = (text.match(/!/g) || []).length;
        const questionCount = (text.match(/\?/g) || []).length;

        // Calculate capitalization ratio
        const capitalized = (text.match(/[A-Z]/g) || []).length;
        const total = text.replace(/[^a-zA-Z]/g, '').length;
        const capitalizationRatio = total > 0 ? capitalized / total : 0;

        // Count sentiment keywords
        let sentimentKeywordCount = 0;
        const allKeywords = [
            ...this.sentimentKeywords.positive,
            ...this.sentimentKeywords.negative,
            ...this.sentimentKeywords.uncertain
        ];

        for (const word of allKeywords) {
            if (lowerText.includes(word)) {
                sentimentKeywordCount++;
            }
        }

        return {
            exclamationCount: exclamationCount,
            questionCount: questionCount,
            capitalizationRatio: capitalizationRatio,
            sentimentKeywords: sentimentKeywordCount
        };
    }

    /**
     * Analyze emotion from audio characteristics
     */
    analyzeAudioEmotion(audioData) {
        if (!audioData || audioData.length === 0) {
            return {
                emotion: 'neutral',
                confidence: 0.0,
                signals: {
                    pitchVariance: 0,
                    speechRate: 0,
                    amplitudeDynamics: 0
                }
            };
        }

        this.stats.audioAnalyzed++;

        const signals = this.extractAudioSignals(audioData);

        // Analyze pitch variance
        // High variance = more emotional (could be positive or negative)
        // Low variance = neutral or monotone
        let emotionalIntensity = Math.min(1, signals.pitchVariance / 100);

        // Analyze speech rate
        // Very fast = excited/anxious
        // Normal = neutral
        // Slow = sad/thoughtful
        let rateSignal = 0;
        if (signals.speechRate > 8) {
            rateSignal = 0.7; // Excited/anxious (positive lean)
        } else if (signals.speechRate < 3) {
            rateSignal = 0.3; // Sad/thoughtful (negative lean)
        } else {
            rateSignal = 0.5; // Neutral
        }

        // Analyze amplitude dynamics
        // High dynamics = energetic/emphatic
        // Low dynamics = monotone/depressed
        let dynamicsSignal = Math.min(1, signals.amplitudeDynamics * 2);

        // Combine signals
        // Average of rate and dynamics signals
        const emotionLean = (rateSignal + dynamicsSignal) / 2;

        // Classify based on combined signal
        let emotion = 'neutral';
        let confidence = 0.4;

        if (emotionalIntensity > 0.6 && emotionLean > 0.6) {
            emotion = 'positive'; // High energy, fast, dynamic
            confidence = emotionalIntensity * 0.8;
        } else if (emotionalIntensity > 0.6 && emotionLean < 0.4) {
            emotion = 'negative'; // High energy but slow/tense
            confidence = emotionalIntensity * 0.8;
        } else if (emotionalIntensity < 0.3 && rateSignal < 0.4) {
            emotion = 'negative'; // Low energy, slow speech
            confidence = 0.5;
        } else if (emotionalIntensity > 0.3 && rateSignal > 0.6) {
            emotion = 'positive'; // Some energy, faster speech
            confidence = 0.6;
        } else {
            emotion = 'neutral';
            confidence = 0.3 + (emotionalIntensity * 0.4);
        }

        return {
            emotion: emotion,
            confidence: confidence,
            signals: signals
        };
    }

    /**
     * Extract audio signal characteristics
     */
    extractAudioSignals(audioData) {
        // Calculate pitch variance
        const pitchVariance = this.calculatePitchVariance(audioData);

        // Calculate speech rate approximation
        const speechRate = this.estimateSpeechRate(audioData);

        // Calculate amplitude dynamics
        const amplitudeDynamics = this.calculateAmplitudeDynamics(audioData);

        return {
            pitchVariance: pitchVariance,
            speechRate: speechRate,
            amplitudeDynamics: amplitudeDynamics
        };
    }

    /**
     * Calculate pitch variance over time
     */
    calculatePitchVariance(audioData) {
        const frameSize = 512;
        const pitches = [];

        for (let i = 0; i < audioData.length - frameSize; i += frameSize / 2) {
            const frame = audioData.slice(i, i + frameSize);
            const pitch = this.detectPitch(frame);
            if (pitch > 0) {
                pitches.push(pitch);
            }
        }

        if (pitches.length < 2) return 0;

        const mean = pitches.reduce((a, b) => a + b) / pitches.length;
        const variance = pitches.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / pitches.length;

        return Math.sqrt(variance);
    }

    /**
     * Simple pitch detection using autocorrelation
     */
    detectPitch(audioData) {
        const frameSize = Math.min(audioData.length, 512);
        const minPitch = 50;
        const maxPitch = 400;

        const frame = new Array(frameSize);
        for (let i = 0; i < frameSize; i++) {
            const idx = Math.min(i * 2, audioData.length - 2);
            frame[i] = audioData.readInt16LE(idx) / 32768;
        }

        // Apply Hann window
        for (let i = 0; i < frameSize; i++) {
            frame[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (frameSize - 1)));
        }

        const sampleRate = 16000;
        const minLag = Math.floor(sampleRate / maxPitch);
        const maxLagBound = Math.floor(sampleRate / minPitch);

        let maxCorr = 0;
        let maxLag = 1;

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

        return maxLag > 0 ? sampleRate / maxLag : 0;
    }

    /**
     * Estimate speech rate from energy peaks
     */
    estimateSpeechRate(audioData) {
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

        const duration = audioData.length / 2 / 16000; // seconds
        return peakCount / duration;
    }

    /**
     * Calculate amplitude dynamics (variation in loudness)
     */
    calculateAmplitudeDynamics(audioData) {
        const frameSize = 256;
        const amplitudes = [];

        for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
            let maxAmp = 0;
            for (let j = 0; j < frameSize; j += 2) {
                const sample = Math.abs(audioData.readInt16LE(i + j)) / 32768;
                maxAmp = Math.max(maxAmp, sample);
            }
            amplitudes.push(maxAmp);
        }

        if (amplitudes.length < 2) return 0;

        const mean = amplitudes.reduce((a, b) => a + b) / amplitudes.length;
        const variance = amplitudes.reduce((acc, a) => acc + Math.pow(a - mean, 2), 0) / amplitudes.length;

        return Math.sqrt(variance);
    }

    /**
     * Combined emotion analysis from audio and text
     */
    analyzeEmotion(audioData, text) {
        if (!this.settings.enableEmotionAnalysis) {
            return null;
        }

        // Analyze text emotion
        const textEmotion = this.analyzeTextEmotion(text);

        // Analyze audio emotion
        const audioEmotion = this.analyzeAudioEmotion(audioData);

        // Combine signals with weighted average
        const audioWeight = this.settings.audioWeight;
        const textWeight = this.settings.textWeight;

        // Map emotions to numeric scores
        const emotionScores = {
            positive: 0.8,
            neutral: 0.5,
            negative: 0.2,
            uncertain: 0.5
        };

        const audioScore = emotionScores[audioEmotion.emotion] || 0.5;
        const textScore = emotionScores[textEmotion.emotion] || 0.5;

        const combinedScore = (audioScore * audioWeight) + (textScore * textWeight);

        // Determine final emotion and confidence
        let finalEmotion = 'neutral';
        let finalConfidence = 0.5;

        if (combinedScore > 0.65) {
            finalEmotion = 'positive';
            finalConfidence = Math.min(0.99, audioWeight * audioEmotion.confidence + textWeight * textEmotion.confidence);
        } else if (combinedScore < 0.35) {
            finalEmotion = 'negative';
            finalConfidence = Math.min(0.99, audioWeight * audioEmotion.confidence + textWeight * textEmotion.confidence);
        } else {
            finalEmotion = 'neutral';
            finalConfidence = Math.min(0.99, audioWeight * audioEmotion.confidence + textWeight * textEmotion.confidence);
        }

        this.stats.emotionsDetected++;
        this.stats.emotionDistribution[finalEmotion]++;
        this.stats.avgEmotionConfidence = (this.stats.avgEmotionConfidence * (this.stats.emotionsDetected - 1) + finalConfidence) / this.stats.emotionsDetected;

        return {
            text: text,
            emotion: finalEmotion,
            confidence: finalConfidence,
            audioSignals: audioEmotion.signals,
            textSignals: textEmotion.signals,
            audioEmotion: audioEmotion.emotion,
            textEmotion: textEmotion.emotion
        };
    }

    /**
     * Get emotion statistics
     */
    getStats() {
        return {
            textAnalyzed: this.stats.textAnalyzed,
            audioAnalyzed: this.stats.audioAnalyzed,
            emotionsDetected: this.stats.emotionsDetected,
            avgEmotionConfidence: this.stats.avgEmotionConfidence.toFixed(3),
            emotionDistribution: this.stats.emotionDistribution
        };
    }

    /**
     * Format emotion for display
     */
    formatEmotionLabel(result) {
        if (!result) return '';
        return `${result.emotion.toUpperCase()} (${(result.confidence * 100).toFixed(0)}%)`;
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            textAnalyzed: 0,
            audioAnalyzed: 0,
            emotionsDetected: 0,
            avgEmotionConfidence: 0,
            emotionDistribution: {
                positive: 0,
                negative: 0,
                neutral: 0,
                uncertain: 0
            }
        };
    }
}

module.exports = EmotionAnalyzer;
