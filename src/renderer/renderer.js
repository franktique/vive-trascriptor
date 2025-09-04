document.addEventListener('DOMContentLoaded', () => {
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const translateBtn = document.getElementById('translate-btn');
    const swapBtn = document.getElementById('swap-langs');
    const clearBtn = document.getElementById('clear-btn');
    const openFileBtn = document.getElementById('open-file');
    const saveFileBtn = document.getElementById('save-file');

    translateBtn.addEventListener('click', async () => {
        const text = sourceText.value.trim();
        if (!text) {
            alert('Please enter text to translate');
            return;
        }

        translateBtn.disabled = true;
        translateBtn.textContent = 'Translating...';
        targetText.value = 'Translating...';

        try {
            const translation = await mockTranslate(text, sourceLang.value, targetLang.value);
            targetText.value = translation;
        } catch (error) {
            targetText.value = 'Translation error occurred';
            console.error('Translation error:', error);
        } finally {
            translateBtn.disabled = false;
            translateBtn.textContent = 'Translate';
        }
    });

    swapBtn.addEventListener('click', () => {
        if (sourceLang.value === 'auto') {
            alert('Cannot swap when source language is auto-detect');
            return;
        }

        const tempLang = sourceLang.value;
        const tempText = sourceText.value;
        
        sourceLang.value = targetLang.value;
        targetLang.value = tempLang;
        sourceText.value = targetText.value;
        targetText.value = tempText;
    });

    clearBtn.addEventListener('click', () => {
        sourceText.value = '';
        targetText.value = '';
    });

    openFileBtn.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.openFile) {
            try {
                const fileContent = await window.electronAPI.openFile();
                if (fileContent) {
                    sourceText.value = fileContent;
                }
            } catch (error) {
                console.error('Error opening file:', error);
                alert('Error opening file');
            }
        } else {
            alert('File operations not available in this environment');
        }
    });

    saveFileBtn.addEventListener('click', async () => {
        const translation = targetText.value.trim();
        if (!translation) {
            alert('No translation to save');
            return;
        }

        if (window.electronAPI && window.electronAPI.saveFile) {
            try {
                await window.electronAPI.saveFile(translation);
            } catch (error) {
                console.error('Error saving file:', error);
                alert('Error saving file');
            }
        } else {
            alert('File operations not available in this environment');
        }
    });

    sourceText.addEventListener('input', () => {
        if (sourceText.value.trim() === '') {
            targetText.value = '';
        }
    });

    async function mockTranslate(text, from, to) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockTranslations = {
            'hello': { 'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'it': 'ciao' },
            'goodbye': { 'es': 'adiós', 'fr': 'au revoir', 'de': 'auf wiedersehen', 'it': 'arrivederci' },
            'thank you': { 'es': 'gracias', 'fr': 'merci', 'de': 'danke', 'it': 'grazie' },
            'how are you': { 'es': 'cómo estás', 'fr': 'comment allez-vous', 'de': 'wie geht es dir', 'it': 'come stai' }
        };

        const lowerText = text.toLowerCase();
        if (mockTranslations[lowerText] && mockTranslations[lowerText][to]) {
            return mockTranslations[lowerText][to];
        }

        return `[Mock translation of "${text}" from ${from} to ${to}]`;
    }
});