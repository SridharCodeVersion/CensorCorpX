import os
import sys

try:
    import imageio_ffmpeg
    print(f"FFmpeg path: {imageio_ffmpeg.get_ffmpeg_exe()}")
except ImportError:
    print("imageio_ffmpeg not found")

try:
    from moviepy.editor import VideoFileClip
    print("moviepy imported successfully")
except ImportError:
    print("moviepy not found")
