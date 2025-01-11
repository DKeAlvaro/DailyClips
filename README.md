# English Pronunciation Learning App

A web application for practicing English pronunciation using movie clips and ASR technology.

## Features

- Video playback with automatic stops at subtitle changes
- Voice recording for pronunciation practice
- Real-time pronunciation analysis using Whisper ASR
- Mobile-responsive design
- Word-level pronunciation accuracy feedback

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure your video and subtitle files are in the correct directories:
   - Place video files in `videos/`
   - Place corresponding SRT files in `subtitles/`

3. Run the Flask application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:5000`

## Usage

1. The video will automatically play and pause at each subtitle
2. When the video pauses, read the displayed subtitle text
3. Click the "Record" button and speak the text
4. Click "Stop Recording" when finished
5. Wait for the pronunciation analysis results
6. The video will continue to the next subtitle automatically

## Requirements

- Python 3.8+
- Modern web browser with microphone access
- Internet connection (for initial model download)

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Notes

- Allow microphone access when prompted by your browser
- Speak clearly and at a normal pace for best results
- The application works best in a quiet environment 