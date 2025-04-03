import os
import json
import re
import shutil
from update_videos.main import update_videos_folder

def empty_path(folder_path):
    """Empty all contents of the specified folder without deleting the folder itself."""
    if not os.path.exists(folder_path):
        return
    
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        if os.path.isfile(item_path):
            os.remove(item_path)
        elif os.path.isdir(item_path):
            shutil.rmtree(item_path)


def save_video_filenames_to_json():
    # Define paths
    videos_dir = os.path.join('static', 'videos')
    output_file = 'filenames.json'
    
    # Get all mp4 files in the directory
    video_files = [f for f in os.listdir(videos_dir) if f.endswith('.mp4')]
    
    # Write to JSON file
    with open(output_file, 'w') as f:
        json.dump(video_files, f, indent=4)
    
    print(f"Saved {len(video_files)} video filenames to {output_file}")

def update_video_names_in_html():
    # Read the video filenames from JSON
    with open('filenames.json', 'r') as f:
        video_filenames = json.load(f)
    
    # Generate the new videoFiles array content
    new_content = "const videoFiles = [\n"
    for filename in video_filenames:
        new_content += f"    'static/videos/{filename}',\n"
    new_content += "];"
    
    # Read the HTML file
    with open('index.html', 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Replace the videoFiles array using regex
    updated_html = re.sub(
        r'const videoFiles = \[.*?\];',
        new_content,
        html_content,
        flags=re.DOTALL
    )
    
    # Write the updated content back to the file
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(updated_html)
    
    print(f"Updated videoFiles array with {len(video_filenames)} videos in index.html")

def update_html():
    save_video_filenames_to_json()
    update_video_names_in_html()

if __name__ == "__main__":
    empty_path('static/videos')
    empty_path('static/subtitles')
    update_videos_folder()
    update_html()