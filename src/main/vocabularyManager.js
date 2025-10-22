/**
 * Custom Model & Vocabulary System
 * Manages domain-specific terminology and custom vocabulary injection
 * Supports add/remove, replacement rules, and export/import of vocabulary
 */

class VocabularyManager {
    constructor(options = {}) {
        this.settings = {
            enableCustomVocabulary: options.enableCustomVocabulary !== false,
            caseSensitive: options.caseSensitive !== false,
            wholeWordsOnly: options.wholeWordsOnly !== false,
            autoLearnEnabled: options.autoLearnEnabled !== false
        };

        // Custom vocabulary storage
        this.vocabulary = new Map();     // term -> {pronunciation, category, frequency, aliases}
        this.replacementRules = new Map(); // pattern -> replacement

        // Statistics
        this.stats = {
            termsAdded: 0,
            rulesAdded: 0,
            termsUsed: 0,
            rulesApplied: 0,
            autoLearnedTerms: 0
        };

        // Auto-learned terms (optional)
        this.autoLearnedVocabulary = new Map();
    }

    /**
     * Add custom term to vocabulary
     */
    addTerm(term, options = {}) {
        if (!term || term.length === 0) {
            console.warn('VocabularyManager: Cannot add empty term');
            return false;
        }

        const normalizedTerm = this.settings.caseSensitive ? term : term.toLowerCase();

        const vocabEntry = {
            term: term,
            pronunciation: options.pronunciation || '',
            category: options.category || 'general',
            frequency: options.frequency || 0,
            aliases: options.aliases || [],
            dateAdded: new Date().toISOString()
        };

        this.vocabulary.set(normalizedTerm, vocabEntry);
        this.stats.termsAdded++;

        console.log(`VocabularyManager: Added term "${term}" (category: ${vocabEntry.category})`);
        return true;
    }

    /**
     * Remove term from vocabulary
     */
    removeTerm(term) {
        const normalizedTerm = this.settings.caseSensitive ? term : term.toLowerCase();

        if (this.vocabulary.has(normalizedTerm)) {
            this.vocabulary.delete(normalizedTerm);
            console.log(`VocabularyManager: Removed term "${term}"`);
            return true;
        }

        return false;
    }

    /**
     * Get term from vocabulary
     */
    getTerm(term) {
        const normalizedTerm = this.settings.caseSensitive ? term : term.toLowerCase();
        return this.vocabulary.get(normalizedTerm) || null;
    }

    /**
     * Check if term exists in vocabulary
     */
    hasTerm(term) {
        const normalizedTerm = this.settings.caseSensitive ? term : term.toLowerCase();
        return this.vocabulary.has(normalizedTerm);
    }

    /**
     * Add replacement rule
     */
    addRule(pattern, replacement, options = {}) {
        if (!pattern || !replacement) {
            console.warn('VocabularyManager: Pattern and replacement cannot be empty');
            return false;
        }

        const normalizedPattern = this.settings.caseSensitive ? pattern : pattern.toLowerCase();

        const rule = {
            pattern: pattern,
            replacement: replacement,
            enabled: options.enabled !== false,
            priority: options.priority || 0,
            dateAdded: new Date().toISOString()
        };

        this.replacementRules.set(normalizedPattern, rule);
        this.stats.rulesAdded++;

        console.log(`VocabularyManager: Added rule "${pattern}" → "${replacement}"`);
        return true;
    }

    /**
     * Remove replacement rule
     */
    removeRule(pattern) {
        const normalizedPattern = this.settings.caseSensitive ? pattern : pattern.toLowerCase();

        if (this.replacementRules.has(normalizedPattern)) {
            this.replacementRules.delete(normalizedPattern);
            console.log(`VocabularyManager: Removed rule for "${pattern}"`);
            return true;
        }

        return false;
    }

    /**
     * Get replacement rule
     */
    getRule(pattern) {
        const normalizedPattern = this.settings.caseSensitive ? pattern : pattern.toLowerCase();
        return this.replacementRules.get(normalizedPattern) || null;
    }

    /**
     * Apply vocabulary corrections to text
     */
    applyVocabularyCorrections(text) {
        if (!this.settings.enableCustomVocabulary || !text || text.length === 0) {
            return text;
        }

        let correctedText = text;

        // Apply replacement rules first (higher priority)
        correctedText = this.applyReplacementRules(correctedText);

        // Apply custom term corrections
        correctedText = this.applyTermCorrections(correctedText);

        return correctedText;
    }

    /**
     * Apply replacement rules to text
     */
    applyReplacementRules(text) {
        let correctedText = text;

        // Sort rules by priority (higher priority first)
        const sortedRules = Array.from(this.replacementRules.values())
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

        for (const rule of sortedRules) {
            if (!rule.enabled) continue;

            const searchText = this.settings.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
            const compareText = this.settings.caseSensitive ? correctedText : correctedText.toLowerCase();

            if (compareText.includes(searchText)) {
                // Create regex for word boundary matching if enabled
                if (this.settings.wholeWordsOnly) {
                    const pattern = new RegExp(`\\b${this.escapeRegex(rule.pattern)}\\b`,
                        this.settings.caseSensitive ? 'g' : 'gi');
                    const newText = correctedText.replace(pattern, rule.replacement);

                    if (newText !== correctedText) {
                        this.stats.rulesApplied++;
                        correctedText = newText;
                    }
                } else {
                    const pattern = new RegExp(this.escapeRegex(rule.pattern),
                        this.settings.caseSensitive ? 'g' : 'gi');
                    const newText = correctedText.replace(pattern, rule.replacement);

                    if (newText !== correctedText) {
                        this.stats.rulesApplied++;
                        correctedText = newText;
                    }
                }
            }
        }

        return correctedText;
    }

    /**
     * Apply custom term corrections
     */
    applyTermCorrections(text) {
        let correctedText = text;

        for (const [normalizedTerm, vocabEntry] of this.vocabulary) {
            const searchTerm = this.settings.caseSensitive ? vocabEntry.term : vocabEntry.term.toLowerCase();
            const compareText = this.settings.caseSensitive ? correctedText : correctedText.toLowerCase();

            if (compareText.includes(searchTerm)) {
                // Check aliases for potential corrections
                for (const alias of vocabEntry.aliases) {
                    const aliasLower = this.settings.caseSensitive ? alias : alias.toLowerCase();

                    if (compareText.includes(aliasLower)) {
                        if (this.settings.wholeWordsOnly) {
                            const pattern = new RegExp(`\\b${this.escapeRegex(alias)}\\b`,
                                this.settings.caseSensitive ? 'g' : 'gi');
                            const newText = correctedText.replace(pattern, vocabEntry.term);

                            if (newText !== correctedText) {
                                this.stats.rulesApplied++;
                                correctedText = newText;
                            }
                        } else {
                            const pattern = new RegExp(this.escapeRegex(alias),
                                this.settings.caseSensitive ? 'g' : 'gi');
                            const newText = correctedText.replace(pattern, vocabEntry.term);

                            if (newText !== correctedText) {
                                this.stats.rulesApplied++;
                                correctedText = newText;
                            }
                        }
                    }
                }

                // Update frequency if term found
                if (correctedText.includes(vocabEntry.term)) {
                    vocabEntry.frequency++;
                    this.stats.termsUsed++;
                }
            }
        }

        return correctedText;
    }

    /**
     * Auto-learn new terms (optional feature)
     */
    autoLearnTerm(term, context = {}) {
        if (!this.settings.autoLearnEnabled) {
            return false;
        }

        const normalizedTerm = this.settings.caseSensitive ? term : term.toLowerCase();

        if (this.vocabulary.has(normalizedTerm)) {
            return false; // Already in vocabulary
        }

        if (this.autoLearnedVocabulary.has(normalizedTerm)) {
            const entry = this.autoLearnedVocabulary.get(normalizedTerm);
            entry.frequency++;
            return true; // Already auto-learned
        }

        // Add to auto-learned vocabulary
        this.autoLearnedVocabulary.set(normalizedTerm, {
            term: term,
            category: context.category || 'auto-learned',
            frequency: 1,
            context: context.context || '',
            dateAdded: new Date().toISOString()
        });

        this.stats.autoLearnedTerms++;

        if (this.stats.autoLearnedTerms % 10 === 0) {
            console.log(`VocabularyManager: Auto-learned ${this.stats.autoLearnedTerms} terms`);
        }

        return true;
    }

    /**
     * Get all custom terms
     */
    getTerms() {
        return Array.from(this.vocabulary.values());
    }

    /**
     * Get all replacement rules
     */
    getRules() {
        return Array.from(this.replacementRules.values());
    }

    /**
     * Get auto-learned terms
     */
    getAutoLearnedTerms() {
        return Array.from(this.autoLearnedVocabulary.values());
    }

    /**
     * Export vocabulary to JSON
     */
    exportVocabulary() {
        return {
            customVocabulary: this.getTerms(),
            replacementRules: this.getRules(),
            autoLearnedVocabulary: this.getAutoLearnedTerms(),
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
    }

    /**
     * Import vocabulary from JSON
     */
    importVocabulary(data) {
        if (!data || typeof data !== 'object') {
            console.warn('VocabularyManager: Invalid import data');
            return false;
        }

        try {
            // Import custom vocabulary
            if (data.customVocabulary && Array.isArray(data.customVocabulary)) {
                for (const vocabEntry of data.customVocabulary) {
                    this.addTerm(vocabEntry.term, {
                        pronunciation: vocabEntry.pronunciation,
                        category: vocabEntry.category,
                        frequency: vocabEntry.frequency,
                        aliases: vocabEntry.aliases
                    });
                }
            }

            // Import replacement rules
            if (data.replacementRules && Array.isArray(data.replacementRules)) {
                for (const rule of data.replacementRules) {
                    this.addRule(rule.pattern, rule.replacement, {
                        enabled: rule.enabled,
                        priority: rule.priority
                    });
                }
            }

            // Import auto-learned vocabulary (optional)
            if (data.autoLearnedVocabulary && Array.isArray(data.autoLearnedVocabulary)) {
                for (const term of data.autoLearnedVocabulary) {
                    this.autoLearnTerm(term.term, {
                        category: term.category,
                        context: term.context
                    });
                }
            }

            console.log(`VocabularyManager: Imported vocabulary successfully`);
            return true;
        } catch (error) {
            console.error('VocabularyManager: Error importing vocabulary:', error.message);
            return false;
        }
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get vocabulary statistics
     */
    getStats() {
        return {
            termsAdded: this.stats.termsAdded,
            rulesAdded: this.stats.rulesAdded,
            termsUsed: this.stats.termsUsed,
            rulesApplied: this.stats.rulesApplied,
            autoLearnedTerms: this.stats.autoLearnedTerms,
            customVocabularySize: this.vocabulary.size,
            replacementRuleCount: this.replacementRules.size,
            autoLearnedSize: this.autoLearnedVocabulary.size
        };
    }

    /**
     * Clear all vocabulary and rules
     */
    clear() {
        this.vocabulary.clear();
        this.replacementRules.clear();
        this.autoLearnedVocabulary.clear();
        console.log('VocabularyManager: Cleared all vocabulary and rules');
    }

    /**
     * Get term by category
     */
    getTermsByCategory(category) {
        return Array.from(this.vocabulary.values())
            .filter(term => term.category === category);
    }

    /**
     * Get most frequently used terms
     */
    getMostUsedTerms(limit = 10) {
        return Array.from(this.vocabulary.values())
            .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
            .slice(0, limit);
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            termsAdded: 0,
            rulesAdded: 0,
            termsUsed: 0,
            rulesApplied: 0,
            autoLearnedTerms: 0
        };
    }
}

module.exports = VocabularyManager;
