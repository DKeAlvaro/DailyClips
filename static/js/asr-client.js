class ASRProcessor {
    constructor() {
        if (!('webkitSpeechRecognition' in window)) {
            throw new Error('Web Speech API is not supported in this browser');
        }
        this.recognition = null;
        this.isListening = false;
        this.accumulatedText = '';  // Add accumulated text storage
        this.subtitles = [];
    }

    async loadSubtitles(videoPath) {
        console.log('Loading subtitles for video:', videoPath);
        const srtPath = videoPath.replace('.mp4', '.srt').replace('videos', 'subtitles');
        try {
            const response = await fetch(`./static/${srtPath}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const srtContent = await response.text();
            console.log('Fetched SRT content:', srtContent.substring(0, 100) + '...');
            this.subtitles = this.parseSRT(srtContent);
            console.log('Parsed subtitles:', this.subtitles);
            return this.subtitles;
        } catch (error) {
            console.error('Error loading subtitles:', error);
            return [];
        }
    }

    parseSRT(data) {
        const subtitles = [];
        const lines = data.split('\n');
        let currentSub = null;
        let state = 'id'; // Possible states: 'id', 'times', 'text'
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                if (currentSub) {
                    subtitles.push(currentSub);
                    currentSub = null;
                    state = 'id';
                }
                continue;
            }
            
            if (state === 'id') {
                currentSub = { id: parseInt(trimmedLine) };
                state = 'times';
            } else if (state === 'times') {
                const times = trimmedLine.split(' --> ');
                if (times.length === 2) {
                    currentSub.start = this.parseTime(times[0].trim());
                    currentSub.end = this.parseTime(times[1].trim());
                    state = 'text';
                }
            } else if (state === 'text') {
                if (!currentSub.text) {
                    currentSub.text = trimmedLine;
                } else {
                    currentSub.text += '\n' + trimmedLine;
                }
            }
        }
        
        if (currentSub) {
            subtitles.push(currentSub);
        }
        
        return subtitles;
    }
    
    parseTime(timeStr) {
        const parts = timeStr.split(':');
        if (parts.length === 3) {
            const lastPart = parts[2].split(',');
            return parseFloat(parts[0]) * 3600 + 
                   parseFloat(parts[1]) * 60 + 
                   parseFloat(lastPart[0]) + 
                   parseFloat(lastPart[1]) / 1000;
        }
        return 0;
    }

    async processAudio(audioBlob, expectedText) {
        if (this.isListening) {
            this.stopListening();
        }

        this.accumulatedText = '';  // Reset accumulated text for new recording

        return new Promise((resolve, reject) => {
            // Create a new instance for each recognition
            this.recognition = new webkitSpeechRecognition();
            this.recognition.continuous = true;  // Changed to true for continuous listening
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                // Accumulate results instead of stopping
                const latestText = event.results[event.results.length - 1][0].transcript;
                this.accumulatedText += ' ' + latestText;
                const results = this.compareTexts(this.accumulatedText.trim(), expectedText);
                
                // Store progress but don't show it
                if (this.onProgressCallback) {
                    this.onProgressCallback({
                        success: true,
                        results,
                        isProgress: true
                    });
                }
            };

            this.recognition.onerror = (event) => {
                // Don't stop on error, just log it
                console.error('Recognition error:', event.error);
                // Restart recognition if it's still supposed to be listening
                if (this.isListening) {
                    try {
                        this.recognition.start();
                    } catch (error) {
                        console.error('Error restarting recognition:', error);
                    }
                }
            };

            this.recognition.onend = () => {
                // Restart recognition if it's still supposed to be listening
                if (this.isListening) {
                    try {
                        this.recognition.start();
                    } catch (error) {
                        console.error('Error restarting recognition:', error);
                    }
                } else {
                    // Only resolve when we've actually stopped listening
                    const finalResults = this.compareTexts(this.accumulatedText.trim(), expectedText);
                    resolve({
                        success: true,
                        results: finalResults,
                        isProgress: false
                    });
                }
            };

            try {
                this.recognition.start();
                this.isListening = true;
            } catch (error) {
                reject({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            try {
                this.isListening = false;  // Set this first so onend knows not to restart
                this.recognition.stop();
            } catch (error) {
                console.error('Error stopping recognition:', error);
            }
        }
    }

    // Add method to set progress callback
    setProgressCallback(callback) {
        this.onProgressCallback = callback;
    }

    compareTexts(recordedText, expectedText) {
        const cleanText = (text) => text.toLowerCase()
            .replace(/[^\w\s]|_/g, "")
            .replace(/\s+/g, " ")
            .trim();

        console.log('Comparing recorded text:', recordedText);
        console.log('With expected text:', expectedText);
        
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
            
            // Update category and score based on similarity percentage
            if (bestMatch !== '-') {
                const maxLength = Math.max(expectedWord.length, bestMatch.length);
                const similarityPercentage = ((maxLength - bestDistance) / maxLength) * 100;
                
                if (similarityPercentage >= 50) {
                    categories[expectedIndex] = 1; // Near match
                    correctWords += 0.5; // Half point for near matches
                } else {
                    categories[expectedIndex] = 2; // Not similar enough
                }
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
