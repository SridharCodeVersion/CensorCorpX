# Dhurandhar AI - Censorship Intelligence Platform

An AI-powered platform for analyzing and censoring content across multiple media types (video, music, social media, documents).

## 🚀 Quick Start (After System Restart)

### Option 1: Start Everything (Recommended)
Simply double-click `start-all.bat` in the project root directory. This will:
- Start the backend server on http://localhost:8000
- Start the frontend on http://localhost:5173
- Open both in separate terminal windows

### Option 2: Start Individually
1. **Backend Only**: Double-click `start-backend.bat`
2. **Frontend Only**: Double-click `start-frontend.bat`

## 📋 Prerequisites

### Backend
- Python 3.8+
- Virtual environment with dependencies installed
- FFmpeg (for video processing)

### Frontend
- Node.js 16+
- npm dependencies installed

## 🔧 First-Time Setup

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
```

## ⚠️ Troubleshooting Network Errors

### "Network Error" when uploading videos?
**Cause**: The backend server is not running.

**Solution**:
1. Check if backend is running by visiting http://localhost:8000/docs
2. If not accessible, run `start-backend.bat`
3. Wait for the message: "Uvicorn running on http://0.0.0.0:8000"
4. Then try uploading again

### Backend won't start?
**Check**:
1. Virtual environment exists: `backend\venv` or `backend\venv_new`
2. Dependencies installed: `pip list` should show `fastapi`, `uvicorn`
3. Port 8000 is not in use: `netstat -ano | findstr :8000`

### Frontend won't start?
**Check**:
1. Node modules installed: `frontend\node_modules` exists
2. Run `npm install` in frontend directory if missing
3. Port 5173 is not in use

## 🏗️ Project Structure

```
Dhurandhar_Project/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── main.py      # Main API endpoints
│   │   └── utils.py     # Helper functions
│   ├── requirements.txt
│   └── venv/            # Python virtual environment
├── frontend/            # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── node_modules/
├── uploads/             # Temporary file storage
├── start-all.bat        # Start both servers
├── start-backend.bat    # Start backend only
└── start-frontend.bat   # Start frontend only
```

## 🎯 Features

- **OTT Video Analysis**: Upload videos, detect violence, abusive language, etc.
- **YouTube Analysis**: Analyze YouTube videos by URL
- **Music Analysis**: Detect explicit lyrics and sensitive themes
- **Social Media Analysis**: Analyze social media posts for harmful content
- **Document Analysis**: Detect PII and confidential information in documents

## 🔑 API Endpoints

- `GET /api/health` - Health check
- `POST /api/ott/analyze` - Analyze uploaded video
- `POST /api/youtube/analyze` - Analyze YouTube URL
- `POST /api/music/analyze` - Analyze music file/URL
- `POST /api/social/analyze` - Analyze social media text
- `POST /api/docs/analyze` - Analyze documents

Full API documentation: http://localhost:8000/docs

## 💡 Tips

1. **Always start the backend first** before using the frontend
2. Use `start-all.bat` for convenience after every restart
3. Keep both terminal windows open while using the application
4. Check backend logs if you encounter errors

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Network Error | Start backend server |
| Port already in use | Kill process using the port or restart system |
| Module not found | Reinstall dependencies |
| FFmpeg not found | Install FFmpeg and add to PATH |

## 📞 Support

For issues or questions, check the backend logs in the terminal window.
