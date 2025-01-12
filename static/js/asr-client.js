// Suppress ONNX runtime warnings
console.warn = (function(originalWarn) {
    return function(msg, ...args) {
        if (!msg.includes('[W:onnxruntime:')) {
            originalWarn.apply(console, [msg, ...args]);
        }
    };
})(console.warn);

class ASRProcessor {
    constructor() {
        this.model = null;
        this.isLoading = false;
        this.loadModel();
    }

    async loadModel() {
        if (this.isLoading) return;
        this.isLoading = true;
        
        try {
            // Load Whisper model and utils
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.15.1');
            this.model = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
            console.log('ASR model loaded successfully');
        } catch (error) {
            console.error('Error loading ASR model:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async processAudio(audioBlob, expectedText) {
        if (!this.model) {
            throw new Error('Model not loaded');
        }

        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Create audio context
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            // Decode audio data
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get audio data as Float32Array
            const audioData = audioBuffer.getChannelData(0);

            // Process with Whisper
            const transcription = await this.model(audioData);
            const recordedText = transcription.text.trim();

            // Process results
            const results = this.compareTexts(recordedText, expectedText);
            console.log('ASR Results:', results);
            return {
                success: true,
                results: results
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
        // Convert both texts to lowercase and split into words
        const recordedWords = recordedText.toLowerCase().split(/\s+/);
        const expectedWords = expectedText.toLowerCase().split(/\s+/);

        // Create word pairs and calculate categories
        const wordPairs = [];
        const categories = [];
        let correctWords = 0;

        // Match words and determine categories
        for (let i = 0; i < expectedWords.length; i++) {
            const expectedWord = expectedWords[i];
            const recordedWord = recordedWords[i] || '-';
            
            wordPairs.push([expectedWord, recordedWord]);
            
            // Calculate category (0: perfect, 1: medium, 2: bad)
            let category;
            if (recordedWord === expectedWord) {
                category = 0;
                correctWords++;
            } else if (recordedWord === '-' || this.levenshteinDistance(expectedWord, recordedWord) > expectedWord.length / 2) {
                category = 2;
            } else {
                category = 1;
            }
            
            categories.push(category);
        }

        // Calculate accuracy
        const accuracy = (correctWords / expectedWords.length) * 100;

        return {
            recording_transcript: recordedText,
            real_and_transcribed_words: wordPairs,
            pronunciation_accuracy: accuracy,
            pronunciation_categories: categories
        };
    }

    levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

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