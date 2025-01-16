class VideoController {
    constructor() {
        this.video = document.getElementById('mainVideo');
        this.videoContainer = document.querySelector('.video-container');
        this.playPauseBtn = document.querySelector('.desktop-controls .play-pause-btn');
        this.recordBtn = document.querySelector('.desktop-controls .record-btn');
        this.mobilePlayPauseBtn = document.querySelector('.mobile-controls .play-pause-btn');
        this.mobileRecordBtn = document.querySelector('.mobile-controls .record-btn');
        this.currentSubtitleIndex = -1;
        this.isRecording = false;
        this.hasStarted = false;
        this.isTransitioning = false;
        this.asrProcessor = new ASRProcessor();
        // Set up progress callback for continuous updates but don't show them
        this.asrProcessor.setProgressCallback((results) => {
            // Just store the latest results but don't display them
            this.latestResults = results;
        });
        
        this.accuracies = [];  // Store accuracies for current session
        this.latestResults = null;  // Store latest results without showing them

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
        this.finishSound = new Audio('/static/sound/finish_sound.wav');
        [this.wrongSound, this.coinSound, this.middleSound, this.goodSound, this.finishSound].forEach(sound => {
            sound.volume = 0.5;
        });

        this.initializeControls();
        this.setupVideoNavigation();
        this.setup3DEffect();

        // Add this to log subtitles data when controller is initialized
        console.log('Loaded subtitles:', subtitlesData);
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
                
                // Create new chart container if it doesn't exist
                let chartContainer = document.querySelector('.chart-container');
                if (!chartContainer) {
                    chartContainer = document.createElement('div');
                    chartContainer.className = 'chart-container final';
                    chartContainer.innerHTML = '<canvas id="accuracyChart"></canvas>';
                    
                    // Create new legend element
                    const newLegend = document.createElement('div');
                    newLegend.className = 'clip-legend';
                    newLegend.textContent = document.querySelector('.clip-legend')?.textContent || '';
                    
                    // Insert legend and chart
                    const mainContent = document.querySelector('.main-content');
                    mainContent.insertBefore(newLegend, this.videoContainer.nextSibling);
                    mainContent.insertBefore(chartContainer, newLegend.nextSibling);
                    
                    // Reinitialize the chart with the final score
                    const ctx = document.getElementById('accuracyChart').getContext('2d');
                    window.accuracyChart = createAccuracyChart(ctx, averageAccuracy);
                }

                // Send the average accuracy to the server
                fetch('/save_score', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        score: averageAccuracy,
                        video_index: window.location.search.split('=')[1] || '0'
                    })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Score saved:', data);
                    console.log('Final Average Score:', averageAccuracy.toFixed(1) + '%');
                    // Update chart with the saved score and show current score in title
                    accuracyChart.options.plugins.title.text = `Your Score: ${averageAccuracy.toFixed(1)}%`;
                    updateAccuracyChart(averageAccuracy);
                    this.finishSound.play();
                })
                .catch(error => {
                    console.error('Error saving score:', error);
                    // Still update chart even if save fails
                    accuracyChart.options.plugins.title.text = `Your Score: ${averageAccuracy.toFixed(1)}%`;
                    updateAccuracyChart(averageAccuracy);
                    this.finishSound.play();
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
        // Add fade out animation to elements before removing them
        const svgElement = document.querySelector('.floating-svg');
        const legendElement = document.querySelector('.clip-legend');
        const chartContainer = document.querySelector('.chart-container');
        
        const elementsToFade = [svgElement, legendElement, chartContainer].filter(el => el);
        
        elementsToFade.forEach(element => {
            element.style.transition = 'opacity 0.1s';
            element.style.opacity = '0';
        });

        // Remove elements after fade out animation
        setTimeout(() => {
            elementsToFade.forEach(element => {
                if (element === svgElement) {
                    element.parentElement.remove(); // Remove the entire SVG container
                } else {
                    element.remove();
                }
            });
        }, 100);
    }

    updateNavigationVisibility() {
        const navButtons = document.querySelectorAll('.video-nav');
        navButtons.forEach(btn => {
            btn.style.display = (!this.hasStarted || this.video.ended) ? 'block' : 'none';
        });
    }

    async initializeRecording() {
        // Don't request microphone access immediately
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.mobileRecordBtn.addEventListener('click', () => this.toggleRecording());
    }

    async startRecording() {
        try {
            // First check if we have microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Clean up the test stream
            
            this.isRecording = true;
            this.recordBtn.textContent = 'Stop Recording';
            this.mobileRecordBtn.textContent = 'Stop Recording';
            this.recordBtn.classList.add('recording');
            this.mobileRecordBtn.classList.add('recording');

            try {
                const results = await this.asrProcessor.processAudio(
                    null,
                    subtitlesData[this.currentSubtitleIndex].text
                );
                
                if (results.success) {
                    console.log('Final ASR Results:', results);
                    this.showResults(results.results, false); // false indicates this is the final result
                } else {
                    console.error('Error in results:', results.error);
                    this.showRecordButton(); // Allow retry
                }
            } catch (error) {
                console.error('Speech recognition error:', error);
                this.showRecordButton(); // Allow retry
                this.recordBtn.textContent = 'Try Again';
                this.mobileRecordBtn.textContent = 'Try Again';
            }
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.isRecording = false;
            this.showRecordButton();
            this.recordBtn.textContent = 'Allow Microphone Permission';
            this.mobileRecordBtn.textContent = 'Allow Microphone Permission';
            this.recordBtn.classList.remove('recording');
            this.mobileRecordBtn.classList.remove('recording');
        }
    }

    stopRecording() {
        if (this.isRecording) {
            this.isRecording = false;
            this.asrProcessor.stopListening();
            this.showLoadingSpinner();
        }
    }

    toggleRecording() {
        if (!this.isRecording) {
            this.startRecording();
        } else {
            this.stopRecording();
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
        this.recordBtn.disabled = false;
        this.mobileRecordBtn.disabled = false;
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

    showResults(results, isProgress = false) {
        // Skip showing results if this is a progress update
        if (isProgress) return;

        // Only play sounds and store accuracy for final results
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
        
        // Calculate and log the current average
        const currentAverage = this.accuracies.reduce((a, b) => a + b, 0) / this.accuracies.length;
        console.log('Current Average Score:', currentAverage.toFixed(1) + '%');

        // Create or update results section
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
        resultsSection.innerHTML = content;
        this.showPlayButton();
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
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoController();
}); 

function createAccuracyChart(ctx, finalScore) {
    // Create gradient for bars
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(74, 158, 255, 0.9)');    // Brighter at top
    gradient.addColorStop(0.5, 'rgba(74, 158, 255, 0.7)');  // Medium in middle
    gradient.addColorStop(1, 'rgba(74, 158, 255, 0.5)');    // Darker at bottom

    // Initialize with empty data
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['0-15%', '16-30%', '31-45%', '46-60%', '61-75%', '76-90%', '91-100%'],
            datasets: [{
                label: 'Global Scores',
                data: Array(7).fill(0),
                backgroundColor: Array(7).fill(gradient),
                borderColor: Array(7).fill('rgba(74, 158, 255, 0.9)'),
                borderWidth: 2,
                borderRadius: 5,
                barPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: finalScore ? `Your Score: ${Math.round(finalScore)}%` : 'Your Score',
                    color: '#fff',
                    font: {
                        family: 'Inter',
                        size: 16,
                        weight: 'bold'
                    }
                },
                subtitle: {
                    display: true,
                    text: 'Global Average: Loading...',
                    color: '#fff',
                    font: {
                        family: 'Inter',
                        size: 14
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#fff',
                        font: {
                            family: 'Inter'
                        },
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                        tickLength: 5,
                        drawTicks: true,
                        drawOnChartArea: true,
                        count: 5
                    }
                },
                x: {
                    ticks: {
                        color: '#fff',
                        font: {
                            family: 'Inter'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Fetch and update global scores
    const videoIndex = window.location.search.split('=')[1] || '0';
    fetch(`/get_global_scores/${videoIndex}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const scoreDistribution = Array(7).fill(0);
                let totalScore = 0;
                
                if (data.scores.length > 0) {
                    data.scores.forEach(score => {
                        const binIndex = Math.min(Math.floor(score / 15), 6);
                        scoreDistribution[binIndex]++;
                        totalScore += score;
                    });
                    
                    const averageScore = totalScore / data.scores.length;
                    chart.options.plugins.subtitle.text = `Global Score: ${Math.round(averageScore)}% -- ${data.scores.length} attempts`;
                } else {
                    chart.options.plugins.subtitle.text = 'No scores yet';
                }
                
                chart.data.datasets[0].data = scoreDistribution;
                chart.update();
            }
        })
        .catch(error => {
            console.error('Error fetching global scores:', error);
            chart.options.plugins.subtitle.text = 'Error loading scores';
            chart.update();
        });

    return chart;
} 