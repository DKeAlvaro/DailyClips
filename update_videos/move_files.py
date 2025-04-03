import os
import shutil

def ensure_directories():
    downloads_dir = os.path.join(os.path.dirname(__file__), 'Downloads')
    src_dir = os.path.dirname(os.path.abspath(__file__))

    # Go up one level to reach the root directory
    root_dir = os.path.dirname(src_dir)

    # Build the relative paths to the static folder
    subtitles_dir = os.path.join(root_dir, 'static', 'subtitles')
    videos_dir = os.path.join(root_dir, 'static', 'videos')
    
    # Create directories if they don't exist
    os.makedirs(subtitles_dir, exist_ok=True)
    os.makedirs(videos_dir, exist_ok=True)
    
    return downloads_dir, subtitles_dir, videos_dir

def move_files():
    downloads_dir, subtitles_dir, videos_dir = ensure_directories()
    
    # Get all files in downloads directory
    for filename in os.listdir(downloads_dir):
        file_path = os.path.join(downloads_dir, filename)
        
        # Skip if it's a directory
        if os.path.isdir(file_path):
            continue
        
        # Move SRT files to subtitles directory
        if filename.lower().endswith('.srt'):
            destination = os.path.join(subtitles_dir, filename)
            shutil.move(file_path, destination)
            print(f'Moved {filename} to subtitles directory')
        
        # Move video files to videos directory
        elif filename.lower().endswith(('.mp4', '.avi', '.mkv', '.mov')):
            destination = os.path.join(videos_dir, filename)
            shutil.move(file_path, destination)
            print(f'Moved {filename} to videos directory')

if __name__ == '__main__':
    move_files()