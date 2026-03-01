# CensorCorpX AI - Content Censorship Intelligence Platform
## System Design Document

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Component-Wise Design](#3-component-wise-design)
4. [Data Flow Description](#4-data-flow-description)
5. [Content Moderation Workflow](#5-content-moderation-workflow)
6. [Technology Stack](#6-technology-stack)
7. [Security and Privacy Considerations](#7-security-and-privacy-considerations)
8. [Scalability Considerations](#8-scalability-considerations)

---

## 1. System Overview

### 1.1 Purpose

CensorCorpX AI is an intelligent content censorship platform designed to automate the detection, analysis, and moderation of multimedia content across various platforms including OTT services, YouTube, music streaming, social media, and documentation repositories. The system leverages AI-powered analysis to identify sensitive content segments and provides flexible censorship options while maintaining human oversight.

### 1.2 Key Capabilities

- **Multi-Modal Content Analysis**: Supports video, audio, text, and URL-based content
- **Granular Segment Detection**: Identifies specific timestamps/positions of sensitive content
- **Risk Scoring & Certification**: Quantifies risk levels and maps to content ratings (U, U-A, A, S)
- **Flexible Censorship Treatments**: Blur, beep, cut, mute, hide captions
- **Human-in-the-Loop Review**: Allows manual approval/rejection of AI decisions
- **Version Control**: Maintains history with undo/restore capabilities
- **Real-Time Processing**: Asynchronous job execution with live progress updates
- **Visual Analytics**: Heatmaps, timelines, and risk breakdowns

### 1.3 Design Principles

1. **Modularity**: Loosely coupled components for easy maintenance and extension
2. **Transparency**: Clear reasoning and explainability for all AI decisions
3. **User Control**: Human oversight at every critical decision point
4. **Performance**: Asynchronous processing to handle resource-intensive operations
5. **Extensibility**: Pluggable AI models and configurable policies
6. **Privacy-First**: Minimal data retention and secure processing

---

## 2. High-Level System Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (Browser)                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    React Frontend (SPA)                                 │ │
│  │  ┌──────────┬──────────┬──────────┬──────────┬──────────┐             │ │
│  │  │   OTT    │ YouTube  │  Music   │  Social  │   Docs   │  Tab Editors│ │
│  │  │  Editor  │  Editor  │  Editor  │  Editor  │  Editor  │             │ │
│  │  └──────────┴──────────┴──────────┴──────────┴──────────┘             │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  State Management (TabContext)                                    │ │ │
│  │  │  - Tab States  - UI State  - Logs  - History                     │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  UI Components                                                    │ │ │
│  │  │  - Activity Bar  - Bottom Panel  - Assistant Panel               │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Services Layer                                                   │ │ │
│  │  │  - censorshipClient.ts  - chatClient.ts                          │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                        HTTP/REST API + Server-Sent Events (SSE)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER (FastAPI)                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         API Endpoints                                   │ │
│  │  ┌──────────────────┬──────────────────┬──────────────────────────┐   │ │
│  │  │  Analysis Routes │  Apply Routes    │  Utility Routes          │   │ │
│  │  │  /ott/analyze    │  /ott/apply      │  /health                 │   │ │
│  │  │  /youtube/analyze│  /youtube/apply  │  /chat                   │   │ │
│  │  │  /music/analyze  │  /music/apply    │  /review/submit          │   │ │
│  │  │  /social/analyze │                  │  /history/restore        │   │ │
│  │  │  /docs/analyze   │                  │  /jobs/{id}/events (SSE) │   │ │
│  │  └──────────────────┴──────────────────┴──────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Business Logic Layer                               │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Job Management                                                   │ │ │
│  │  │  - Async Job Queue  - Progress Tracking  - SSE Streaming        │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Content Processors                                               │ │ │
│  │  │  - Video Analyzer  - Audio Analyzer  - Text Analyzer            │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Censorship Engine                                                │ │ │
│  │  │  - Segment Detector  - Risk Scorer  - Treatment Applicator      │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Version Control                                                  │ │ │
│  │  │  - History Manager  - Undo/Restore Logic                         │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      Data Access Layer                                  │ │
│  │  - In-Memory Storage (Prototype)  - File System (Temp Files)          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES & DEPENDENCIES                          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│  │  FFmpeg  │  MoviePy │  yt-dlp  │  OpenAI  │  OpenCV  │  Whisper API │  │
│  │ (Video)  │ (Audio)  │(YouTube) │   (AI)   │ (Vision) │   (Speech)   │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Architectural Patterns

#### 2.2.1 Client-Server Architecture
- **Frontend**: Single-page application (SPA) built with React
- **Backend**: RESTful API server built with FastAPI
- **Communication**: HTTP/HTTPS with JSON payloads, SSE for real-time updates

#### 2.2.2 Layered Architecture
- **Presentation Layer**: React components and UI logic
- **Application Layer**: API endpoints and request handling
- **Business Logic Layer**: Core processing, analysis, and censorship logic
- **Data Access Layer**: Storage and retrieval operations

#### 2.2.3 Asynchronous Processing
- **Job Queue Pattern**: Long-running tasks executed as background jobs
- **Event Streaming**: Server-Sent Events (SSE) for real-time progress updates
- **Non-Blocking I/O**: FastAPI's async/await for concurrent request handling

#### 2.2.4 State Management
- **Frontend**: React Context API for global state
- **Backend**: In-memory dictionaries for job tracking and version history

---

## 3. Component-Wise Design

### 3.1 Frontend Architecture

#### 3.1.1 Technology Stack
- **Framework**: React 18.3+ with TypeScript
- **Build Tool**: Vite 7.3+
- **Styling**: Tailwind CSS 3.4+ with custom dark theme
- **Animations**: Framer Motion 11.11+
- **Code Editor**: Monaco Editor (VS Code editor component)
- **HTTP Client**: Axios 1.7+
- **Icons**: Lucide React

#### 3.1.2 Component Hierarchy

```
AppShell (Root)
├── TabProvider (State Management)
│   └── AppShellInner
│       ├── TopNav (Tab Navigation)
│       ├── GlobalHeader (Platform Title)
│       ├── SubHeader (Context-Aware Punchlines)
│       └── Main Container
│           ├── ActivityBar (Left Sidebar)
│           │   ├── Run AI
│           │   ├── AI Assistant
│           │   ├── Human Review
│           │   ├── Uncensor
│           │   ├── Show Censored
│           │   ├── Child Protection Lock
│           │   └── Theme Toggle
│           ├── Center Content
│           │   ├── Tab Editors (Main Area)
│           │   │   ├── OttEditor
│           │   │   ├── YoutubeEditor
│           │   │   ├── MusicEditor
│           │   │   ├── SocialEditor
│           │   │   └── DocsEditor
│           │   └── BottomPanel
│           │       ├── Output Tab (Logs)
│           │       └── AI Analysis Tab (Reasoning)
│           └── AssistantPanel (Right Sidebar)
│               ├── Get Started Cards
│               └── Chat Interface
```

#### 3.1.3 State Management (TabContext)


**Global State Structure:**

```typescript
interface TabState {
  contentId?: string              // Unique identifier for content
  locked: boolean                 // Child protection lock status
  segments: Segment[]             // Detected sensitive segments
  certification?: Certification   // Before/after ratings
  overallRisk?: number           // Aggregate risk score (0-1)
  durationSeconds?: number       // Content duration
  certificationLogic?: string    // AI reasoning for rating
  analysisCards: AnalysisCard[]  // AI explanation cards
  historyKeys: string[]          // Version history stack
  file?: File                    // Uploaded file
  url?: string                   // Input URL
  previewUrl?: string            // Local preview URL
  originalUrl?: string           // Server-hosted original
  censoredUrl?: string           // Server-hosted censored version
  jobStatus?: JobStatus          // idle | running | done | error
  progress?: number              // Job progress (0-100)
  heatmap?: HeatmapItem[]        // Risk visualization data
  review?: Record<string, boolean> // Segment approval map
  options?: CensorshipOptions    // Treatment selections
}

interface UiState {
  rightPanelVisible: boolean     // Assistant panel toggle
  bottomPanelHeight: number      // Resizable panel height
  outputLogs: LogEntry[]         // System logs
  restoreOttRequest: number      // Undo trigger timestamp
  theme: 'dark' | 'light'        // UI theme
}
```

**State Operations:**
- `setTabState(type, updater)`: Update specific tab state
- `setUiState(updater)`: Update UI state
- `addLog(message, level)`: Append log entry
- `clearLogs()`: Clear all logs
- `resetTab(type)`: Reset tab to initial state
- `triggerRestoreOtt()`: Trigger undo operation

#### 3.1.4 Tab Editors

**OttEditor:**
- File upload with drag-and-drop
- Side-by-side video comparison (original vs. censored)
- Interactive timeline with heatmap overlay
- Segment review interface with approve/reject toggles
- Censorship options checkboxes
- Real-time progress bar
- Film certification display

**YoutubeEditor:**
- URL input field
- Similar to OttEditor with YouTube-specific risk flags
- Platform-specific warnings (fake news, extremism, etc.)

**MusicEditor:**
- Audio/video file upload or YouTube URL
- Waveform visualization with heatmap
- Explicit lyrics detection
- Segment-based censorship (beep, mute, cut)

**SocialEditor:**
- Dual input mode: text editor (Monaco) or URL paste
- Split view: original text vs. sanitized output
- Censored elements list with severity indicators
- Risk breakdown by category
- Text-based heatmap

**DocsEditor:**
- File upload (.txt, .md, .pdf, .docx)
- Monaco editor for text display
- Sanitized version generation
- PII and sensitive data detection


#### 3.1.5 Services Layer

**censorshipClient.ts:**
- Axios-based HTTP client with `/api` base URL
- Type-safe API methods with TypeScript interfaces
- Error handling and timeout configuration (60s)

**Key Methods:**
```typescript
// Analysis
analyzeOttAsync(file, options): Promise<OttStartResponse>
analyzeYoutubeAsync(url): Promise<YoutubeStartResponse>
analyzeMusicAsync(file?, url?): Promise<MusicStartResponse>
analyzeSocial(text?, url?): Promise<SocialAnalyzeResponse>
analyzeDocs(file): Promise<SocialAnalyzeResponse>

// Censorship Application
applyOttAsync(contentId, options): Promise<OttApplyResponse>
applyYoutubeAsync(contentId, options): Promise<YoutubeApplyResponse>
applyMusicAsync(contentId, options): Promise<MusicApplyResponse>

// History
restoreOttHistory(contentId): Promise<AnalyzeResponse>
```

**chatClient.ts:**
- AI assistant chat interface
- Enforces on-topic responses
- Short answer format

#### 3.1.6 UI/UX Design Patterns

**Visual Design:**
- VS Code-inspired dark theme (primary)
- Zinc color palette for neutrality
- Accent color (#3b82f6 blue) for interactive elements
- Risk color coding: green (low), amber (medium), red (high)

**Interaction Patterns:**
- Tab-based navigation for content types
- Collapsible panels (activity bar, assistant, bottom panel)
- Drag-to-resize bottom panel
- Hover tooltips for timeline segments
- Loading states with progress indicators
- Smooth transitions with Framer Motion

**Accessibility:**
- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- High contrast color ratios
- Focus indicators

---

### 3.2 Backend Architecture

#### 3.2.1 Technology Stack
- **Framework**: FastAPI 0.100+
- **Server**: Uvicorn with standard extras
- **Validation**: Pydantic 2.0+ for request/response models
- **Video Processing**: FFmpeg, MoviePy, OpenCV
- **YouTube Downloads**: yt-dlp
- **AI Integration**: OpenAI API (GPT, Whisper, Vision) - placeholder in prototype
- **Database**: In-memory dictionaries (prototype), PostgreSQL (future)

#### 3.2.2 API Endpoint Design

**RESTful Principles:**
- Resource-based URLs
- HTTP methods: GET (retrieve), POST (create/action)
- JSON request/response format
- Standard HTTP status codes (200, 400, 404, 500)

**Endpoint Categories:**

1. **Health & Monitoring**
   - `GET /api/health` - System health check

2. **Analysis Endpoints (Async)**
   - `POST /api/ott/analyze_async` - Start OTT video analysis job
   - `POST /api/youtube/analyze_async` - Start YouTube analysis job
   - `POST /api/music/analyze_async` - Start music analysis job

3. **Analysis Endpoints (Sync)**
   - `POST /api/social/analyze` - Analyze social media content
   - `POST /api/docs/analyze` - Analyze documentation

4. **Censorship Application (Async)**
   - `POST /api/ott/apply_async` - Apply OTT censorship
   - `POST /api/youtube/apply_async` - Apply YouTube censorship
   - `POST /api/music/apply_async` - Apply music censorship

5. **Job Management**
   - `GET /api/jobs/{job_id}/events` - SSE stream for job progress

6. **Review & History**
   - `POST /api/review/submit` - Submit human review decisions
   - `POST /api/history/restore` - Restore previous version

7. **AI Assistant**
   - `POST /api/chat` - Chat with AI assistant


#### 3.2.3 Data Models (Pydantic)

**Core Models:**

```python
class RiskScore(BaseModel):
    category: str          # e.g., "violence", "profanity"
    score: float          # 0.0 to 1.0

class Segment(BaseModel):
    id: str               # Unique segment identifier
    start: float          # Start position (0-1 normalized or seconds)
    end: float            # End position
    labels: List[str]     # Category labels
    risk_scores: List[RiskScore]
    reason: Optional[str] # AI explanation
    confidence: Optional[str]  # e.g., "High", "Medium"
    peak_risk_str: Optional[str]  # Formatted peak risk
    start_time: Optional[str]     # Human-readable timestamp
    end_time: Optional[str]

class HeatmapItem(BaseModel):
    start: float          # Normalized position (0-1)
    end: float
    intensity: float      # Risk intensity (0-1)
    categories: List[str] # Risk categories in this segment

class AnalysisCard(BaseModel):
    title: str            # Card title
    body: str             # Explanation text

class AnalyzeResponse(BaseModel):
    content_id: str       # Unique content identifier
    duration: float       # Content duration (seconds or normalized)
    segments: List[Segment]
    certification_before: str  # U, U-A, A, S
    certification_after: str
    overall_risk: float   # Aggregate risk (0-1)
    heatmap: List[HeatmapItem]
    analysis_cards: List[AnalysisCard]
    certification_logic: Optional[str]  # AI reasoning

class SocialAnalyzeResponse(AnalyzeResponse):
    sanitized_content: Optional[str]
    censored_elements: Optional[List[CensoredElement]]
    risk_breakdown: Optional[List[RiskBreakdown]]
    ai_analysis_input: Optional[str]
    ai_analysis_risk: Optional[str]
    ai_analysis_cert: Optional[str]

class JobStartResponse(BaseModel):
    job_id: str           # Unique job identifier
    content_id: str       # Content identifier
    original_url: str     # URL to original content
```

#### 3.2.4 Business Logic Components

**Job Management System:**

```python
# In-memory job tracking
_jobs: Dict[str, JobState] = {}

class JobState:
    job_id: str
    status: Literal['queued', 'running', 'done', 'error']
    progress: int  # 0-100
    logs: List[LogEntry]
    result: Optional[Any]
    error: Optional[str]
    created_at: datetime
    updated_at: datetime

# Job lifecycle
def _job_init(job_type: str, content_id: Optional[str]) -> str:
    """Create new job and return job_id"""
    
def _job_log(job_id: str, message: str, progress: Optional[int]):
    """Append log entry and update progress"""
    
def _job_complete(job_id: str, result: Any):
    """Mark job as done with result"""
    
def _job_error(job_id: str, error: str):
    """Mark job as failed with error message"""
```

**Version History Manager:**

```python
# In-memory version storage
_history: Dict[str, List[AnalyzeResponse]] = {}

def _store_version(resp: AnalyzeResponse):
    """Store analysis result in version history"""
    if resp.content_id not in _history:
        _history[resp.content_id] = []
    _history[resp.content_id].append(resp)

def _restore_version(content_id: str) -> Optional[AnalyzeResponse]:
    """Restore previous version (undo)"""
    if content_id in _history and len(_history[content_id]) > 1:
        _history[content_id].pop()  # Remove current
        return _history[content_id][-1]  # Return previous
    return None
```

**Content Processors:**

1. **Video Analyzer** (`_ott_analyze_worker`):
   - Extract video metadata (duration, resolution, fps)
   - Generate frames for visual analysis
   - Extract audio for speech-to-text
   - Detect segments with sensitive content
   - Calculate risk scores per segment
   - Generate heatmap data
   - Map to certification rating

2. **Audio Analyzer** (`_music_analyze_worker`):
   - Extract audio from video or process audio file
   - Transcribe lyrics using Whisper API (future)
   - Detect explicit language and themes
   - Generate audio-based heatmap

3. **Text Analyzer** (`_analyze_social_media_content`, `_analyze_document_content`):
   - Parse text input or extract from URL
   - Tokenize and analyze content
   - Detect policy violations
   - Generate sanitized version
   - Create risk breakdown


**Censorship Engine:**

1. **Segment Detector**:
   - Analyzes content frame-by-frame or word-by-word
   - Identifies start/end positions of sensitive content
   - Classifies segments by category
   - Assigns confidence scores

2. **Risk Scorer**:
   - Calculates per-category risk scores (0-1)
   - Computes peak risk per segment
   - Aggregates overall content risk
   - Applies weighting based on severity

3. **Treatment Applicator** (`_ott_apply_worker`, `_music_apply_worker`):
   - **Blur Video**: Apply Gaussian blur to video frames in flagged segments
   - **Add Beep**: Overlay beep sound on audio track
   - **Mute Audio**: Silence audio in segments
   - **Cut Clip**: Remove segments entirely (FFmpeg concat demuxer)
   - **Cut/Hide Captions**: Modify subtitle files

**FFmpeg Integration:**

```python
def _build_concat_list(path: str, windows: List[Dict], duration: float) -> str:
    """Generate FFmpeg concat file for cutting segments"""
    # Creates list of time ranges to keep
    # Example: file 'input.mp4' inpoint 0.0 outpoint 5.2
    
def apply_blur_and_beep(input_path: str, output_path: str, segments: List):
    """Apply blur and beep using FFmpeg filters"""
    # Complex filter: [0:v]split[v1][v2];[v1]boxblur=10[blurred];...
```

#### 3.2.5 Utility Functions (utils.py)

```python
def get_ffmpeg_bin() -> str:
    """Get FFmpeg executable path from imageio_ffmpeg"""

def get_video_duration(path: str) -> float:
    """Extract video duration using FFmpeg -i"""

def parse_webvtt(file_path: str) -> List[Dict]:
    """Parse WebVTT/SRT subtitle files for word-level timestamps"""
    # Returns: [{'word': str, 'original': str, 'start': float, 'end': float}]
```

#### 3.2.6 Server-Sent Events (SSE)

**Implementation:**

```python
@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str):
    async def event_generator():
        while True:
            job = _jobs.get(job_id)
            if not job:
                yield {"event": "error", "data": json.dumps({"error": "Job not found"})}
                break
            
            # Stream log entries
            for log in job.logs:
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "type": "log",
                        "message": log.message,
                        "progress": job.progress,
                        "status": job.status
                    })
                }
            
            # Send final result
            if job.status in ['done', 'error']:
                yield {
                    "event": "message",
                    "data": json.dumps({
                        "type": "final",
                        "status": job.status,
                        "result": job.result,
                        "error": job.error
                    })
                }
                break
            
            await asyncio.sleep(1)
    
    return EventSourceResponse(event_generator())
```

**Benefits:**
- Real-time progress updates without polling
- Efficient server-to-client push
- Automatic reconnection on connection loss
- Low latency for user feedback

---

### 3.3 AI Model Integration (Future)

#### 3.3.1 OpenAI GPT Integration

**Use Cases:**
- Content classification and categorization
- Risk assessment reasoning
- Certification logic explanation
- Context-aware analysis

**Implementation Pattern:**

```python
async def analyze_with_gpt(content: str, context: str) -> Dict:
    response = await openai.ChatCompletion.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a content moderation expert..."},
            {"role": "user", "content": f"Analyze this content: {content}"}
        ],
        temperature=0.3,
        max_tokens=500
    )
    return parse_gpt_response(response)
```

#### 3.3.2 Whisper API Integration

**Use Cases:**
- Audio transcription for video/music content
- Speech-to-text for profanity detection
- Subtitle generation

**Implementation:**

```python
async def transcribe_audio(audio_path: str) -> str:
    with open(audio_path, "rb") as audio_file:
        transcript = await openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["word"]
        )
    return transcript
```

#### 3.3.3 Vision API Integration

**Use Cases:**
- Frame-by-frame video analysis
- Nudity and violence detection
- Object and scene recognition

**Implementation:**

```python
async def analyze_frame(frame_path: str) -> Dict:
    with open(frame_path, "rb") as image_file:
        response = await openai.Image.create_variation(
            image=image_file,
            model="gpt-4-vision-preview"
        )
    return parse_vision_response(response)
```


### 3.4 Database Design (Future Implementation)

#### 3.4.1 Current State (Prototype)
- **In-Memory Storage**: Python dictionaries for jobs and history
- **File System**: Temporary files for uploaded content
- **Session-Based**: Data cleared on server restart
- **No Persistence**: Suitable for prototype/demo only

#### 3.4.2 Production Database Schema (PostgreSQL)

**Tables:**

```sql
-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,  -- 'moderator', 'admin', 'user'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Content Items
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    content_type VARCHAR(50) NOT NULL,  -- 'ott', 'youtube', 'music', 'social', 'docs'
    original_url TEXT,
    file_path TEXT,
    metadata JSONB,  -- Duration, resolution, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analysis Results
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    overall_risk FLOAT NOT NULL,
    certification_before VARCHAR(10),
    certification_after VARCHAR(10),
    certification_logic TEXT,
    heatmap JSONB,
    analysis_cards JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(content_id, version)
);

-- Detected Segments
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
    start_position FLOAT NOT NULL,
    end_position FLOAT NOT NULL,
    labels TEXT[],
    risk_scores JSONB,
    reason TEXT,
    confidence VARCHAR(50),
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs (Async Processing)
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    content_id UUID REFERENCES content(id),
    status VARCHAR(20) NOT NULL,  -- 'queued', 'running', 'done', 'error'
    progress INT DEFAULT 0,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Job Logs
CREATE TABLE job_logs (
    id SERIAL PRIMARY KEY,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    level VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Review Decisions
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    segment_approvals JSONB,  -- {segment_id: boolean}
    comments TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Censored Outputs
CREATE TABLE censored_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
    censored_url TEXT NOT NULL,
    options JSONB,  -- Censorship options applied
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**

```sql
CREATE INDEX idx_content_user ON content(user_id);
CREATE INDEX idx_content_type ON content(content_type);
CREATE INDEX idx_analyses_content ON analyses(content_id);
CREATE INDEX idx_segments_analysis ON segments(analysis_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_content ON jobs(content_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

#### 3.4.3 Data Access Layer (SQLAlchemy)

**ORM Models:**

```python
from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

class Content(Base):
    __tablename__ = 'content'
    id = Column(UUID, primary_key=True)
    user_id = Column(UUID, ForeignKey('users.id'))
    content_type = Column(String(50))
    original_url = Column(String)
    file_path = Column(String)
    metadata = Column(JSONB)
    
    analyses = relationship("Analysis", back_populates="content")
    user = relationship("User", back_populates="contents")

class Analysis(Base):
    __tablename__ = 'analyses'
    id = Column(UUID, primary_key=True)
    content_id = Column(UUID, ForeignKey('content.id'))
    version = Column(Integer)
    overall_risk = Column(Float)
    certification_before = Column(String(10))
    certification_after = Column(String(10))
    heatmap = Column(JSONB)
    
    content = relationship("Content", back_populates="analyses")
    segments = relationship("Segment", back_populates="analysis")
```

---

## 4. Data Flow Description

### 4.1 Content Analysis Flow

```
┌─────────────┐
│   User      │
│  Uploads    │
│  Content    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend: Tab Editor                                    │
│  1. File/URL input validation                           │
│  2. Create FormData or JSON payload                     │
│  3. Call censorshipClient.analyzeXxxAsync()             │
└──────┬──────────────────────────────────────────────────┘
       │ HTTP POST /api/xxx/analyze_async
       ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: API Endpoint                                   │
│  1. Validate request (Pydantic)                         │
│  2. Save uploaded file to temp directory                │
│  3. Generate unique content_id and job_id               │
│  4. Initialize job state (queued)                       │
│  5. Start background worker (asyncio.create_task)       │
│  6. Return JobStartResponse immediately                 │
└──────┬──────────────────────────────────────────────────┘
       │
       ├─────────────────────────────────────────────────┐
       │                                                  │
       ▼                                                  ▼
┌─────────────────────────┐              ┌──────────────────────────┐
│  Frontend: SSE Client   │              │  Backend: Worker Thread  │
│  1. Open EventSource    │              │  1. Update status=running│
│  2. Listen for events   │              │  2. Extract metadata     │
│  3. Update progress bar │◄─────SSE─────│  3. Process content      │
│  4. Display logs        │              │  4. Detect segments      │
│  5. Receive final result│              │  5. Calculate risks      │
└─────────────────────────┘              │  6. Generate heatmap     │
                                         │  7. Map certification    │
                                         │  8. Store in history     │
                                         │  9. Update status=done   │
                                         │  10. Send final event    │
                                         └──────────────────────────┘
```


### 4.2 Censorship Application Flow

```
┌─────────────┐
│   User      │
│  Selects    │
│  Options    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend: Tab Editor                                    │
│  1. User reviews segments (approve/reject)              │
│  2. User selects censorship options                     │
│     - Cut clip, blur video, add beep, etc.              │
│  3. Click "Apply Censorship" button                     │
│  4. Call censorshipClient.applyXxxAsync()               │
└──────┬──────────────────────────────────────────────────┘
       │ HTTP POST /api/xxx/apply_async
       ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: Apply Endpoint                                 │
│  1. Validate content_id exists                          │
│  2. Retrieve original file and analysis                 │
│  3. Filter segments by approval status                  │
│  4. Generate unique job_id                              │
│  5. Start apply worker (asyncio.create_task)            │
│  6. Return JobStartResponse                             │
└──────┬──────────────────────────────────────────────────┘
       │
       ├─────────────────────────────────────────────────┐
       │                                                  │
       ▼                                                  ▼
┌─────────────────────────┐              ┌──────────────────────────┐
│  Frontend: SSE Client   │              │  Backend: Apply Worker   │
│  1. Open EventSource    │              │  1. Load original file   │
│  2. Monitor progress    │◄─────SSE─────│  2. Build FFmpeg command │
│  3. Display logs        │              │  3. Apply treatments:    │
│  4. Receive censored URL│              │     - Blur segments      │
└─────────────────────────┘              │     - Add beep audio     │
                                         │     - Cut segments       │
                                         │     - Modify captions    │
                                         │  4. Render output file   │
                                         │  5. Save to static dir   │
                                         │  6. Generate public URL  │
                                         │  7. Send final event     │
                                         └──────────────────────────┘
```

### 4.3 Human Review Flow

```
┌─────────────┐
│   User      │
│  Reviews    │
│  Segments   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend: Review Interface                              │
│  1. Display all detected segments                       │
│  2. Show risk scores, labels, timestamps                │
│  3. User toggles approve/reject for each segment        │
│  4. Update local state (review map)                     │
│  5. Optional: Submit review to backend                  │
└──────┬──────────────────────────────────────────────────┘
       │ HTTP POST /api/review/submit (optional)
       ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: Review Endpoint                                │
│  1. Receive review decisions                            │
│  2. Retrieve original analysis                          │
│  3. Recompute effective risk (only approved segments)   │
│  4. Recalculate certification                           │
│  5. Create new version in history                       │
│  6. Return updated AnalyzeResponse                      │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend: Update UI                                     │
│  1. Update tab state with new analysis                  │
│  2. Refresh certification display                       │
│  3. Update heatmap                                      │
│  4. Add to history stack                                │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Version History & Undo Flow

```
┌─────────────┐
│   User      │
│  Clicks     │
│  "Uncensor" │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend: Activity Bar                                  │
│  1. Confirm action with user                            │
│  2. Call resetTab() or restoreHistory()                 │
└──────┬──────────────────────────────────────────────────┘
       │ HTTP POST /api/history/restore
       ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: History Endpoint                               │
│  1. Retrieve version stack for content_id               │
│  2. Pop current version                                 │
│  3. Return previous version                             │
└──────┬──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Frontend: Restore State                                 │
│  1. Update tab state with previous analysis             │
│  2. Clear censored preview                              │
│  3. Reset segment approvals                             │
│  4. Log restoration action                              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Content Moderation Workflow

### 5.1 End-to-End Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1: Content Ingestion                                      │
├─────────────────────────────────────────────────────────────────┤
│  1. User selects content type (OTT, YouTube, Music, etc.)       │
│  2. User uploads file or provides URL                           │
│  3. System validates input (file type, size, URL format)        │
│  4. Content stored temporarily with unique ID                   │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2: AI Analysis                                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Extract metadata (duration, resolution, format)             │
│  2. Process content:                                            │
│     - Video: Extract frames, transcribe audio                   │
│     - Audio: Transcribe lyrics                                  │
│     - Text: Tokenize and parse                                  │
│  3. Detect sensitive segments:                                  │
│     - Violence, profanity, nudity, hate speech, etc.            │
│  4. Calculate risk scores per segment and category              │
│  5. Generate overall risk score                                 │
│  6. Map to content certification (U, U-A, A, S)                 │
│  7. Create heatmap visualization                                │
│  8. Generate AI explanation cards                               │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3: Human Review                                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Display detected segments to moderator                      │
│  2. Show risk scores, labels, timestamps, AI reasoning          │
│  3. Moderator reviews each segment:                             │
│     - Approve: Segment will be censored                         │
│     - Reject: Segment will remain unchanged                     │
│  4. Moderator can adjust risk assessment (future)               │
│  5. System recalculates effective risk and certification        │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4: Censorship Configuration                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Moderator selects censorship treatments:                    │
│     - Blur video (visual obscuration)                           │
│     - Add beep (audio masking)                                  │
│     - Mute audio (silence)                                      │
│     - Cut clip (remove segments)                                │
│     - Cut/hide captions (subtitle modification)                 │
│  2. Multiple treatments can be combined                         │
│  3. Preview timeline shows affected segments                    │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5: Censorship Application                                 │
├─────────────────────────────────────────────────────────────────┤
│  1. System applies selected treatments to approved segments     │
│  2. FFmpeg processes video/audio:                               │
│     - Apply blur filter to video frames                         │
│     - Overlay beep audio on soundtrack                          │
│     - Concatenate non-censored segments (if cutting)            │
│  3. Generate censored output file                               │
│  4. Update duration if segments were cut                        │
│  5. Save censored version to static directory                   │
└─────────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 6: Review & Verification                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Display side-by-side comparison (original vs. censored)     │
│  2. Moderator verifies censorship quality                       │
│  3. Check certification improvement (before → after)            │
│  4. If unsatisfied:                                             │
│     - Adjust options and re-apply                               │
│     - Undo to previous version                                  │
│  5. If satisfied:                                               │
│     - Export censored content                                   │
│     - Log moderation decision                                   │
└─────────────────────────────────────────────────────────────────┘
```


### 5.2 Decision Tree for Content Certification

```
                    ┌─────────────────┐
                    │  Analyze Content │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Calculate Overall│
                    │   Risk Score     │
                    └────────┬─────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
         Risk < 0.3    0.3 ≤ Risk < 0.6  Risk ≥ 0.6
                │            │            │
                ▼            ▼            ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │    U     │  │   U-A    │  │    A     │
         │Universal │  │Parental  │  │  Adult   │
         │          │  │Guidance  │  │          │
         └──────────┘  └──────────┘  └──────────┘
                                            │
                                            │ Risk ≥ 0.85
                                            ▼
                                     ┌──────────┐
                                     │    S     │
                                     │Restricted│
                                     └──────────┘

After Censorship:
- Remove approved segments from risk calculation
- Recalculate overall risk with remaining content
- Remap to new certification
- Display before → after improvement
```

### 5.3 Segment Detection Algorithm (Conceptual)

```python
def detect_segments(content, content_type):
    segments = []
    
    if content_type == 'video':
        # Frame-by-frame analysis
        frames = extract_frames(content, fps=1)
        for i, frame in enumerate(frames):
            visual_risk = analyze_frame_visual(frame)  # Violence, nudity
            if visual_risk > THRESHOLD:
                segments.append({
                    'start': i,
                    'end': i + 1,
                    'type': 'visual',
                    'risk': visual_risk
                })
        
        # Audio analysis
        audio = extract_audio(content)
        transcript = transcribe_audio(audio)
        for word in transcript:
            if is_profane(word.text):
                segments.append({
                    'start': word.start_time,
                    'end': word.end_time,
                    'type': 'audio',
                    'risk': calculate_profanity_risk(word.text)
                })
    
    elif content_type == 'text':
        # Token-based analysis
        tokens = tokenize(content)
        for i, token in enumerate(tokens):
            if violates_policy(token):
                segments.append({
                    'start': i / len(tokens),
                    'end': (i + 1) / len(tokens),
                    'type': 'text',
                    'risk': calculate_text_risk(token)
                })
    
    # Merge overlapping segments
    segments = merge_segments(segments)
    
    # Calculate per-segment risk scores
    for segment in segments:
        segment['risk_scores'] = calculate_category_risks(segment)
    
    return segments
```

---

## 6. Technology Stack

### 6.1 Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | React | 18.3.1 | UI component library |
| Language | TypeScript | 5.9.3 | Type-safe JavaScript |
| Build Tool | Vite | 7.3.1 | Fast dev server & bundler |
| Styling | Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| Animations | Framer Motion | 11.11.10 | Smooth UI transitions |
| Code Editor | Monaco Editor | 4.6.0 | VS Code editor component |
| HTTP Client | Axios | 1.7.9 | Promise-based HTTP client |
| Icons | Lucide React | 0.563.0 | Icon library |
| State Management | React Context | Built-in | Global state management |

### 6.2 Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | FastAPI | Latest | Modern Python web framework |
| Server | Uvicorn | Latest | ASGI server |
| Validation | Pydantic | Latest | Data validation & serialization |
| Video Processing | FFmpeg | Latest | Video/audio manipulation |
| Video Library | MoviePy | Latest | Python video editing |
| Computer Vision | OpenCV | Latest | Image processing |
| YouTube Downloads | yt-dlp | Latest | YouTube video downloader |
| AI (Future) | OpenAI API | Latest | GPT, Whisper, Vision models |
| Database (Future) | PostgreSQL | 14+ | Relational database |
| ORM (Future) | SQLAlchemy | 2.0+ | Python SQL toolkit |

### 6.3 Development Tools

| Tool | Purpose |
|------|---------|
| Git | Version control |
| npm | Frontend package manager |
| pip | Python package manager |
| Python venv | Virtual environment |
| VS Code | IDE (recommended) |
| Postman | API testing |
| Chrome DevTools | Frontend debugging |

### 6.4 Deployment Stack (Future)

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Containerization | Docker | Application packaging |
| Orchestration | Kubernetes | Container orchestration |
| Reverse Proxy | Nginx | Load balancing & SSL |
| CDN | CloudFront | Static asset delivery |
| Storage | S3 | Object storage for media |
| Monitoring | Prometheus + Grafana | Metrics & visualization |
| Logging | ELK Stack | Centralized logging |
| CI/CD | GitHub Actions | Automated deployment |

---

## 7. Security and Privacy Considerations

### 7.1 Input Validation & Sanitization

**File Upload Security:**
- Validate file types using magic numbers (not just extensions)
- Enforce file size limits (default 500MB)
- Scan for malware using antivirus integration (future)
- Store uploads in isolated directory with restricted permissions
- Generate unique filenames to prevent path traversal

```python
ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/mov']
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB

def validate_upload(file: UploadFile):
    # Check file size
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large")
    
    # Validate MIME type
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(400, "Invalid file type")
    
    # Generate safe filename
    safe_name = f"{uuid.uuid4()}{Path(file.filename).suffix}"
    return safe_name
```

**URL Validation:**
- Whitelist allowed domains (YouTube, Twitter, etc.)
- Validate URL format using regex
- Prevent SSRF attacks by blocking internal IPs
- Use yt-dlp safely with restricted options

```python
ALLOWED_DOMAINS = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com']

def validate_url(url: str):
    parsed = urlparse(url)
    if parsed.netloc not in ALLOWED_DOMAINS:
        raise HTTPException(400, "Domain not allowed")
    
    # Block internal IPs
    if is_internal_ip(parsed.hostname):
        raise HTTPException(400, "Internal URLs not allowed")
```

**Text Input Sanitization:**
- Escape HTML/JavaScript in user-provided text
- Limit text length to prevent DoS
- Validate character encoding (UTF-8)


### 7.2 Authentication & Authorization (Future)

**User Authentication:**
- JWT-based authentication
- Secure password hashing (bcrypt, Argon2)
- Multi-factor authentication (MFA) support
- Session management with expiration
- OAuth2 integration for social login

```python
from passlib.context import CryptContext
from jose import jwt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
```

**Role-Based Access Control (RBAC):**
- Roles: Admin, Moderator, User
- Permissions: analyze, review, approve, configure
- Endpoint-level authorization checks

```python
def require_role(required_role: str):
    def decorator(func):
        async def wrapper(*args, **kwargs):
            user = get_current_user()
            if user.role != required_role:
                raise HTTPException(403, "Insufficient permissions")
            return await func(*args, **kwargs)
        return wrapper
    return decorator

@app.post("/api/review/submit")
@require_role("moderator")
async def submit_review(req: ReviewRequest):
    # Only moderators can submit reviews
    pass
```

### 7.3 Data Privacy

**Minimal Data Retention:**
- Delete uploaded files after processing (configurable TTL)
- Clear temporary files on job completion
- No persistent storage of user content in prototype
- Anonymize logs (remove PII)

```python
import atexit
import tempfile

temp_dir = tempfile.mkdtemp()

def cleanup_temp_files():
    shutil.rmtree(temp_dir, ignore_errors=True)

atexit.register(cleanup_temp_files)
```

**Data Encryption:**
- HTTPS/TLS for all API communication
- Encrypt sensitive data at rest (database encryption)
- Secure key management (AWS KMS, HashiCorp Vault)

**Privacy Compliance:**
- GDPR compliance: Right to deletion, data portability
- CCPA compliance: Opt-out mechanisms
- Data processing agreements with third parties (OpenAI)
- Privacy policy and terms of service

### 7.4 API Security

**Rate Limiting:**
- Prevent abuse and DoS attacks
- Per-user and per-IP rate limits
- Exponential backoff for repeated failures

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/ott/analyze")
@limiter.limit("10/minute")
async def analyze_ott(request: Request, file: UploadFile):
    # Limited to 10 requests per minute per IP
    pass
```

**CORS Configuration:**
- Whitelist allowed origins
- Restrict HTTP methods
- Control exposed headers

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dhurandhar.example.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

**Input Validation:**
- Pydantic models for request validation
- Type checking and constraint enforcement
- Custom validators for complex rules

```python
class AnalyzeRequest(BaseModel):
    url: HttpUrl  # Validates URL format
    options: Optional[Dict[str, Any]] = {}
    
    @validator('url')
    def validate_domain(cls, v):
        if v.host not in ALLOWED_DOMAINS:
            raise ValueError('Domain not allowed')
        return v
```

### 7.5 Secure File Handling

**Temporary File Management:**
- Use secure temporary directories
- Set restrictive file permissions (600)
- Automatic cleanup on process exit
- Prevent symlink attacks

**FFmpeg Security:**
- Sanitize FFmpeg command arguments
- Use subprocess with shell=False
- Timeout for long-running processes
- Validate output file integrity

```python
def run_ffmpeg_safely(args: List[str], timeout: int = 300):
    try:
        result = subprocess.run(
            [get_ffmpeg_bin()] + args,
            capture_output=True,
            timeout=timeout,
            shell=False,  # Prevent shell injection
            check=True
        )
        return result
    except subprocess.TimeoutExpired:
        raise HTTPException(408, "Processing timeout")
    except subprocess.CalledProcessError as e:
        raise HTTPException(500, f"FFmpeg error: {e.stderr}")
```

### 7.6 Audit Logging

**Security Events:**
- Failed authentication attempts
- Unauthorized access attempts
- File uploads and downloads
- Configuration changes
- Data deletions

```python
def log_security_event(event_type: str, user_id: str, details: dict):
    logger.warning(
        f"SECURITY: {event_type}",
        extra={
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "details": details,
            "ip_address": get_client_ip()
        }
    )
```

---

## 8. Scalability Considerations

### 8.1 Current Limitations (Prototype)

- **Single Server**: No horizontal scaling
- **In-Memory Storage**: Limited by RAM, lost on restart
- **Synchronous Processing**: CPU-bound operations block
- **No Load Balancing**: Single point of failure
- **File System Storage**: Not suitable for distributed systems

### 8.2 Horizontal Scaling Strategy

**Load Balancer:**
```
                    ┌─────────────┐
                    │   Nginx     │
                    │Load Balancer│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  FastAPI     │  │  FastAPI     │  │  FastAPI     │
│  Instance 1  │  │  Instance 2  │  │  Instance 3  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   PostgreSQL    │
                │   (Primary)     │
                └────────┬────────┘
                         │
                ┌────────┴────────┐
                │                 │
                ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │  PostgreSQL  │  │  PostgreSQL  │
        │  (Replica 1) │  │  (Replica 2) │
        └──────────────┘  └──────────────┘
```

**Session Affinity:**
- Sticky sessions for SSE connections
- Redis for shared session storage
- JWT tokens for stateless authentication

### 8.3 Asynchronous Job Processing

**Message Queue Architecture:**

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   FastAPI    │──────▶│    Redis     │◀──────│   Worker     │
│   (API)      │ Enqueue│  (Queue)     │ Dequeue│   Pool       │
└──────────────┘       └──────────────┘       └──────┬───────┘
                                                      │
                                              ┌───────┴───────┐
                                              │               │
                                              ▼               ▼
                                       ┌──────────┐   ┌──────────┐
                                       │ Worker 1 │   │ Worker 2 │
                                       └──────────┘   └──────────┘
```

**Celery Integration:**

```python
from celery import Celery

celery_app = Celery(
    'dhurandhar',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/1'
)

@celery_app.task
def analyze_video_task(content_id: str, file_path: str):
    # Long-running video analysis
    result = analyze_video(file_path)
    store_result(content_id, result)
    return result

# In API endpoint
@app.post("/api/ott/analyze")
async def analyze_ott(file: UploadFile):
    content_id = generate_id()
    file_path = save_upload(file)
    task = analyze_video_task.delay(content_id, file_path)
    return {"job_id": task.id, "content_id": content_id}
```


### 8.4 Caching Strategy

**Multi-Level Caching:**

```
┌─────────────────────────────────────────────────────────┐
│  Level 1: Browser Cache (Static Assets)                 │
│  - CSS, JS, Images: 1 year                              │
│  - HTML: No cache                                       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Level 2: CDN Cache (CloudFront)                        │
│  - Static files: Edge locations                        │
│  - API responses: Short TTL (5 min)                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Level 3: Application Cache (Redis)                     │
│  - Analysis results: 1 hour                             │
│  - User sessions: 24 hours                              │
│  - Rate limit counters: 1 minute                        │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Level 4: Database Query Cache                          │
│  - Frequently accessed data                             │
│  - Materialized views                                   │
└─────────────────────────────────────────────────────────┘
```

**Redis Caching Example:**

```python
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def get_cached_analysis(content_id: str) -> Optional[dict]:
    cached = redis_client.get(f"analysis:{content_id}")
    if cached:
        return json.loads(cached)
    return None

def cache_analysis(content_id: str, result: dict, ttl: int = 3600):
    redis_client.setex(
        f"analysis:{content_id}",
        ttl,
        json.dumps(result)
    )

@app.post("/api/ott/analyze")
async def analyze_ott(file: UploadFile):
    content_id = generate_content_id(file)
    
    # Check cache first
    cached = get_cached_analysis(content_id)
    if cached:
        return cached
    
    # Perform analysis
    result = await analyze_video(file)
    
    # Cache result
    cache_analysis(content_id, result)
    
    return result
```

### 8.5 Database Optimization

**Indexing Strategy:**
- B-tree indexes on foreign keys and frequently queried columns
- Partial indexes for filtered queries
- Covering indexes for common query patterns

```sql
-- Composite index for content lookup by user and type
CREATE INDEX idx_content_user_type ON content(user_id, content_type);

-- Partial index for active jobs
CREATE INDEX idx_jobs_active ON jobs(status) WHERE status IN ('queued', 'running');

-- Covering index for segment queries
CREATE INDEX idx_segments_analysis_covering ON segments(analysis_id) 
INCLUDE (start_position, end_position, labels);
```

**Query Optimization:**
- Use EXPLAIN ANALYZE to identify slow queries
- Implement pagination for large result sets
- Use connection pooling (SQLAlchemy)
- Read replicas for analytics queries

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True
)
```

**Data Partitioning:**
- Partition large tables by date (analyses, audit_log)
- Archive old data to cold storage
- Implement soft deletes for audit trail

```sql
-- Partition analyses table by month
CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE analyses_2024_01 PARTITION OF analyses
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 8.6 Content Delivery Optimization

**Object Storage (S3):**
- Store processed videos in S3
- Use presigned URLs for secure access
- Lifecycle policies for automatic deletion
- S3 Transfer Acceleration for global uploads

```python
import boto3
from botocore.config import Config

s3_client = boto3.client(
    's3',
    config=Config(signature_version='s3v4')
)

def upload_to_s3(file_path: str, bucket: str, key: str):
    s3_client.upload_file(
        file_path,
        bucket,
        key,
        ExtraArgs={'ContentType': 'video/mp4'}
    )

def generate_presigned_url(bucket: str, key: str, expiration: int = 3600):
    return s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket, 'Key': key},
        ExpiresIn=expiration
    )
```

**CDN Integration:**
- CloudFront distribution for static assets
- Edge caching for frequently accessed content
- Custom cache behaviors for different content types
- Origin shield for additional caching layer

### 8.7 Monitoring & Observability

**Metrics Collection (Prometheus):**

```python
from prometheus_client import Counter, Histogram, Gauge

# Request metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration')

# Job metrics
active_jobs = Gauge('active_jobs', 'Number of active jobs', ['job_type'])
job_duration = Histogram('job_duration_seconds', 'Job processing duration', ['job_type'])

# Business metrics
content_analyzed = Counter('content_analyzed_total', 'Total content analyzed', ['content_type'])
segments_detected = Counter('segments_detected_total', 'Total segments detected', ['category'])

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    request_duration.observe(duration)
    
    return response
```

**Distributed Tracing (Jaeger):**

```python
from opentelemetry import trace
from opentelemetry.exporter.jaeger import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider

tracer_provider = TracerProvider()
jaeger_exporter = JaegerExporter(
    agent_host_name="localhost",
    agent_port=6831,
)
tracer_provider.add_span_processor(
    BatchSpanProcessor(jaeger_exporter)
)
trace.set_tracer_provider(tracer_provider)

tracer = trace.get_tracer(__name__)

@app.post("/api/ott/analyze")
async def analyze_ott(file: UploadFile):
    with tracer.start_as_current_span("analyze_ott"):
        with tracer.start_as_current_span("extract_metadata"):
            metadata = extract_metadata(file)
        
        with tracer.start_as_current_span("detect_segments"):
            segments = detect_segments(file)
        
        return {"segments": segments}
```

**Logging Strategy:**

```python
import logging
import json

# Structured logging
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'content_id'):
            log_data['content_id'] = record.content_id
        return json.dumps(log_data)

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger = logging.getLogger("dhurandhar")
logger.addHandler(handler)
logger.setLevel(logging.INFO)
```

### 8.8 Auto-Scaling Configuration

**Kubernetes Horizontal Pod Autoscaler:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dhurandhar-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dhurandhar-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
```

**Worker Auto-Scaling:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dhurandhar-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dhurandhar-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: redis_queue_length
      target:
        type: AverageValue
        averageValue: "10"
```

---

## 9. Deployment Architecture

### 9.1 Development Environment

```
┌─────────────────────────────────────────────────────────┐
│  Developer Machine                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Frontend (Vite Dev Server)                      │   │
│  │  http://localhost:5173                           │   │
│  │  - Hot Module Replacement                        │   │
│  │  - Proxy to backend                              │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Backend (Uvicorn)                               │   │
│  │  http://localhost:8000                           │   │
│  │  - Auto-reload on code changes                   │   │
│  │  - In-memory storage                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Production Environment

```
┌─────────────────────────────────────────────────────────────────┐
│  AWS Cloud Infrastructure                                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CloudFront CDN                                             │ │
│  │  - Static assets (JS, CSS, images)                         │ │
│  │  - Edge caching                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Application Load Balancer (ALB)                            │ │
│  │  - SSL/TLS termination                                      │ │
│  │  - Health checks                                            │ │
│  │  - Path-based routing                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│              ┌─────────────┴─────────────┐                      │
│              ▼                           ▼                      │
│  ┌─────────────────────┐     ┌─────────────────────┐          │
│  │  ECS Fargate        │     │  ECS Fargate        │          │
│  │  (API Containers)   │     │  (Worker Containers)│          │
│  │  - Auto-scaling     │     │  - Job processing   │          │
│  │  - Health checks    │     │  - Auto-scaling     │          │
│  └─────────────────────┘     └─────────────────────┘          │
│              │                           │                      │
│              └─────────────┬─────────────┘                      │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ElastiCache (Redis)                                        │ │
│  │  - Session storage                                          │ │
│  │  - Job queue                                                │ │
│  │  - Application cache                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  RDS PostgreSQL (Multi-AZ)                                  │ │
│  │  - Primary instance                                         │ │
│  │  - Read replicas                                            │ │
│  │  - Automated backups                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  S3 Buckets                                                 │ │
│  │  - Original content                                         │ │
│  │  - Censored content                                         │ │
│  │  - Temporary files                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Conclusion

The CensorCorpX AI Content Censorship Intelligence Platform is designed as a modern, scalable, and secure system for automated content moderation. The architecture emphasizes:

- **Modularity**: Clear separation of concerns between frontend, backend, and external services
- **Scalability**: Asynchronous processing, horizontal scaling, and caching strategies
- **Security**: Input validation, authentication, encryption, and audit logging
- **User Experience**: Real-time feedback, intuitive interface, and human oversight
- **Extensibility**: Pluggable AI models and configurable policies

The current prototype demonstrates core functionality with in-memory storage and simulated AI, providing a solid foundation for production deployment with real AI integration, persistent storage, and enterprise-grade infrastructure.

---

**Document Version**: 1.0  
**Date**: February 14, 2026  
**Status**: Final Draft  
**Authors**: Team CensorCorpX AI
