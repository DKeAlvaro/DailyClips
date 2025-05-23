document.addEventListener('DOMContentLoaded', () => {
    const audioPlayer = document.getElementById('introAudio');
    const transcriptContainer = document.getElementById('transcriptContainer');
    const skipButton = document.getElementById('skipIntroButton');
    const continueButton = document.getElementById('continueToAppButton');
    const progressBar = document.getElementById('progressBar');
    
    let transcriptData = null;
    let currentHighlightIndex = -1; // Renamed from currentChunkIndex for clarity
    let lastMadeVisibleIndex = -1; 
    let animationFrameId = null;

    // --- 1. Fetch Transcript Data ---
    fetch('static/transcript.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            transcriptData = data;
            renderFullTranscriptInitially(); // Create all word spans upfront
            playAudio();
        })
        .catch(error => {
            console.error('Error loading transcript:', error);
            transcriptContainer.textContent = 'Could not load introduction. Skipping to app...';
            navigateToApp(3000);
        });

    // --- 2. Render Full Transcript Initially (Hidden) ---
    function renderFullTranscriptInitially() {
        if (!transcriptData || !transcriptData.chunks) return;
        transcriptContainer.innerHTML = ''; // Clear previous
        transcriptData.chunks.forEach((chunk, index) => {
            const span = document.createElement('span');
            span.textContent = chunk.text + ' ';
            span.id = `chunk-${index}`;
            span.classList.add('transcript-chunk'); // Will be opacity 0, visibility hidden by CSS
            transcriptContainer.appendChild(span);
        });
    }

    // --- 3. Audio Playback and Synchronization ---
    function playAudio() {
        if (audioPlayer) {
            audioPlayer.play().catch(error => {
                console.warn('Audio autoplay was prevented:', error);
                const playPrompt = document.createElement('button');
                playPrompt.textContent = 'Click to Start Introduction';
                playPrompt.classList.add('play-prompt-button'); 
                playPrompt.onclick = () => {
                    audioPlayer.play();
                    playPrompt.remove();
                };
                // Ensure transcript container is clear before adding prompt
                if (transcriptContainer.firstChild && transcriptContainer.firstChild.nodeType !== Node.ELEMENT_NODE) {
                    transcriptContainer.innerHTML = ''; 
                }
                transcriptContainer.appendChild(playPrompt);
            });
        }
    }

    function handleTimeUpdate() {
        if (!transcriptData || !transcriptData.chunks || !audioPlayer) return;

        const currentTime = audioPlayer.currentTime;
        const duration = audioPlayer.duration;

        if (progressBar && duration) {
            const progressPercent = (currentTime / duration) * 100;
            progressBar.style.width = `${progressPercent}%`;
        }

        // Make words visible up to the current time + a small buffer
        const revealLookahead = 0.1; 
        for (let i = lastMadeVisibleIndex + 1; i < transcriptData.chunks.length; i++) {
            if (transcriptData.chunks[i].timestamp[0] <= currentTime + revealLookahead) {
                const chunkEl = document.getElementById(`chunk-${i}`);
                if (chunkEl) {
                    chunkEl.classList.add('visible');
                }
                lastMadeVisibleIndex = i;
            } else {
                break; 
            }
        }
        
        // Determine current spoken chunk for highlighting
        let newHighlightIndex = -1;
        // Check all chunks up to the ones that could be visible now
        for (let i = 0; i <= lastMadeVisibleIndex; i++) { 
            const chunk = transcriptData.chunks[i];
            // Check if chunk exists and has timestamp property to prevent errors
            if (chunk && chunk.timestamp && currentTime >= chunk.timestamp[0] && currentTime < chunk.timestamp[1]) {
                newHighlightIndex = i;
                break;
            }
        }

        if (newHighlightIndex !== currentHighlightIndex) {
            if (currentHighlightIndex !== -1) {
                const prevChunkEl = document.getElementById(`chunk-${currentHighlightIndex}`);
                if (prevChunkEl) prevChunkEl.classList.remove('highlight');
            }
            if (newHighlightIndex !== -1) {
                const currentChunkEl = document.getElementById(`chunk-${newHighlightIndex}`);
                if (currentChunkEl) {
                    currentChunkEl.classList.add('highlight');
                    smoothScrollToChunk(currentChunkEl);
                }
            }
            currentHighlightIndex = newHighlightIndex;
        }
        
        animationFrameId = requestAnimationFrame(handleTimeUpdate);
    }

    if (audioPlayer) {
        audioPlayer.addEventListener('play', () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(handleTimeUpdate);
             // Clear play prompt if it exists
            const playPrompt = transcriptContainer.querySelector('.play-prompt-button');
            if (playPrompt) playPrompt.remove();
        });
        audioPlayer.addEventListener('pause', () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        });
        audioPlayer.addEventListener('seeking', () => {
            // Potentially resync lastMadeVisibleIndex and highlights if seeking significantly changes currentTime
            // For now, timeupdate will catch up.
        });

        audioPlayer.addEventListener('ended', () => {
            console.log('Intro audio finished.');
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (progressBar) progressBar.style.width = '100%';
            if(skipButton) skipButton.style.display = 'none';
            if(continueButton) continueButton.style.display = 'inline-block'; 
        });

        audioPlayer.addEventListener('error', (e) => {
            console.error('Error with audio playback:', e);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            transcriptContainer.textContent = 'Error playing introduction. Skipping to app...';
            navigateToApp(3000);
        });
    }

    // --- 4. Button Functionality ---
    function navigateToApp(delay = 0) {
        if (audioPlayer && !audioPlayer.paused) {
            audioPlayer.pause();
        }
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        setTimeout(() => {
             window.location.href = skipButton.getAttribute('href'); 
        }, delay);
    }

    if (skipButton) {
        skipButton.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToApp();
        });
    }
    if (continueButton) {
        continueButton.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToApp();
        });
    }
    
    // --- 5. Smooth Scroll to keep highlighted chunk somewhat centered ---
    function smoothScrollToChunk(element) {
        if (!element || !transcriptContainer) return;

        const containerHeight = transcriptContainer.clientHeight;
        const elementTopInContainer = element.offsetTop - transcriptContainer.offsetTop;
        const elementHeight = element.clientHeight;

        let targetScrollTop = elementTopInContainer - (containerHeight / 2) + (elementHeight / 2);
        targetScrollTop = Math.max(0, targetScrollTop);
        const maxScrollTop = transcriptContainer.scrollHeight - containerHeight;
        targetScrollTop = Math.min(targetScrollTop, maxScrollTop);
        
        transcriptContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }
}); 