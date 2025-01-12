// Suppress ONNX runtime warnings
console.warn = (function(originalWarn) {
    return function(msg, ...args) {
        if (typeof msg === 'string' && !msg.includes('[W:onnxruntime:')) {
            originalWarn.apply(console, [msg, ...args]);
        }
    };
})(console.warn);

class ASRProcessor {
    constructor() {
        this.model = null;
        this.isLoading = false;
        // Create a single AudioContext to reuse for all audio processing
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });
        // Load model once upon instantiation
        this.loadModel();
    }

    async loadModel() {
        if (this.isLoading || this.model) return;
        this.isLoading = true;
        
        try {
            // Dynamically import Transformers
            const { pipeline } = await import(
                'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.1/dist/transformers.js'
            );
            
            // Initialize the ASR pipeline (tiny English model)
            this.model = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        } catch (error) {
            console.error('Error loading ASR model:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async processAudio(audioBlob, expectedText) {
        // Wait until model is ready
        if (!this.model && !this.isLoading) await this.loadModel();
        if (!this.model) throw new Error('Model not loaded');

        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Decode audio data using the single, shared AudioContext
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Extract float data from the first channel
            const audioData = audioBuffer.getChannelData(0);
            console.log('Start transcription');
            const startTime = performance.now(); // Start timing
            const transcription = await this.model(audioData);
            const endTime = performance.now(); // End timing
            const transcriptionTime = endTime - startTime; // Calculate time taken
            console.log(`Transcription time: ${(transcriptionTime / 10000).toFixed(2)} seconds`); // Log the time taken
            const recordedText = transcription.text.trim();

            // Compare results
            const startTime2 = performance.now(); // Start timing
            const results = this.compareTexts(recordedText, expectedText);
            const endTime2 = performance.now(); // End timing
            const comparisonTime = endTime2 - startTime2; // Calculate time taken
            console.log(`Comparison time: ${(comparisonTime / 10000).toFixed(2)} seconds`); // Log the time taken


            return {
                success: true,
                results
            };
        } catch (error) {
            console.error('Error processing audio:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    compareTexts(recordedText, expectedText) {
        const cleanText = (text) => text.toLowerCase()
            .replace(/[^\w\s]|_/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const recordedWords = cleanText(recordedText).split(" ");
        const expectedWords = cleanText(expectedText).split(" ");

        const wordPairs = [];
        const categories = [];
        let correctWords = 0;
        const usedRecordedIndices = new Set();

        // Pre-calculate Levenshtein distances
        const distanceMatrix = expectedWords.map(expected =>
            recordedWords.map(recorded =>
                expected === recorded ? 0 : this.levenshteinDistance(expected, recorded)
            )
        );

        for (let i = 0; i < expectedWords.length; i++) {
            const expectedWord = expectedWords[i];
            let bestMatch = '-';
            let bestDistance = Infinity;
            let bestIndex = -1;

            // Find best match among unused recorded words
            for (let j = 0; j < recordedWords.length; j++) {
                if (usedRecordedIndices.has(j)) continue;
                const distance = distanceMatrix[i][j];
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = recordedWords[j];
                    bestIndex = j;
                }
            }

            wordPairs.push([expectedWord, bestMatch]);

            // Category assignment
            //  0 => exact match
            //  1 => near match
            //  2 => no match
            const category = (bestMatch === expectedWord) ? 0 :
                             (bestMatch === '-')          ? 2 : 1;

            if (category === 0) correctWords++;
            if (category === 1) correctWords += 0.5;  // half-point for near matches

            categories.push(category);

            if (bestIndex !== -1) usedRecordedIndices.add(bestIndex);
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
