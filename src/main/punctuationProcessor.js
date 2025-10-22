/**
 * Punctuation Post-Processor
 * Adds capitalization and basic punctuation to raw Whisper output
 */

class PunctuationProcessor {
    constructor(options = {}) {
        this.settings = {
            enablePunctuation: options.enablePunctuation !== false,
            enableCapitalization: options.enableCapitalization !== false,
            useHeuristics: options.useHeuristics !== false
        };

        // Common sentence starters
        this.sentenceStarters = new Set([
            'the', 'a', 'an', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
            'what', 'which', 'who', 'when', 'where', 'why', 'how',
            'do', 'does', 'did', 'can', 'could', 'will', 'would', 'should',
            'is', 'are', 'was', 'were', 'be', 'being', 'been',
            'have', 'has', 'had', 'having',
            'this', 'that', 'these', 'those',
            'my', 'your', 'his', 'her', 'its', 'our', 'their'
        ]);

        // Common sentence terminators (words that often end sentences)
        this.sentenceTerminators = new Set([
            'now', 'then', 'today', 'tomorrow', 'yesterday',
            'end', 'done', 'finished', 'complete', 'thanks',
            'please', 'well', 'right', 'okay', 'ok', 'yes', 'no',
            'here', 'there', 'way', 'time', 'day', 'year', 'world'
        ]);

        // Common abbreviations to preserve
        this.abbreviations = new Set([
            'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
            'inc', 'ltd', 'corp', 'co', 'etc', 'vs', 'vs.',
            'e.g', 'i.e', 'a.m', 'p.m'
        ]);

        // Question indicators
        this.questionStarters = new Set([
            'what', 'which', 'who', 'when', 'where', 'why', 'how',
            'can', 'could', 'will', 'would', 'should', 'do', 'does', 'did'
        ]);

        // Statistics
        this.stats = {
            textProcessed: 0,
            punctuationAdded: 0,
            capitalizationFixed: 0
        };
    }

    /**
     * Process text with punctuation and capitalization
     */
    process(text) {
        if (!text || text.length === 0) {
            return text;
        }

        let processed = text.trim();

        // Apply punctuation rules
        if (this.settings.enablePunctuation && this.settings.useHeuristics) {
            processed = this.addPunctuation(processed);
        }

        // Apply capitalization rules
        if (this.settings.enableCapitalization) {
            processed = this.fixCapitalization(processed);
        }

        this.stats.textProcessed++;
        return processed;
    }

    /**
     * Add punctuation based on sentence structure heuristics
     */
    addPunctuation(text) {
        // Split into potential sentences (sequences of words)
        const sentences = this.splitIntoSentences(text);

        return sentences
            .map((sentence, index) => this.processSentence(sentence, index === sentences.length - 1))
            .join(' ')
            .trim();
    }

    /**
     * Split text into potential sentences
     */
    splitIntoSentences(text) {
        // Look for natural breaking points (pauses in speech flow)
        // Use heuristics: length, common terminators, conjunctions

        const words = text.split(/\s+/);
        const sentences = [];
        let currentSentence = [];
        let wordCount = 0;

        for (let i = 0; i < words.length; i++) {
            const word = words[i].toLowerCase().replace(/[^a-z0-9]/g, '');
            const isLastWord = i === words.length - 1;

            currentSentence.push(words[i]);
            wordCount++;

            // Check if sentence should end
            const shouldBreak =
                (wordCount >= 5 && this.sentenceTerminators.has(word)) ||
                (wordCount >= 8) ||
                (isLastWord);

            if (shouldBreak && currentSentence.length > 0) {
                sentences.push(currentSentence.join(' '));
                currentSentence = [];
                wordCount = 0;
            }
        }

        // Add any remaining words
        if (currentSentence.length > 0) {
            sentences.push(currentSentence.join(' '));
        }

        return sentences.filter(s => s.trim().length > 0);
    }

    /**
     * Process individual sentence to add appropriate punctuation
     */
    processSentence(sentence, isLast) {
        if (!sentence || sentence.trim().length === 0) {
            return sentence;
        }

        const trimmed = sentence.trim();
        const words = trimmed.split(/\s+/);
        const lastWord = words[words.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');

        // Check if already has punctuation
        if (/[.!?;:]$/.test(trimmed)) {
            return trimmed;
        }

        // Determine punctuation type
        let punctuation = '.'; // Default to period

        // Check if question
        if (this.questionStarters.has(words[0].toLowerCase().replace(/[^a-z]/g, ''))) {
            punctuation = '?';
        }
        // Check if exclamation (words indicating excitement)
        else if (this.isExclamatory(trimmed)) {
            punctuation = '!';
        }
        // Check if this is last sentence and short
        else if (isLast && words.length <= 3) {
            punctuation = '.';
        }

        return trimmed + punctuation;
    }

    /**
     * Detect if sentence is exclamatory
     */
    isExclamatory(sentence) {
        const exclamations = ['yeah', 'yes', 'wow', 'amazing', 'great', 'awesome',
            'wonderful', 'excellent', 'perfect', 'incredible', 'fantastic',
            'oh', 'ah', 'wow', 'hey', 'whoa'];

        const lowerSentence = sentence.toLowerCase();
        return exclamations.some(exc => lowerSentence.includes(exc));
    }

    /**
     * Fix capitalization following sentence/question/exclamation rules
     */
    fixCapitalization(text) {
        if (!text || text.length === 0) {
            return text;
        }

        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

        return sentences
            .map(sentence => {
                const trimmed = sentence.trim();
                if (trimmed.length === 0) return sentence;

                // Find first word (skip articles and prepositions in some contexts)
                const words = trimmed.split(/\s+/);
                let firstWordIndex = 0;

                // Capitalize first word of sentence
                words[firstWordIndex] = this.capitalizeWord(words[firstWordIndex]);

                // Capitalize proper nouns (all caps or mixed case patterns)
                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const cleanWord = word.replace(/[^a-z0-9]/gi, '');

                    // Capitalize words that look like proper nouns
                    if (this.isLikelyProperNoun(cleanWord)) {
                        words[i] = this.capitalizeWord(word);
                    }
                    // Don't decapitalize "I"
                    else if (cleanWord.toLowerCase() === 'i') {
                        words[i] = 'I' + (word.match(/[^a-z0-9i]/i) ? word.match(/[^a-z0-9i]/i)[0] : '');
                    }
                }

                return words.join(' ');
            })
            .join(' ');
    }

    /**
     * Capitalize a word, preserving trailing punctuation
     */
    capitalizeWord(word) {
        // Extract trailing punctuation
        const match = word.match(/^([a-z0-9]+)(.*)$/i);
        if (!match) return word;

        const [, letters, punctuation] = match;
        return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase() + punctuation;
    }

    /**
     * Detect if word is likely a proper noun
     */
    isLikelyProperNoun(word) {
        if (!word || word.length === 0) return false;

        // Single letter is usually I, don't capitalize
        if (word.length === 1 && word.toLowerCase() !== 'i') return false;

        // Words starting with capital in middle of sentence might be proper nouns
        // But we look at patterns instead
        const commonNouns = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'from',
            'of', 'for', 'with', 'by', 'about', 'as', 'is', 'are', 'was', 'were'
        ]);

        return !commonNouns.has(word.toLowerCase());
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            textProcessed: this.stats.textProcessed,
            punctuationAdded: this.stats.punctuationAdded,
            capitalizationFixed: this.stats.capitalizationFixed
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            textProcessed: 0,
            punctuationAdded: 0,
            capitalizationFixed: 0
        };
    }
}

module.exports = PunctuationProcessor;
