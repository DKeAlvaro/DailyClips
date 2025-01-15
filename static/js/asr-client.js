class ASRProcessor {
    constructor() {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error('Web Speech API is not supported in this browser');
        }
        this.recognition = null;
        this.isListening = false;
    }

    async processAudio(expectedText) {
        console.log('[ASR Debug] Starting real-time audio processing...');
        console.log('[ASR Debug] Expected text:', expectedText);

        if (this.isListening) {
            console.log('[ASR Debug] Already listening, stopping previous session');
            this.stopListening();
        }

        return new Promise((resolve, reject) => {
            // Create a new instance for each recognition
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            let recognitionStartTime = Date.now();
            let finalText = '';
            let lastInterimResult = '';

            this.recognition.onstart = () => {
                console.log('[ASR Debug] Recognition started at:', new Date().toISOString());
                this.isListening = true;
            };

            this.recognition.onresult = (event) => {
                const processingTime = Date.now() - recognitionStartTime;
                
                // Get the latest result
                const result = event.results[event.results.length - 1];
                
                if (result.isFinal) {
                    finalText = result[0].transcript;
                    console.log('[ASR Debug] Final result received after', processingTime, 'ms:', finalText);
                    console.log('[ASR Debug] Confidence:', result[0].confidence);
                } else {
                    const interimResult = result[0].transcript;
                    if (interimResult !== lastInterimResult) {
                        console.log('[ASR Debug] Interim result:', interimResult);
                        lastInterimResult = interimResult;
                    }
                }
            };

            this.recognition.onerror = (event) => {
                console.error('[ASR Debug] Recognition error:', event.error);
                console.error('[ASR Debug] Error details:', event);
                this.isListening = false;
                reject({
                    success: false,
                    error: event.error
                });
            };

            this.recognition.onend = () => {
                const totalTime = Date.now() - recognitionStartTime;
                console.log(`[ASR Debug] Recognition ended. Total time: ${totalTime}ms`);
                this.isListening = false;
                
                if (finalText) {
                    console.log('[ASR Debug] Processing final text:', finalText);
                    const results = this.compareTexts(finalText, expectedText);
                    console.log('[ASR Debug] Comparison results:', results);
                    resolve({
                        success: true,
                        results
                    });
                } else {
                    console.error('[ASR Debug] No text was recognized');
                    reject({
                        success: false,
                        error: 'No speech was recognized'
                    });
                }
            };

            try {
                console.log('[ASR Debug] Starting recognition...');
                this.recognition.start();
            } catch (error) {
                console.error('[ASR Debug] Error starting recognition:', error);
                reject({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.isListening = false;
            try {
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
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
