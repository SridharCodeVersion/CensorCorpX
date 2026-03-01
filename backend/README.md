# CensorCorpX – FastAPI Backend

This is the FastAPI backend for **CensorCorpX**, an AI-powered censorship intelligence platform.

## Tech Stack

- FastAPI
- Uvicorn
- Pydantic
- (Pluggable) OpenAI APIs for GPT, Whisper, Vision (not wired in this prototype)
- MoviePy / OpenCV / FFmpeg ready for real media processing

## Endpoints

- `GET /api/health` – health check.
- `POST /api/ott/analyze` – upload a video file, returns:
  - Detected segments for violence, abusive language, etc.
  - Per-segment and overall risk scores.
  - Certification before/after censorship.
  - Heatmap data and AI analysis cards.
- `POST /api/youtube/analyze` – analyze a YouTube URL with YouTube-specific risk flags.
- `POST /api/music/analyze` – analyze uploaded music file or URL for explicit lyrics and sensitive themes.
- `POST /api/social/analyze` – analyze social media text, return segments + risk + heatmap.
- `POST /api/docs/analyze` – analyze documentation text, return segments + risk + heatmap.
- `POST /api/review/submit` – human-in-the-loop review of segments, recomputes effective risk and certification and appends a new version into history.
- `POST /api/history/restore` – undo to previous AI version (per `content_id`), supporting uncensor/rollback.
- `POST /api/chat` – short, strictly on-topic assistant replies for CensorCorpX usage and interpretations.

All analysis endpoints return a common `AnalyzeResponse` structure that the frontend expects.

## Running the backend

```bash
cd backend
python -m venv venv
venv\Scripts\python.exe -m pip install -r requirements.txt  # or equivalent on your OS
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On Replit, set the run command to start Uvicorn and make port `8000` public, then start the Vite frontend separately or serve a production build through a static server.

## AI & Media Processing

This prototype focuses on:

- **Structured risk modeling** (segments, categories, risk scores).
- **Certification mapping** based on aggregate risk (U, U-A, A, S).
- **Heatmap generation** for all content types.
- **Undo/history** with in-memory version stacks per `content_id`.
- **Human review** routes that adjust risk and certification.

You can later swap the simulated detection logic with real OpenAI / Whisper / Vision / MoviePy pipelines while keeping the same response contracts that the frontend already uses.

