import whisper
from moviepy.editor import VideoFileClip
import os

# Step 1: Extract audio from MP4
def generate_subtitles(video_path, audio_path="audio.wav", model_size="tiny"):
    print(f"Generating subtitles for {video_path}")
    # Step 1: Extract audio from MP4
    video = VideoFileClip(video_path)
    video.audio.write_audiofile(audio_path)
    video.close()
    srt_path = video_path.replace(".mp4", ".srt")
    
    print(f"Transcribing audio with Whisper")
    # Step 2: Transcribe audio with Whisper
    model = whisper.load_model(model_size)  # Choose model size (tiny, base, small, medium, large)
    result = model.transcribe(audio_path, word_timestamps=True, max_initial_timestamp=1.0, condition_on_previous_text=False)
    # Delete the temporary audio file
    if os.path.exists(audio_path):
        os.remove(audio_path)
    
    print(f"Transcription completed")    

    # Step 3: Generate SRT file and calculate average log probability
    num_segments = len(result["segments"])
    total_log_prob = 0.0
    with open(srt_path, "w", encoding="utf-8") as srt_file:
        for i, segment in enumerate(result["segments"]):
            start = segment["start"]
            end = segment["end"]
            text = segment["text"].strip()
            total_log_prob += segment.get("avg_logprob", 0.0)
            
            # Format timestamps (HH:MM:SS,mmm)
            start_time = f"{int(start//3600):02}:{int(start%3600//60):02}:{int(start%60):02},{int(start%1*1000):03}"
            end_time = f"{int(end//3600):02}:{int(end%3600//60):02}:{int(end%60):02},{int(end%1*1000):03}"
            
            # Write SRT entry
            srt_file.write(f"{i+1}\n{start_time} --> {end_time}\n{text}\n\n")

    avg_log_prob = total_log_prob / num_segments if num_segments > 0 else 0.0
    detected_language = result.get("language", "unknown")
    print(f"Subtitles saved to {srt_path}")
    print(f"Language: {detected_language}, Average log probability: {avg_log_prob}")
    
    return srt_path, num_segments, avg_log_prob, detected_language
