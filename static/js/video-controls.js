class VideoController {
    constructor() {
        this.video = document.getElementById('mainVideo');
        this.videoContainer = document.querySelector('.video-container');
        this.playPauseBtn = document.querySelector('.desktop-controls .play-pause-btn');
        this.recordBtn = document.querySelector('.desktop-controls .record-btn');
        this.mobilePlayPauseBtn = document.querySelector('.mobile-controls .play-pause-btn');
        this.mobileRecordBtn = document.querySelector('.mobile-controls .record-btn');
        this.currentSubtitleIndex = -1;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.hasStarted = false;
        this.isTransitioning = false;
        this.asrProcessor = new ASRProcessor();
        this.accuracies = [];  // Store accuracies for current session
        this.microphoneStream = null;  // Store microphone stream for cleanup

        // Create loading spinner
        this.loadingSpinner = document.createElement('div');
        this.loadingSpinner.className = 'loading-spinner';
        this.loadingSpinner.style.display = 'none';
        document.querySelector('.controls').appendChild(this.loadingSpinner);

        // Create results overlay
        this.resultsOverlay = document.createElement('div');
        this.resultsOverlay.className = 'results-overlay';
        this.videoContainer.appendChild(this.resultsOverlay);

        // Create sounds
        this.wrongSound = new Audio('/static/sound/wrong.mp3');
        this.coinSound = new Audio('/static/sound/coin.mp3');
        this.middleSound = new Audio('/static/sound/middle.mp3');
        this.goodSound = new Audio('/static/sound/good.mp3');
        [this.wrongSound, this.coinSound, this.middleSound, this.goodSound].forEach(sound => {
            sound.volume = 0.5;
        });

        this.initializeControls();
        this.setupVideoNavigation();
        this.setup3DEffect();

        // Add this to log subtitles data when controller is initialized
        console.log('Loaded subtitles:', subtitlesData);
        
        // Optional: Log each subtitle in a more readable format
        // console.log('Subtitle breakdown:');
        // subtitlesData.forEach((subtitle, index) => {
        //     console.log(`Subtitle ${index + 1}:`);
        //     console.log(`  Start: ${subtitle.start}ms (${this.formatTime(subtitle.start)})`);
        //     console.log(`  End: ${subtitle.end}ms (${this.formatTime(subtitle.end)})`);
        //     console.log(`  Text: "${subtitle.text}"`);
        //     console.log('---');
        // });
    }

    initializeControls() {
        // Video playback controls for desktop
        this.playPauseBtn.addEventListener('click', () => this.startVideo());
        // Video playback controls for mobile
        this.mobilePlayPauseBtn.addEventListener('click', () => this.startVideo());

        this.video.addEventListener('timeupdate', () => this.checkSubtitles());
        this.video.addEventListener('play', () => {
            this.hasStarted = true;
            this.playPauseBtn.style.display = 'none';
            this.mobilePlayPauseBtn.style.display = 'none';
            document.querySelector('.video-container').classList.add('video-playing');
            this.updateNavigationVisibility();
        });
        this.video.addEventListener('ended', () => {
            this.hasStarted = false;
            this.playPauseBtn.style.display = 'block';
            this.mobilePlayPauseBtn.style.display = 'block';
            this.playPauseBtn.textContent = 'Play Again';
            this.mobilePlayPauseBtn.textContent = 'Play Again';
            
            // Hide the last results section
            const resultsSection = document.querySelector('.results-section');
            if (resultsSection) {
                resultsSection.remove();
            }
            
            // Calculate and show average accuracy when video ends
            if (this.accuracies.length > 0) {
                const averageAccuracy = this.accuracies.reduce((a, b) => a + b, 0) / this.accuracies.length;
                
                // Send the average accuracy to the server
                fetch('/save_score', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        score: averageAccuracy,
                        video_index: window.location.search.split('=')[1] || '0'  // Get video index from URL
                    })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Score saved:', data);
                    // Update chart with the saved score and show current score in title
                    accuracyChart.options.plugins.title.text = `Your Score: ${averageAccuracy.toFixed(1)}%`;
                    updateAccuracyChart(averageAccuracy);
                    const chartContainer = document.querySelector('.chart-container');
                    if (chartContainer) {
                        chartContainer.classList.remove('hidden');
                    }
                })
                .catch(error => {
                    console.error('Error saving score:', error);
                    // Still update chart even if save fails
                    accuracyChart.options.plugins.title.text = `Your Score: ${averageAccuracy.toFixed(1)}%`;
                    updateAccuracyChart(averageAccuracy);
                    const chartContainer = document.querySelector('.chart-container');
                    if (chartContainer) {
                        chartContainer.classList.remove('hidden');
                    }
                });
            }

            // Show SVG and legend
            const svgElement = document.querySelector('.floating-svg');
            const legendElement = document.querySelector('.clip-legend');
            if (svgElement) {
                svgElement.style.opacity = '1';
            }
            if (legendElement) {
                legendElement.style.opacity = '1';
            }
            
            this.updateNavigationVisibility();
        });

        // Initialize audio recording
        this.initializeRecording();
        this.updateNavigationVisibility();
    }

    setupVideoNavigation() {
document.querySelectorAll('.video-nav').forEach(nav => {
    nav.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isTransitioning) return;

        const direction = nav.classList.contains('prev') ? 'prev' : 'next';
                const videoContainer = document.querySelector('.video-container');
                this.isTransitioning = true;

                // Add fade out animation
                videoContainer.classList.add('video-fade-out');

                setTimeout(() => {
                    window.location.href = nav.href;
                }, 500);
    });
});

        // Add fade in animation on load
window.addEventListener('load', () => {
            const videoContainer = document.querySelector('.video-container');
    videoContainer.classList.add('video-fade-in');
});
    }

    startVideo() {
        if (this.video.ended) {
            // Reset the session
            this.currentSubtitleIndex = -1;
            this.hasStarted = false;
            this.isRecording = false;
            this.audioChunks = [];
            this.accuracies = [];  // Reset accuracies array
            
            // Remove results section if it exists
            const resultsSection = document.querySelector('.results-section');
            if (resultsSection) {
                resultsSection.remove();
            }
            
            // Reset video time to beginning
            this.video.currentTime = 0;
        }
        
        this.video.play();
        // Fade out the SVG, legend and chart
        const svgElement = document.querySelector('.floating-svg');
        const legendElement = document.querySelector('.clip-legend');
        const chartContainer = document.querySelector('.chart-container');
        if (svgElement) {
            svgElement.style.opacity = '0';
        }
        if (legendElement) {
            legendElement.style.opacity = '0';
        }
        if (chartContainer) {
            chartContainer.classList.add('hidden');
        }
    }

    updateNavigationVisibility() {
        const navButtons = document.querySelectorAll('.video-nav');
        navButtons.forEach(btn => {
            btn.style.display = (!this.hasStarted || this.video.ended) ? 'block' : 'none';
        });
    }

    async initializeRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Store the stream for cleanup
            this.microphoneStream = stream;
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });
            
            // Add cleanup when user leaves
            window.addEventListener('beforeunload', () => {
                if (this.microphoneStream) {
                    this.microphoneStream.getTracks().forEach(track => track.stop());
                }
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => this.processRecording();
            
            // Set up record buttons
            this.recordBtn.addEventListener('click', () => this.toggleRecording());
            this.mobileRecordBtn.addEventListener('click', () => this.toggleRecording());
            
        } catch (error) {
            console.error('Error initializing recording:', error);
            this.recordBtn.textContent = 'Microphone Error';
            this.mobileRecordBtn.textContent = 'Microphone Error';
            this.recordBtn.disabled = true;
            this.mobileRecordBtn.disabled = true;
        }
    }

    togglePlayPause() {
        if (this.video.paused) {
            this.video.play();
        } else {
            this.video.pause();
        }
    }

    checkSubtitles() {
        const currentTime = this.video.currentTime * 1000; // Convert to milliseconds
    
        // Log current video position
        // console.log(`Current video position: ${this.formatTime(currentTime)}`);
    
        for (let i = 0; i < subtitlesData.length; i++) {
            const subtitle = subtitlesData[i];
    
            // Check if current time is within 1 second after the subtitle's end time
            if (currentTime >= subtitle.end && currentTime <= subtitle.end + 1000) {
                if (this.currentSubtitleIndex !== i) {
                    this.currentSubtitleIndex = i;
                    console.log('Matched subtitle:', subtitle);
                    console.log(`Pausing at subtitle ${i + 1}: "${subtitle.text}"`);
    
                    // Pause the video and show the record button
                    this.video.pause();
                    this.showRecordButton();
                    return;
                }
            }
        }
    }
    showRecordButton() {
        this.playPauseBtn.style.display = 'none';
        this.mobilePlayPauseBtn.style.display = 'none';
        this.loadingSpinner.style.display = 'none';
        this.recordBtn.style.display = 'block';
        this.mobileRecordBtn.style.display = 'block';
        this.recordBtn.textContent = 'Record';
        this.mobileRecordBtn.textContent = 'Record';
        this.recordBtn.classList.remove('recording');
        this.mobileRecordBtn.classList.remove('recording');
    }

    showPlayButton() {
        this.recordBtn.style.display = 'none';
        this.mobileRecordBtn.style.display = 'none';
        this.loadingSpinner.style.display = 'none';
        this.mobileLoadingSpinner.style.display = 'none';
        this.playPauseBtn.style.display = 'block';
        this.mobilePlayPauseBtn.style.display = 'block';
        const buttonText = this.video.ended ? 'Try Again' : 'Play';
        this.playPauseBtn.textContent = buttonText;
        this.mobilePlayPauseBtn.textContent = buttonText;
    }

    showLoadingSpinner() {
        this.recordBtn.style.display = 'none';
        this.mobileRecordBtn.style.display = 'none';
        this.playPauseBtn.style.display = 'none';
        this.mobilePlayPauseBtn.style.display = 'none';
        
        // Create mobile loading spinner if it doesn't exist
        if (!this.mobileLoadingSpinner) {
            this.mobileLoadingSpinner = document.createElement('div');
            this.mobileLoadingSpinner.className = 'loading-spinner';
            document.querySelector('.mobile-controls').appendChild(this.mobileLoadingSpinner);
        }
        
        this.loadingSpinner.style.display = 'block';
        this.mobileLoadingSpinner.style.display = 'block';
    }

    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    startRecording() {
        this.audioChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordBtn.textContent = 'Stop Recording';
        this.mobileRecordBtn.textContent = 'Stop Recording';
        this.recordBtn.classList.add('recording');
        this.mobileRecordBtn.classList.add('recording');
    }

    stopRecording() {
        this.mediaRecorder.stop();
        this.isRecording = false;
        this.showLoadingSpinner();
    }

    async processRecording() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        try {
            // Convert webm to wav
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000  // Ensure consistent sample rate
            });
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Create WAV file
            const wavBlob = await this.audioBufferToWav(audioBuffer);
            
            try {
                console.log('Processing audio with client-side ASR...');
                const results = await this.asrProcessor.processAudio(
                    wavBlob,
                    subtitlesData[this.currentSubtitleIndex].text
                );
                
                if (results.success) {
                    console.log('ASR Results:', results);
                    this.showResults(results.results);
                } else {
                    console.error('Error in results:', results.error);
                    this.showRecordButton(); // Allow retry
                }
                
            } catch (error) {
                console.error('Error processing audio:', error);
                this.showRecordButton(); // Allow retry
            }
            
        } catch (error) {
            console.error('Error converting audio:', error);
            this.showRecordButton(); // Allow retry
        }
    }

    async audioBufferToWav(buffer) {
    const numChannels = 1;
        const sampleRate = 16000;
    const format = 1; // PCM
    const bitDepth = 16;
    
        const dataLength = buffer.length * numChannels * (bitDepth / 8);
        const arrayBuffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(arrayBuffer);
    
    // WAV header
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
        const data = buffer.getChannelData(0);
    let offset = 44;
        for (let i = 0; i < data.length; i++) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }
    
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    setup3DEffect() {
        this.videoContainer.addEventListener('mousemove', (e) => {
            if (this.isTransitioning) return;

            const rect = this.videoContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Calculate rotation based on mouse position (reduced from 10 to 5 degrees)
            const xRotation = ((y - rect.height / 2) / rect.height) * 5;
            const yRotation = ((x - rect.width / 2) / rect.width) * 5;
            
            // Apply smooth transform (reduced scale from 1.02 to 1.01)
            this.videoContainer.style.transform = `
                perspective(1000px)
                rotateX(${-xRotation}deg)
                rotateY(${yRotation}deg)
                scale3d(1.01, 1.01, 1.01)
            `;
        });

        // Reset transform when mouse leaves
        this.videoContainer.addEventListener('mouseleave', () => {
            if (this.isTransitioning) return;
            this.videoContainer.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
        });

        // Add transition class for smoother effect
        this.videoContainer.addEventListener('mouseenter', () => {
            if (this.isTransitioning) return;
            this.videoContainer.style.transition = 'transform 0.1s ease';
        });

        this.videoContainer.addEventListener('mouseleave', () => {
            if (this.isTransitioning) return;
            this.videoContainer.style.transition = 'transform 0.3s ease';
        });
    }

    // Add this helper method to format milliseconds into readable time
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
    }

    showResults(results) {
        // Play appropriate sound based on score
        const score = results.pronunciation_accuracy;
        if (score <= 30) {
            this.wrongSound.play();
        } else if (score <= 50) {
            this.coinSound.play();
        } else if (score <= 70) {
            this.middleSound.play();
        } else {
            this.goodSound.play();
        }

        // Store the accuracy for later averaging
        this.accuracies.push(score);

        // Create results section if it doesn't exist
        let resultsSection = document.querySelector('.results-section');
        if (!resultsSection) {
            resultsSection = document.createElement('div');
            resultsSection.className = 'results-section';
            this.videoContainer.parentNode.insertBefore(resultsSection, this.videoContainer.nextSibling);
        }

        // Create the content
        let content = `
            <div class="accuracy-value">Accuracy ${results.pronunciation_accuracy.toFixed(1)}%</div>
            <div class="transcript-words">
        `;

        // Add each word with its color and tooltip
        results.real_and_transcribed_words.forEach((pair, index) => {
            const [expected, pronounced] = pair;
            const category = results.pronunciation_categories[index];
            
            let colorClass;
            switch(category) {
                case 0: colorClass = 'correct'; break;
                case 1: colorClass = 'warning'; break;
                case 2: colorClass = 'error'; break;
            }

            let hoverContent = '';
            if (category !== 0) {
                hoverContent = `
                    <div class="hover-text">
                        <span class="user-word">${pronounced === '-' ? 'None' : pronounced}</span>
                        <span class="arrow">→</span>
                        <span class="right-word">${expected}</span>
                    </div>
                `;
            }

            content += `
                <span class="word ${colorClass}">
                    ${expected}
                    ${hoverContent}
                </span>
            `;
        });

        content += `</div>`;

        // Update the results section
        resultsSection.innerHTML = content;

        // Show play button
        this.showPlayButton();
    }
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoController();
}); 