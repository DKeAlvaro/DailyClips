from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import re
from datetime import datetime
from my_test import get_audio_results
import base64
import tempfile
import wave
import numpy as np
import json

app = Flask(__name__)

# Custom JSON encoder to handle int64 and other numpy types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

# Global trainer instance
trainer = None

def init_trainer():
    global trainer
    from my_test import initialize_trainer  # Import here to avoid circular imports
    trainer = initialize_trainer(model_size="tiny")

# Initialize trainer when app starts
init_trainer()

def parse_srt(srt_path):
    """Parse SRT file and return a list of subtitle dictionaries."""
    if not os.path.exists(srt_path):
        print(f"Warning: No subtitle file found at {srt_path}")
        return []
    
    with open(srt_path, 'r', encoding='utf-8') as file:
        content = file.read()

    # Split the content into subtitle blocks
    subtitle_blocks = content.strip().split('\n\n')
    subtitles = []

    for block in subtitle_blocks:
        lines = block.strip().split('\n')
        if len(lines) >= 3:  # Valid subtitle block should have at least 3 lines
            # Parse timecode
            time_line = lines[1]
            times = re.findall(r'(\d{2}:\d{2}:\d{2},\d{3})', time_line)
            if len(times) == 2:
                # Set start time to 0 for the first subtitle
                if not subtitles:
                    start_ms = 0
                else:
                    start_time = datetime.strptime(times[0], '%H:%M:%S,%f')
                    start_ms = (start_time.hour * 3600 + start_time.minute * 60 + 
                                 start_time.second) * 1000 + start_time.microsecond // 1000
                
                end_time = datetime.strptime(times[1], '%H:%M:%S,%f')
                end_ms = (end_time.hour * 3600 + end_time.minute * 60 + 
                           end_time.second) * 1000 + end_time.microsecond // 1000
                
                # Join all remaining lines as text (in case subtitle has multiple lines)
                text = ' '.join(lines[2:])
                
                subtitles.append({
                    'start': start_ms,
                    'end': end_ms,
                    'text': text
                })
    return subtitles

@app.route('/')
def video_player():
    # Get all videos from the static/videos directory
    video_dir = os.path.join('static', 'videos')
    videos = [f for f in os.listdir(video_dir) if f.endswith(('.mp4', '.webm'))]
    
    if not videos:
        return render_template('index.html', video_path=None)
    
    # Get current video index from query parameter, default to 0
    current_index = request.args.get('video', type=int, default=0)
    current_index = max(0, min(current_index, len(videos) - 1))  # Ensure index is valid

    video_filename = videos[current_index]
    video_path = f'videos/{video_filename}'
    
    # Get corresponding SRT file (assuming same name, different extension)
    srt_filename = os.path.splitext(video_filename)[0] + '.srt'
    srt_path = os.path.join('static', 'subtitles', srt_filename)
    
    # Parse subtitles
    subtitles = parse_srt(srt_path)
    
    return render_template('index.html', 
                         video_path=video_path,
                         subtitles=subtitles,
                         current_index=current_index,
                         total_videos=len(videos))

@app.route('/process-audio', methods=['POST'])
def process_audio():
    try:
        # Get the audio data and subtitle text from the request
        data = request.get_json()
        if not data or 'audio' not in data or 'subtitle' not in data:
            print("Error: Missing audio data or subtitle text")
            return jsonify({'success': False, 'error': 'Missing required data'})
            
        audio_data = data['audio']
        subtitle_text = data['subtitle']
        
        print(f"Processing audio for subtitle: '{subtitle_text}'")
        
        # Convert base64 audio to WAV file
        try:
            audio_bytes = base64.b64decode(audio_data.split(',')[1])
        except Exception as e:
            print(f"Error decoding base64 audio: {str(e)}")
            return jsonify({'success': False, 'error': 'Invalid audio data'})
        
        # Create a temporary WAV file with proper WAV headers
        try:
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                with wave.open(temp_file.name, 'wb') as wav_file:
                    wav_file.setnchannels(1)  # Mono
                    wav_file.setsampwidth(2)  # 2 bytes per sample (16-bit)
                    wav_file.setframerate(16000)  # 16kHz sample rate
                    wav_file.writeframes(audio_bytes)
                temp_file_path = temp_file.name
            
            print(f"Created temporary WAV file: {temp_file_path}")
            
            # Process the audio using the trainer
            if trainer is None:
                print("Error: ASR trainer not initialized")
                return jsonify({'success': False, 'error': 'ASR system not ready'})
                
            results = get_audio_results(temp_file_path, trainer, subtitle_text)
            print(f"ASR Results: {results}")
            
            # Clean up the temporary file
            os.unlink(temp_file_path)
            
            # Use the custom encoder to handle numpy types
            return json.dumps({'success': True, 'results': results}, cls=NumpyEncoder)
            
        except Exception as e:
            print(f"Error processing audio file: {str(e)}")
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
            return jsonify({'success': False, 'error': f'Error processing audio: {str(e)}'})
        
    except Exception as e:
        print(f"General error in process_audio: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False) 