/**
 * Language Detection & Support
 * Manages multilingual transcription with model switching
 */

class LanguageDetector {
    constructor(options = {}) {
        this.settings = {
            enableAutoDetect: options.enableAutoDetect !== false,
            defaultLanguage: options.defaultLanguage || 'en',
            enableMultilingual: options.enableMultilingual !== false
        };

        // Language code mappings
        this.languages = {
            'en': { name: 'English', model: 'base.en', code: 'en' },
            'es': { name: 'Spanish', model: 'base', code: 'es' },
            'fr': { name: 'French', model: 'base', code: 'fr' },
            'de': { name: 'German', model: 'base', code: 'de' },
            'it': { name: 'Italian', model: 'base', code: 'it' },
            'pt': { name: 'Portuguese', model: 'base', code: 'pt' },
            'nl': { name: 'Dutch', model: 'base', code: 'nl' },
            'ru': { name: 'Russian', model: 'base', code: 'ru' },
            'pl': { name: 'Polish', model: 'base', code: 'pl' },
            'tr': { name: 'Turkish', model: 'base', code: 'tr' },
            'ar': { name: 'Arabic', model: 'base', code: 'ar' },
            'zh': { name: 'Chinese', model: 'base', code: 'zh' },
            'ja': { name: 'Japanese', model: 'base', code: 'ja' },
            'ko': { name: 'Korean', model: 'base', code: 'ko' },
            'hi': { name: 'Hindi', model: 'base', code: 'hi' }
        };

        // Common words in each language for basic detection
        this.languagePatterns = {
            'en': ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i'],
            'es': ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se'],
            'fr': ['le', 'de', 'un', 'et', 'à', 'être', 'en', 'que', 'se', 'pas'],
            'de': ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich'],
            'it': ['il', 'di', 'da', 'e', 'a', 'un', 'si', 'che', 'la', 'per'],
            'pt': ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para'],
            'ru': ['в', 'и', 'не', 'на', 'он', 'я', 'к', 'а', 'с', 'по'],
            'nl': ['de', 'en', 'van', 'het', 'in', 'is', 'die', 'dat', 'op', 'een']
        };

        this.currentLanguage = this.settings.defaultLanguage;
        this.stats = {
            detectionAttempts: 0,
            successfulDetections: 0,
            languageSwitches: 0
        };
    }

    /**
     * Detect language from text using word frequency heuristics
     */
    detectLanguage(text) {
        if (!text || text.length === 0) {
            return this.currentLanguage;
        }

        const words = text.toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 0);

        if (words.length === 0) {
            return this.currentLanguage;
        }

        this.stats.detectionAttempts++;

        // Score each language based on common word matches
        const scores = {};

        for (const [lang, patterns] of Object.entries(this.languagePatterns)) {
            scores[lang] = 0;

            for (const pattern of patterns) {
                const matches = words.filter(w => w.includes(pattern)).length;
                scores[lang] += matches;
            }
        }

        // Find language with highest score
        const detectedLang = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)[0][0];

        const maxScore = Math.max(...Object.values(scores));

        // Only return detected language if confidence is above threshold
        if (maxScore >= 2) {
            this.stats.successfulDetections++;

            if (detectedLang !== this.currentLanguage) {
                console.log(`LanguageDetector: Detected language change: ${this.currentLanguage} → ${detectedLang} (confidence: ${maxScore})`);
                this.currentLanguage = detectedLang;
                this.stats.languageSwitches++;
            }

            return detectedLang;
        }

        return this.currentLanguage;
    }

    /**
     * Set language explicitly
     */
    setLanguage(languageCode) {
        if (!this.languages[languageCode]) {
            console.warn(`LanguageDetector: Unknown language code: ${languageCode}`);
            return false;
        }

        if (languageCode !== this.currentLanguage) {
            console.log(`LanguageDetector: Language set to ${this.languages[languageCode].name} (${languageCode})`);
            this.currentLanguage = languageCode;
            this.stats.languageSwitches++;
        }

        return true;
    }

    /**
     * Get current language info
     */
    getCurrentLanguage() {
        return {
            code: this.currentLanguage,
            ...this.languages[this.currentLanguage]
        };
    }

    /**
     * Get available languages
     */
    getAvailableLanguages() {
        return Object.entries(this.languages).map(([code, info]) => ({
            code,
            ...info
        }));
    }

    /**
     * Get language info by code
     */
    getLanguageInfo(code) {
        return this.languages[code] || null;
    }

    /**
     * Get appropriate model for language
     */
    getModelForLanguage(languageCode = null) {
        const lang = languageCode || this.currentLanguage;

        if (!this.languages[lang]) {
            console.warn(`LanguageDetector: Unknown language ${lang}, using default`);
            return this.languages[this.settings.defaultLanguage].model;
        }

        return this.languages[lang].model;
    }

    /**
     * Check if language requires non-English model
     */
    requiresMultilingualModel(languageCode = null) {
        const lang = languageCode || this.currentLanguage;
        return lang !== 'en'; // English can use .en models, others need base
    }

    /**
     * Get Whisper language code for API
     */
    getWhisperLanguageCode(languageCode = null) {
        const lang = languageCode || this.currentLanguage;
        return this.languages[lang]?.code || 'en';
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            ...this.stats,
            currentLanguage: this.currentLanguage,
            detectionAccuracy: this.stats.detectionAttempts > 0
                ? (this.stats.successfulDetections / this.stats.detectionAttempts * 100).toFixed(1) + '%'
                : 'N/A'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            detectionAttempts: 0,
            successfulDetections: 0,
            languageSwitches: 0
        };
    }
}

module.exports = LanguageDetector;
