/**
 * Real-time Grammar Correction
 * Fixes common speech patterns and grammatical errors in transcribed text
 * Rule-based and pattern-based correction without changing meaning
 */

class GrammarCorrector {
    constructor(options = {}) {
        this.settings = {
            enableGrammarCorrection: options.enableGrammarCorrection !== false,
            enableContractionExpansion: options.enableContractionExpansion !== true, // Off by default (users may prefer "gonna")
            enableRepetitionRemoval: options.enableRepetitionRemoval !== false,
            enableArticleAddition: options.enableArticleAddition !== true, // Off by default (conservative)
            enableVerbCorrection: options.enableVerbCorrection !== false,
            enableFillerRemoval: options.enableFillerRemoval !== false,
            removeFillers: options.removeFillers !== true, // Off by default
            trackCorrections: options.trackCorrections !== false
        };

        // Grammar rules
        this.contractionExpansions = {
            'gonna': 'going to',
            'wanna': 'want to',
            'kinda': 'kind of',
            'gotta': 'got to',
            'sorta': 'sort of',
            'dunno': 'don\'t know',
            'ya': 'you',
            'y\'all': 'you all',
            'imma': 'I am going to'
        };

        // Common filler words
        this.fillers = new Set([
            'like', 'um', 'uh', 'ah', 'er', 'eh', 'basically', 'literally',
            'you know', 'i mean', 'so like', 'kind of', 'sort of'
        ]);

        // Verb correction rules
        this.verbCorrections = {
            'i was going': 'I was going',    // Capitalization
            'we was': 'we were',
            'they was': 'they were',
            'he don\'t': 'he doesn\'t',
            'she don\'t': 'she doesn\'t',
            'it don\'t': 'it doesn\'t',
            'i don\'t': 'I don\'t',
            'he goes': 'he goes',             // This is correct, keep as is
            'she goes': 'she goes'            // This is correct, keep as is
        };

        // Common transcription error patterns
        this.errorPatterns = [
            // Repeated words
            { pattern: /\b(\w+)\s+\1\b/gi, replacement: '$1' },  // e.g., "the the" -> "the"
            // Double spaces
            { pattern: /\s{2,}/g, replacement: ' ' }
        ];

        // Statistics
        this.stats = {
            textProcessed: 0,
            correctionsApplied: 0,
            contractionsExpanded: 0,
            repetitionsRemoved: 0,
            articlesAdded: 0,
            verbsCorrected: 0,
            fillersRemoved: 0,
            detailedCorrections: []
        };
    }

    /**
     * Apply grammar corrections to text
     */
    correct(text) {
        if (!this.settings.enableGrammarCorrection || !text || text.length === 0) {
            return text;
        }

        this.stats.textProcessed++;
        let correctedText = text;
        const corrections = [];

        // Apply error pattern corrections
        correctedText = this.applyErrorPatterns(correctedText, corrections);

        // Apply contraction expansion
        if (this.settings.enableContractionExpansion) {
            correctedText = this.expandContractions(correctedText, corrections);
        }

        // Remove repetitions
        if (this.settings.enableRepetitionRemoval) {
            correctedText = this.removeRepetitions(correctedText, corrections);
        }

        // Remove fillers (optional)
        if (this.settings.enableFillerRemoval && this.settings.removeFillers) {
            correctedText = this.removeFillers(correctedText, corrections);
        }

        // Fix verb tenses
        if (this.settings.enableVerbCorrection) {
            correctedText = this.correctVerbs(correctedText, corrections);
        }

        // Add missing articles (conservative)
        if (this.settings.enableArticleAddition) {
            correctedText = this.addArticles(correctedText, corrections);
        }

        // Track corrections if enabled
        if (this.settings.trackCorrections && corrections.length > 0) {
            this.stats.detailedCorrections.push({
                original: text,
                corrected: correctedText,
                corrections: corrections,
                timestamp: Date.now()
            });
            this.stats.correctionsApplied += corrections.length;
        }

        return correctedText;
    }

    /**
     * Apply error pattern corrections (repeated words, double spaces, etc.)
     */
    applyErrorPatterns(text, corrections = []) {
        let correctedText = text;

        for (const rule of this.errorPatterns) {
            const matches = text.match(rule.pattern);
            if (matches) {
                const newText = correctedText.replace(rule.pattern, rule.replacement);

                if (newText !== correctedText) {
                    corrections.push({
                        type: 'error_pattern',
                        pattern: rule.pattern.toString(),
                        matches: matches,
                        count: matches.length
                    });

                    correctedText = newText;
                }
            }
        }

        return correctedText;
    }

    /**
     * Expand informal contractions to formal language
     */
    expandContractions(text, corrections = []) {
        let correctedText = text;
        let contractionsFound = [];

        for (const [contraction, expansion] of Object.entries(this.contractionExpansions)) {
            const pattern = new RegExp(`\\b${this.escapeRegex(contraction)}\\b`, 'gi');
            const matches = correctedText.match(pattern) || [];

            if (matches.length > 0) {
                correctedText = correctedText.replace(pattern, expansion);
                contractionsFound.push({
                    contraction: contraction,
                    expansion: expansion,
                    count: matches.length
                });

                this.stats.contractionsExpanded += matches.length;
            }
        }

        if (contractionsFound.length > 0) {
            corrections.push({
                type: 'contraction_expansion',
                corrections: contractionsFound
            });
        }

        return correctedText;
    }

    /**
     * Remove duplicate/repeated words
     */
    removeRepetitions(text, corrections = []) {
        let correctedText = text;
        const repetitionPattern = /\b(\w+)(\s+\1)+\b/gi;
        const matches = text.match(repetitionPattern) || [];

        if (matches.length > 0) {
            correctedText = text.replace(repetitionPattern, '$1');

            corrections.push({
                type: 'repetition_removal',
                matches: matches,
                count: matches.length
            });

            this.stats.repetitionsRemoved += matches.length;
        }

        return correctedText;
    }

    /**
     * Remove filler words
     */
    removeFillers(text, corrections = []) {
        let correctedText = text;
        let fillersFound = [];

        for (const filler of this.fillers) {
            const pattern = new RegExp(`\\b${this.escapeRegex(filler)}\\b`, 'gi');
            const matches = correctedText.match(pattern) || [];

            if (matches.length > 0) {
                correctedText = correctedText.replace(pattern, '').replace(/\s{2,}/g, ' ');
                fillersFound.push({
                    filler: filler,
                    count: matches.length
                });

                this.stats.fillersRemoved += matches.length;
            }
        }

        if (fillersFound.length > 0) {
            corrections.push({
                type: 'filler_removal',
                fillers: fillersFound
            });
        }

        return correctedText.trim();
    }

    /**
     * Correct common verb tense errors
     */
    correctVerbs(text, corrections = []) {
        let correctedText = text;
        let verbsFixed = [];

        for (const [incorrect, correct] of Object.entries(this.verbCorrections)) {
            const pattern = new RegExp(`\\b${this.escapeRegex(incorrect)}\\b`, 'gi');
            const matches = correctedText.match(pattern) || [];

            if (matches.length > 0) {
                correctedText = correctedText.replace(pattern, correct);
                verbsFixed.push({
                    incorrect: incorrect,
                    correct: correct,
                    count: matches.length
                });

                this.stats.verbsCorrected += matches.length;
            }
        }

        if (verbsFixed.length > 0) {
            corrections.push({
                type: 'verb_correction',
                corrections: verbsFixed
            });
        }

        return correctedText;
    }

    /**
     * Add missing articles (conservative approach)
     */
    addArticles(text, corrections = []) {
        let correctedText = text;
        let articlesAdded = [];

        // Very conservative: only add articles after specific patterns
        // Pattern 1: "I going" -> "I'm going"
        let pattern = /\bi\s+(going|making|taking|getting)\b/gi;
        let matches = correctedText.match(pattern) || [];
        if (matches.length > 0) {
            correctedText = correctedText.replace(pattern, 'I\'m $1');
            articlesAdded.push({ pattern: 'I going', correction: 'I\'m going', count: matches.length });
            this.stats.articlesAdded += matches.length;
        }

        // Pattern 2: "you going" -> "you\'re going"
        pattern = /\byou\s+(going|making|taking|getting)\b/gi;
        matches = correctedText.match(pattern) || [];
        if (matches.length > 0) {
            correctedText = correctedText.replace(pattern, 'you\'re $1');
            articlesAdded.push({ pattern: 'you going', correction: 'you\'re going', count: matches.length });
            this.stats.articlesAdded += matches.length;
        }

        // Pattern 3: "he/she going" -> "he's/she's going"
        pattern = /\b(he|she|it)\s+(going|making|taking|getting)\b/gi;
        matches = correctedText.match(pattern) || [];
        if (matches.length > 0) {
            correctedText = correctedText.replace(pattern, '$1\'s $2');
            articlesAdded.push({ pattern: 'he/she going', correction: 'he\'s/she\'s going', count: matches.length });
            this.stats.articlesAdded += matches.length;
        }

        if (articlesAdded.length > 0) {
            corrections.push({
                type: 'article_addition',
                corrections: articlesAdded
            });
        }

        return correctedText;
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Check if text contains grammar errors
     */
    hasGrammarErrors(text) {
        if (!text) return false;

        // Check for repeated words
        if (/\b(\w+)\s+\1\b/i.test(text)) return true;

        // Check for informal contractions
        for (const contraction of Object.keys(this.contractionExpansions)) {
            if (new RegExp(`\\b${contraction}\\b`, 'i').test(text)) return true;
        }

        // Check for common verb errors
        for (const incorrect of Object.keys(this.verbCorrections)) {
            if (new RegExp(`\\b${this.escapeRegex(incorrect)}\\b`, 'i').test(text)) return true;
        }

        return false;
    }

    /**
     * Get suggested corrections without applying them
     */
    suggestCorrections(text) {
        const suggestions = [];

        // Check for repeated words
        const repetitionPattern = /\b(\w+)(\s+\1)+\b/gi;
        const repetitions = text.match(repetitionPattern) || [];
        if (repetitions.length > 0) {
            suggestions.push({
                type: 'repetition',
                count: repetitions.length,
                examples: repetitions.slice(0, 3)
            });
        }

        // Check for contractions
        const contractionMatches = [];
        for (const contraction of Object.keys(this.contractionExpansions)) {
            const pattern = new RegExp(`\\b${contraction}\\b`, 'gi');
            const matches = text.match(pattern) || [];
            if (matches.length > 0) {
                contractionMatches.push({
                    contraction: contraction,
                    count: matches.length
                });
            }
        }

        if (contractionMatches.length > 0) {
            suggestions.push({
                type: 'contractions',
                count: contractionMatches.length,
                examples: contractionMatches.slice(0, 3)
            });
        }

        return suggestions;
    }

    /**
     * Get grammar correction statistics
     */
    getStats() {
        return {
            textProcessed: this.stats.textProcessed,
            correctionsApplied: this.stats.correctionsApplied,
            contractionsExpanded: this.stats.contractionsExpanded,
            repetitionsRemoved: this.stats.repetitionsRemoved,
            articlesAdded: this.stats.articlesAdded,
            verbsCorrected: this.stats.verbsCorrected,
            fillersRemoved: this.stats.fillersRemoved,
            recentCorrections: this.stats.detailedCorrections.slice(-10)
        };
    }

    /**
     * Add custom grammar rule
     */
    addCustomRule(incorrect, correct) {
        this.verbCorrections[incorrect.toLowerCase()] = correct;
        return true;
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            textProcessed: 0,
            correctionsApplied: 0,
            contractionsExpanded: 0,
            repetitionsRemoved: 0,
            articlesAdded: 0,
            verbsCorrected: 0,
            fillersRemoved: 0,
            detailedCorrections: []
        };
    }
}

module.exports = GrammarCorrector;
