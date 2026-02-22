import subprocess
import re
import imageio_ffmpeg

FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()

def get_duration(path):
    print(f"Testing with: {path}")
    cmd = [FFMPEG_BIN, "-i", path]
    # ffmpeg -i file returns 1 because no output, but prints info to stderr
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    print(res.stderr)
    
    # Duration: 00:00:41.00, start: 0.000000, bitrate: 1234 kb/s
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", res.stderr)
    if match:
        h, m, s = match.groups()
        seconds = int(h) * 3600 + int(m) * 60 + float(s)
        return seconds
    return 0.0

# Create a dummy file or use an existing one?
# I don't have a guaranteed video file. 
# But I can just check if the logic parses a string.
output = """
ffmpeg version ...
...
Duration: 00:00:41.00, start: 0.000000, bitrate: 200 kb/s
...
"""
match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", output)
if match:
    h, m, s = match.groups()
    seconds = int(h) * 3600 + int(m) * 60 + float(s)
    print(f"Parsed seconds: {seconds}")
else:
    print("Parse failed")
