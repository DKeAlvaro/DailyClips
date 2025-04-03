import os
import shutil
from pathlib import Path
from update_videos.download_shorts import download_youtube_video
from update_videos.video_to_subtitles import generate_subtitles
from update_videos.move_files import move_files

def clean(file_path):
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except PermissionError:
            print(f"Could not remove {file_path}. File may be in use.")

def clean_temp_files(file_name):
    base_name = os.path.splitext(file_name)[0]
    dir_path = os.path.dirname(os.path.abspath(file_name))
    print(base_name, dir_path)
    for file in os.listdir(dir_path):
        if file.startswith(base_name) and file != os.path.basename(file_name):
            file_path = os.path.join(dir_path, file)
            clean(file_path)

def empty_downloads_folder():
    downloads_dir = Path('Downloads')
    if downloads_dir.exists():
        try:
            shutil.rmtree(downloads_dir)
            print(f"Removed {downloads_dir} directory and all its contents")
        except PermissionError:
            print(f"Could not remove {downloads_dir}. Directory or its contents may be in use.")
        except Exception as e:
            print(f"Error removing {downloads_dir}: {str(e)}")


def update_videos_folder(n_to_keep = 5):
    empty_downloads_folder()
    
    videos_kept = []
    subtitles_kept = []

    while len(videos_kept) < n_to_keep:
        print(f"Starting search, already have {len(videos_kept)} videos")
        video_path = download_youtube_video()
        if video_path is None:
            continue
        srt_path, num_segments, avg_log_prob, detected_language = generate_subtitles(video_path)
        print(f"Number of segments: {num_segments}")
        print(f"Language: {detected_language}, Average log probability: {avg_log_prob}")
        clean_temp_files(video_path)
        if num_segments >= 2 and detected_language.lower() == "en" and avg_log_prob > -1.0:
            videos_kept.append(video_path)
            subtitles_kept.append(srt_path)
        else:
            clean(video_path)
            clean(srt_path)
    for file in os.listdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "Downloads")):
        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Downloads", file)
        if file_path not in videos_kept and file_path not in subtitles_kept:
            clean(file_path)
    move_files()
    
if __name__ == "__main__":
    # Empty Downloads folder at start
    update_videos_folder()
