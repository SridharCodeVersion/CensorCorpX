import os
import subprocess
import re
import imageio_ffmpeg

def get_ffmpeg_bin() -> str:
    """Get the path to the ffmpeg executable."""
    return imageio_ffmpeg.get_ffmpeg_exe()

def get_video_duration(path: str) -> float:
    """Get video duration in seconds using ffmpeg -i."""
    try:
        ffmpeg_bin = get_ffmpeg_bin()
        # ffmpeg -i file returns 1 because no output specified, but prints info to stderr
        res = subprocess.run(
            [ffmpeg_bin, "-i", path],
            stderr=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True
        )
        # Output example: Duration: 00:00:41.00, start: 0.000000, bitrate: 1234 kb/s
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", res.stderr)
        if match:
            h, m, s = match.groups()
            return int(h) * 3600 + int(m) * 60 + float(s)

    except Exception:
        pass
    return 0.0


def parse_webvtt(file_path: str) -> list:
    """
    Parse a dense WebVTT/SRT file to extract words with estimated timestamps.
    Returns a list of dicts: {'word': str, 'original': str, 'start': float, 'end': float}
    """
    results = []
    if not os.path.exists(file_path):
        return []
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        def parse_ts(ts_str):
            ts_str = ts_str.replace(',', '.')
            parts = ts_str.split(':')
            if len(parts) == 3:
                h, m, s = parts
                return int(h) * 3600 + int(m) * 60 + float(s)
            elif len(parts) == 2:
                m, s = parts
                return int(m) * 60 + float(s)
            return 0.0

        current_start = 0.0
        current_end = 0.0
        
        # Regex for timestamp line: 00:00:00.000 --> 00:00:05.123
        time_pattern = re.compile(r"((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s-->\s((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})")

        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line == "WEBVTT" or line.isdigit():
                continue
            
            # Check for timestamp
            match = time_pattern.search(line)
            if match:
                current_start = parse_ts(match.group(1))
                current_end = parse_ts(match.group(2))
                continue
            
            # Skip metadata or cues
            if "-->" in line or line.startswith("NOTE"):
                continue

            # Remove tags
            clean_line = re.sub(r"<[^>]+>", "", line)
            words = clean_line.split()
            if not words:
                continue
            
            duration = max(0.1, current_end - current_start)
            word_duration = duration / len(words)
            
            for i, w in enumerate(words):
                # Normalize word for matching (lowercase, check if bad word)
                normalized = re.sub(r"[^\w']", "", w.lower())
                if normalized:
                    results.append({
                        "word": normalized,
                        "original": w,
                        "start": current_start + (i * word_duration),
                        "end": current_start + ((i + 1) * word_duration)
                    })
                    
    except Exception as e:
        print(f"Error parsing VTT: {e}")
        
    return results
