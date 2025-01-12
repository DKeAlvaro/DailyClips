from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import re
from datetime import datetime
import csv

app = Flask(__name__)

# Store scores in memory (you might want to use a database in production)
scores = {}

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
    
    # Load video titles from videos_data.csv
    csv_path = os.path.join('static', 'videos', 'video_titles.csv')
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            video_data = list(reader)  # Convert to list of dictionaries
            print(f"Loaded video data: {video_data}")  # Better debug message
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        video_data = []
    
    # Find the video title for the current video filename
    video_title = None
    for entry in video_data:
        if entry['video_filename'] == video_filename:
            video_title = entry['video_title']
            break
    
    # Get corresponding SRT file (assuming same name, different extension)
    srt_filename = os.path.splitext(video_filename)[0] + '.srt'
    srt_path = os.path.join('static', 'subtitles', srt_filename)
    
    # Parse subtitles
    subtitles = parse_srt(srt_path)
    
    # Get saved scores for current video
    video_scores = scores.get(str(current_index), [])
    
    return render_template('index.html', 
                         video_path=video_path,
                         subtitles=subtitles,
                         current_index=current_index,
                         total_videos=len(videos),
                         saved_scores=video_scores,
                         video_title=video_title)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                             'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/save_score', methods=['POST'])
def save_score():
    data = request.json
    video_index = data.get('video_index', '0')
    score = data.get('score')
    
    if video_index not in scores:
        scores[video_index] = []
    
    scores[video_index].append(score)
    
    return jsonify({
        'success': True,
        'message': 'Score saved successfully',
        'scores': scores[video_index]
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False) 