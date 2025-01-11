import os
import re
from datetime import datetime


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


if __name__ == "__main__":
    fight_club_subtitles = "static\subtitles\did-know-you-mix-gasoline-frozen-orange-juice-can-make-napalm-s1.srt"
    other_subtitles = "static\subtitles\dont-want-take-a-leap-of-faith.srt"
    print(parse_srt(fight_club_subtitles))
    print(parse_srt(other_subtitles))
