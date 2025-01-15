class ASRProcessor {
    constructor() {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error('Web Speech API is not supported in this browser');
        }
        this.recognition = null;
        this.isListening = false;
        this.accumulatedText = '';
    }

    startRecording() {
        console.log('[ASR Debug] Starting recording immediately...');
        
        if (this.isListening) {
            console.log('[ASR Debug] Already recording, stopping previous session');
            this.stopListening();
        }

        // Create a new instance for each recording
        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true; // Changed to true to get real-time results
        this.recognition.lang = 'en-US';
        this.accumulatedText = ''; // Reset accumulated text

        this.recognition.onstart = () => {
            console.log('[ASR Debug] Recognition started at:', new Date().toISOString());
            this.isListening = true;
        };

        this.recognition.onresult = (event) => {
            // Get the latest result
            const latestResult = event.results[event.results.length - 1][0].transcript;
            console.log('[ASR Debug] Latest result:', latestResult);
            
            // Update accumulated text only with final results
            if (event.results[event.results.length - 1].isFinal) {
                this.accumulatedText = this.accumulatedText + ' ' + latestResult;
                console.log('[ASR Debug] Accumulated final text:', this.accumulatedText.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.error('[ASR Debug] Recognition error:', event.error);
            this.isListening = false;
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                console.log('[ASR Debug] Recognition ended unexpectedly, restarting...');
                this.recognition.start();
            }
        };

        try {
            this.recognition.start();
        } catch (error) {
            console.error('[ASR Debug] Failed to start recording:', error);
            throw error;
        }
    }

    async stopAndProcess(expectedText) {
        console.log('[ASR Debug] Stopping recording and processing results...');
        this.isListening = false;
        
        return new Promise((resolve, reject) => {
            if (!this.recognition) {
                reject(new Error('No recording in progress'));
                return;
            }

            const processResults = () => {
                if (this.accumulatedText) {
                    console.log('[ASR Debug] Processing final text:', this.accumulatedText);
                    const results = this.compareTexts(this.accumulatedText.trim(), expectedText);
                    console.log('[ASR Debug] Final results:', results);
                    resolve({
                        success: true,
                        results
                    });
                } else {
                    reject(new Error('No speech detected'));
                }
            };

            // If recognition is still running, wait for it to end
            if (this.recognition.state === 'running') {
                this.recognition.onend = processResults;
                this.recognition.stop();
            } else {
                processResults();
            }
        });
    }

    stopListening() {
        if (this.recognition) {
            this.isListening = false;
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('[ASR Debug] Error stopping recognition:', error);
            }
        }
    }

    compareTexts(recordedText, expectedText) {
        const cleanText = (text) => text.toLowerCase()
            .replace(/[^\w\s]|_/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const recordedWords = cleanText(recordedText).split(" ");
        const expectedWords = cleanText(expectedText).split(" ");

        const wordPairs = Array(expectedWords.length).fill(null);
        const categories = Array(expectedWords.length).fill(2); // Initialize all as no match
        let correctWords = 0;
        const usedRecordedIndices = new Set();

        // First pass: Map exact matches
        for (let i = 0; i < expectedWords.length; i++) {
            const expectedWord = expectedWords[i];
            // Look for exact match in recorded words
            const exactMatchIndex = recordedWords.findIndex((word, idx) => 
                !usedRecordedIndices.has(idx) && word === expectedWord
            );
            
            if (exactMatchIndex !== -1) {
                wordPairs[i] = [expectedWord, expectedWord];
                categories[i] = 0; // Exact match
                correctWords++;
                usedRecordedIndices.add(exactMatchIndex);
            }
        }

        // Second pass: Handle remaining words with Levenshtein distance
        const remainingExpectedIndices = expectedWords.map((_, i) => i).filter(i => wordPairs[i] === null);
        
        // Pre-calculate Levenshtein distances for remaining words
        const distanceMatrix = remainingExpectedIndices.map(i => {
            const expected = expectedWords[i];
            return recordedWords.map((recorded, j) => 
                usedRecordedIndices.has(j) ? Infinity : 
                expected === recorded ? 0 : 
                this.levenshteinDistance(expected, recorded)
            );
        });

        // Match remaining words
        for (let i = 0; i < remainingExpectedIndices.length; i++) {
            const expectedIndex = remainingExpectedIndices[i];
            const expectedWord = expectedWords[expectedIndex];
            let bestMatch = '-';
            let bestDistance = Infinity;
            let bestRecordedIndex = -1;

            // Find best match among unused recorded words
            for (let j = 0; j < recordedWords.length; j++) {
                if (usedRecordedIndices.has(j)) continue;
                const distance = distanceMatrix[i][j];
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = recordedWords[j];
                    bestRecordedIndex = j;
                }
            }

            wordPairs[expectedIndex] = [expectedWord, bestMatch];
            
            // Update category and score
            if (bestMatch !== '-') {
                categories[expectedIndex] = 1; // Near match
                correctWords += 0.5; // Half point for near matches
                usedRecordedIndices.add(bestRecordedIndex);
            }
        }

        return {
            recording_transcript: recordedText,
            real_and_transcribed_words: wordPairs,
            pronunciation_accuracy: (correctWords / expectedWords.length) * 100,
            pronunciation_categories: categories
        };
    }

    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(
                        dp[i - 1][j],     // deletion
                        dp[i][j - 1],     // insertion
                        dp[i - 1][j - 1]  // substitution
                    );
                }
            }
        }
        return dp[m][n];
    }
}
