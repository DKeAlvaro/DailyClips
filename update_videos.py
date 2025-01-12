from googleapiclient.discovery import build
import requests 
import os
import csv
import re

def download_file(file_id, file_name, save_path=None):
    # Google Drive direct download link
    url = f"https://drive.google.com/uc?id={file_id}"
    if save_path:
        # Ensure the directory exists
        os.makedirs(save_path, exist_ok=True)
        full_path = os.path.join(save_path, file_name)
    else:
        # Save to the current working directory
        full_path = file_name

    # Send a GET request to the URL
    response = requests.get(url, stream=True)
    
    # Check if the request was successful
    if response.status_code == 200:
        # Save the file locally
        with open(full_path, 'wb') as file:
            for chunk in response.iter_content(chunk_size=1024):
                if chunk:
                    file.write(chunk)
        print(f"File '{file_name}' downloaded successfully.")
    else:
        print(f"Failed to download file. Status code: {response.status_code}")


# Replace with your Google API key
API_KEY = "AIzaSyA_niKASKtsnbcLa1aCuiR2ysWB7Z2MsDc"

# Replace with your folder ID (extracted from the shared link)
VIDEOS_FOLDER_ID = "1Prt4YX1ZjC31I8tK4Go-SQg6YzyVLDSX"
SUBTITLES_FOLDER_ID = "19jWf42dVcGBuIw1vDl08dL-DTiQf27-q"
VIDEO_TITLES_ID = "1S_KHEGvfBfHEdE-Ooad0a1jcOVsF6Quw"

VIDEO_SAVE_PATH = r"static\videos"
SUBTITLE_SAVE_PATH = r"static\subtitles"
VIDEO_TITLES_PATH = r"static\videos\video_titles.csv"


def list_files_in_folder(folder_id, api_key):
    # Build the Google Drive service
    service = build('drive', 'v3', developerKey=api_key)
    
    # Query to list files in the folder
    query = f"'{folder_id}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id, name)").execute()
    
    files = results.get('files', [])
    if not files:
        print("No files found.")
    else:
        print(f"Found {len(files)} files in folder")
    return files
def get_seen_videos():
    seen_videos = set()
    with open("seen_videos.txt", "r") as f:
        for line in f:
            seen_videos.add(line.strip())
    return seen_videos

def get_subtitle_id(name):
    subtitle_files = list_files_in_folder(SUBTITLES_FOLDER_ID, API_KEY)
    for subtitle_file in subtitle_files:
        if subtitle_file['name'] == name:
            return subtitle_file['id']
    return None

def get_video_titles():
    video_titles = {}
    download_file(VIDEO_TITLES_ID, "full_video_titles.csv")
    with open("full_video_titles.csv", "r") as f:
        reader = csv.reader(f)
        for row in reader:
            video_file_name = row[0]
            video_title = row[1]
            video_titles[video_file_name] = video_title
    return video_titles

def download_videos_and_subtitles(n=3):
    video_titles = get_video_titles()
    seen_videos = get_seen_videos()
    added_videos = []
    video_files = list_files_in_folder(VIDEOS_FOLDER_ID, API_KEY)
    for video_file in video_files:
        name = video_file['name']
        if name in seen_videos:
            continue
        id = video_file['id']
        download_file(id, name, VIDEO_SAVE_PATH)
        srt_name = name.replace(".mp4", ".srt")
        subtitle_id = get_subtitle_id(srt_name)
        download_file(subtitle_id, srt_name, SUBTITLE_SAVE_PATH)

        fix_srt(SUBTITLE_SAVE_PATH + "/" + srt_name, SUBTITLE_SAVE_PATH + "/" + srt_name)
        added_videos.append(name)
        with open("seen_videos.txt", "a") as f:
            f.write(f"{name}\n")
        if len(added_videos) >= n:
            break
    
    open(VIDEO_TITLES_PATH, "w").close()  # Ensure the file is empty before writing
    with open(VIDEO_TITLES_PATH, "w", newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['video_filename', 'video_title'])  # Add headers
        for video_file_name in added_videos:
            video_title = video_titles[video_file_name]
            writer.writerow([video_file_name, video_title])

def empty_folder(folder_path):
    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)



def update_videos(n=3):
    empty_folder(VIDEO_SAVE_PATH)
    empty_folder(SUBTITLE_SAVE_PATH)
    download_videos_and_subtitles(n=n)


def fix_srt(input_path, output_path):
    # Compile a regex to match lines with timecodes like "00:00:03.000 --> 00:00:05.071"
    time_pattern = re.compile(
        r"(\d{2}:\d{2}:\d{2})\.(\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2})\.(\d{3})"
    )

    # Read all lines
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Store blocks (each block is a list of lines)
    blocks = []
    current_block = []

    for line in lines:
        # Check if the line is a time range
        if time_pattern.search(line):
            # Whenever a new time range starts, save the previous block if not empty
            if current_block:
                blocks.append(current_block)
                current_block = []

            # Replace '.' with ',' for milliseconds
            new_line = time_pattern.sub(r"\1,\2 --> \3,\4", line)
            current_block.append(new_line.strip('\n'))
        else:
            # Accumulate the subtitle text
            current_block.append(line.strip('\n'))

    # Append the last block if present
    if current_block:
        blocks.append(current_block)

    # Write to output in proper SRT format
    with open(output_path, 'w', encoding='utf-8') as out:
        for i, block in enumerate(blocks, start=1):
            # Write the index
            out.write(str(i) + "\n")
            # Write each line in the block
            for b_line in block:
                out.write(b_line + "\n")
            # Blank line separating blocks
            out.write("\n")


def main():
    # name = "you-have-let-all-go.mp4"
    # srt_name = name.replace(".mp4", ".srt")
    # subtitle_id = get_subtitle_id(srt_name)
    # print(subtitle_id)
    # download_file(subtitle_id, srt_name, SUBTITLE_SAVE_PATH)

    update_videos(n=1)

if __name__ == "__main__":
    main()