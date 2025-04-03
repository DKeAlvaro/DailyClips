import os
from pathlib import Path
from dotenv import load_dotenv
import dropbox
from dropbox.exceptions import ApiError

# Load environment variables
load_dotenv()

# Get Dropbox access token from environment variables
DROPBOX_ACCESS_TOKEN = os.getenv('DROPBOX_ACCESS_TOKEN')

def upload_files_to_dropbox():
    """Upload all files from Downloads folder to Dropbox."""
    n_errors = 0
    try:
        # Initialize Dropbox client
        dbx = dropbox.Dropbox(DROPBOX_ACCESS_TOKEN)

        # Get the base Downloads directory
        downloads_dir = Path('Downloads')
        subdirs = ['videos', 'subtitles']

        for subdir in subdirs:
            local_dir = downloads_dir / subdir
            if not local_dir.exists():
                print(f"Directory {local_dir} does not exist. Skipping...")
                continue

            # Process all files in the subdirectory
            for file_path in local_dir.glob('*'):
                if not file_path.is_file():
                    continue

                # Create Dropbox path (maintaining folder structure)
                dropbox_path = f'/{file_path.as_posix()}'

                try:
                    # Read file in binary mode
                    with open(file_path, 'rb') as f:
                        # Upload file to Dropbox
                        dbx.files_upload(
                            f.read(),
                            dropbox_path,
                            mode=dropbox.files.WriteMode.overwrite
                        )
                        print(f"Successfully uploaded {file_path}")

                except ApiError as e:
                    n_errors += 1
                    print(f"Failed to upload {file_path}: {str(e)}")
                except Exception as e:
                    n_errors += 1
                    print(f"Error processing {file_path}: {str(e)}")

        print(f"Upload process completed! {n_errors} errors encountered.")

    except Exception as e:
        print(f"Error initializing Dropbox client: {str(e)}")

def download_random_video():
    """Download a random video and its subtitle from Dropbox, then move them to 'Seen' folder."""
    try:
        # Initialize Dropbox client
        dbx = dropbox.Dropbox(DROPBOX_ACCESS_TOKEN)

        # List files in the videos directory
        videos_path = '/Downloads/videos'
        try:
            files = dbx.files_list_folder(videos_path).entries
            if not files:
                print("No videos found in the directory")
                return
        except ApiError as e:
            print(f"Error listing files: {str(e)}")
            return

        # Select a random video
        import random
        video_file = random.choice(files)
        video_name = video_file.name
        subtitle_name = video_name.rsplit('.', 1)[0] + '.srt'

        # Create local Dropbox directories if they don't exist
        local_video_dir = Path('Dropbox/videos')
        local_subtitle_dir = Path('Dropbox/subtitles')
        local_video_dir.mkdir(parents=True, exist_ok=True)
        local_subtitle_dir.mkdir(parents=True, exist_ok=True)

        # Download video
        video_path = f'{videos_path}/{video_name}'
        local_video_path = local_video_dir / video_name
        try:
            dbx.files_download_to_file(str(local_video_path), video_path)
            print(f"Successfully downloaded video: {video_name}")
        except ApiError as e:
            print(f"Error downloading video: {str(e)}")
            return

        # Download subtitle
        subtitle_path = f'/Downloads/subtitles/{subtitle_name}'
        local_subtitle_path = local_subtitle_dir / subtitle_name
        try:
            dbx.files_download_to_file(str(local_subtitle_path), subtitle_path)
            print(f"Successfully downloaded subtitle: {subtitle_name}")
        except ApiError as e:
            print(f"Error downloading subtitle: {str(e)}")
            return

        # Create 'Seen' folder in Dropbox if it doesn't exist
        seen_folder = '/Seen'
        try:
            dbx.files_create_folder_v2(seen_folder)
        except ApiError:
            # Folder might already exist
            pass

        # Move files to 'Seen' folder
        try:
            dbx.files_move_v2(video_path, f'{seen_folder}/{video_name}')
            dbx.files_move_v2(subtitle_path, f'{seen_folder}/{subtitle_name}')
            print(f"Moved files to Seen folder")
        except ApiError as e:
            print(f"Error moving files to Seen folder: {str(e)}")

    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == '__main__':
    # upload_files_to_dropbox()
    download_random_video()