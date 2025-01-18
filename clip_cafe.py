import json
import os
import requests
from dotenv import load_dotenv
import random

load_dotenv()
TMDB_KEY = os.getenv('TMDB')
CLIP_CAFE_KEY = os.getenv('CLIP_CAFE')

CLIP_CAFE_URL = "https://api.clip.cafe/"

def get_clip():
    base_url = "https://api.themoviedb.org/3"
    content_params = {
        "type": random.choice(["movie", "tv"]),
        "category": random.choice(["popular", "top_rated"])
    }
    url = f"{base_url}/{content_params['type']}/{content_params['category']}"

    # get random page in order to get random movies
    page = random.randint(1, 15)
    headers = {
        "accept": "application/json",
        "Authorization": TMDB_KEY,
    }
    params = {
        "page": str(page)
    }
    response = requests.get(url, headers=headers, params=params).json()

    valid_results = []
    # 20 results per page
    for movie in response['results']:
        name = movie.get('title') or movie.get('name')  # Handle both movies and TV shows
        if movie["adult"] == False:
            release_date = movie.get("release_date") or movie.get("first_air_date")
            if release_date and release_date[:4] > "2000":
                print("Valid movie:", name, release_date)
                valid_results.append(name)
            else:
                print("Old movie:", name, release_date)
        else:
            print("Adult movie:", name, movie["adult"])


    print("Valid movies:", valid_results)
    
    return random.choice(valid_results) if valid_results else None
    
def get_movie_clip(movie_name):
    params = {
        'api_key': CLIP_CAFE_KEY,
        "duration": "7-15",
        "size": 100,
        "movie_title": movie_name,
    }
    response = requests.get(CLIP_CAFE_URL, params=params).json()
    n_clips = len(response['hits']["hits"])
    # print(json.dumps(response, indent=2))
    print("Number of clips:", n_clips)

    for clip in response['hits']["hits"]:
        movie_year = clip['_source']['movie_year']
        clip_name = clip['_source']['title']
        download_url = clip['_source']['download']
        subtitles = clip['_source']['subtitles']
        movie_name = clip['_source']['movie_title']
        subtitles = json.loads(subtitles)
        n_subtitles = len(subtitles)

        if n_subtitles > 1:
            return clip_name, download_url, subtitles, movie_name, movie_year
        else:
            print("Less than 2 subtitles", clip_name)
    
    return None, None, None, None, None
    
def update_videos(n=1):
    """Download n new video clips and save them to static/videos directory."""
    videos_dir = os.path.join('static', 'videos')
    subtitles_dir = os.path.join('static', 'subtitles')
    
    # Create directories if they don't exist
    os.makedirs(videos_dir, exist_ok=True)
    os.makedirs(subtitles_dir, exist_ok=True)
    
    # Clear existing files
    for file in os.listdir(videos_dir):
        os.remove(os.path.join(videos_dir, file))
    for file in os.listdir(subtitles_dir):
        os.remove(os.path.join(subtitles_dir, file))
    
    successful_downloads = 0
    
    while successful_downloads < n:
        movie_name = get_clip()
        if not movie_name:
            print(f"Failed to get valid movie")
            continue
            
        movie_clip, download_url, subtitles, movie_name, movie_year = get_movie_clip(movie_name)
        if not download_url or not subtitles:
            print(f"Failed to get valid clip for {movie_name}")
            continue
            
        # Create safe filename from movie name and year
        safe_name = f"{movie_year}_{movie_name.replace(' ', '_')}"
        video_path = os.path.join(videos_dir, f"{safe_name}.mp4")
        srt_path = os.path.join(subtitles_dir, f"{safe_name}.srt")
        
        try:
            # Download video
            response = requests.get(download_url)
            response.raise_for_status()  # Raise exception for bad status codes
            
            with open(video_path, 'wb') as f:
                f.write(response.content)
            
            # Create SRT file
            with open(srt_path, 'w', encoding='utf-8') as f:
                for idx, (_, sub) in enumerate(subtitles.items(), 1):
                    start_time = f"{int(sub['TimeStart'] // 3600):02d}:{int((sub['TimeStart'] % 3600) // 60):02d}:{int(sub['TimeStart'] % 60):02d},{int((sub['TimeStart'] % 1) * 1000):03d}"
                    end_time = f"{int(sub['TimeEnd'] // 3600):02d}:{int((sub['TimeEnd'] % 3600) // 60):02d}:{int(sub['TimeEnd'] % 60):02d},{int((sub['TimeEnd'] % 1) * 1000):03d}"
                    
                    f.write(f"{idx}\n")
                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{sub['Text']}\n\n")
            
            successful_downloads += 1
            print(f"Successfully downloaded {safe_name} ({successful_downloads}/{n})")
            
        except Exception as e:
            print(f"Error downloading {safe_name}: {str(e)}")
            # Clean up any partially downloaded files
            if os.path.exists(video_path):
                os.remove(video_path)
            if os.path.exists(srt_path):
                os.remove(srt_path)
    
    return successful_downloads


if __name__ == "__main__":
    update_videos(n=3)