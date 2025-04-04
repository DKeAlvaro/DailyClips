import os
import yt_dlp
import random
from update_videos.get_random_queries import generate_random_query

def download_youtube_video():
    search_query = generate_random_query()
    print(f"Searching for: {search_query}")

    downloads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Downloads")
    os.makedirs(downloads_dir, exist_ok=True)

    # Configure yt-dlp for searching
    search_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": "ytsearch30",  # Search for 10 videos
        "match_filter": "duration < 60",  # Only match videos under 60 seconds
        "playlistrandom": True,  # Randomize results to get different shorts
    }

    # Search for videos
    with yt_dlp.YoutubeDL(search_opts) as ydl:
        try:
            result = ydl.extract_info(f"ytsearch30:{search_query}", download=False)
            if not result or "entries" not in result or not result["entries"]:
                print("No videos found")
                return None
            
            # Filter videos under 20 seconds
            valid_videos = [video for video in result["entries"] 
                          if video.get("duration", 0) <= 20]
            print(f"Number of videos found under 20 seconds: {len(valid_videos)}")
            for i, video in enumerate(valid_videos):
                print(f"{i}. {video['title'][:50]}")
            
            if not valid_videos:
                print("No videos found under 20 seconds")
                return None

            # Randomly select one video
            video_info = random.choice(valid_videos)
            video_url = video_info["url"]
            video_name = video_info["title"]
            print(f"Selected video: {video_name} ({video_info.get('duration', 0)} seconds)")

        except Exception as e:
            print(f"Error during video search: {e}")
            return None
    
    # Clean the filename to avoid invalid characters and capitalize words
    import re
    video_name = ' '.join(word.capitalize() for word in re.sub(r'[^a-zA-Z\s]', '', video_name.lower()).split())
    video_name = ''.join(video_name.split())  # Remove any remaining spaces
    output_filename = os.path.join(downloads_dir, f"{video_name}.mp4")

    ydl_opts = {
        "cookies": "cookies.txt",
        "format": "bv*+ba/best",
        "outtmpl": output_filename,
        "merge_output_format": "mp4",
        "clean_infojson": True,
        "quiet": True,
        "no_warnings": True,
        "paths": {
            "home": downloads_dir
        }
    }

    # Download the video
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        print("Video downloaded successfully!")
        return output_filename
    except Exception as e:
        print(f"Error downloading video: {str(e)}")
        return None

