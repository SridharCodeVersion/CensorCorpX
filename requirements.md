# CensorCorpX AI - Content Censorship Intelligence Platform
## Requirements Document

---

## 1. Problem Statement

Content platforms (OTT, YouTube, social media, music streaming, and documentation repositories) face significant challenges in moderating and censoring inappropriate content at scale. Manual review is time-consuming, inconsistent, and cannot keep pace with the volume of content being uploaded. Current automated solutions lack:

- **Granular detection**: Inability to identify specific segments within media that require censorship
- **Context-aware analysis**: Lack of understanding of cultural, linguistic, and contextual nuances
- **Flexible censorship options**: Limited choices beyond complete removal (blur, beep, cut, hide captions)
- **Transparency**: No clear reasoning or risk scoring for moderation decisions
- **Human oversight**: Insufficient integration of human review in the automated workflow
- **Certification mapping**: No automated content rating/certification based on detected risks
- **Reversibility**: Inability to undo or restore previous censorship decisions

CensorCorpX AI addresses these challenges by providing an AI-powered, multi-modal censorship intelligence platform that detects, analyzes, scores, and applies customizable censorship treatments while maintaining human oversight and full audit trails.

---

## 2. Functional Requirements

### 2.1 Core Content Analysis

#### FR-1: OTT Video Analysis
- **FR-1.1**: Accept video file uploads (multiple formats supported via FFmpeg)
- **FR-1.2**: Detect sensitive segments with precise timestamps (start/end)
- **FR-1.3**: Classify segments by category: violence, abusive language, nudity, substance abuse, etc.
- **FR-1.4**: Generate per-segment risk scores (0-1 scale) for each category
- **FR-1.5**: Calculate overall content risk score
- **FR-1.6**: Map risk scores to film certification ratings (U, U-A, A, S)
- **FR-1.7**: Provide before/after certification comparison
- **FR-1.8**: Generate visual heatmap showing risk intensity across video timeline
- **FR-1.9**: Support asynchronous processing with real-time progress updates via Server-Sent Events (SSE)

#### FR-2: YouTube Video Analysis
- **FR-2.1**: Accept YouTube URLs for analysis
- **FR-2.2**: Download and extract video content using yt-dlp
- **FR-2.3**: Perform all OTT analysis features (FR-1.2 through FR-1.8)
- **FR-2.4**: Detect platform-specific risks: fake news, extremism, hate speech, copyright violations, clickbait
- **FR-2.5**: Provide YouTube-specific risk flags and recommendations

#### FR-3: Music/Audio Analysis
- **FR-3.1**: Accept audio file uploads or YouTube music URLs
- **FR-3.2**: Detect explicit lyrics and sensitive themes
- **FR-3.3**: Identify segments containing profanity, sexual content, drug references, violence
- **FR-3.4**: Generate risk scores and heatmap for audio timeline
- **FR-3.5**: Support both audio-only and music video formats

#### FR-4: Social Media Content Analysis
- **FR-4.1**: Accept text input (direct paste) or social media URLs
- **FR-4.2**: Extract text content from supported platforms (Twitter/X, Instagram, Threads)
- **FR-4.3**: Detect policy violations: hate speech, harassment, misinformation, explicit content
- **FR-4.4**: Generate sanitized version with censored phrases replaced by "***"
- **FR-4.5**: Provide detailed list of censored elements with:
  - Original text
  - Category (profanity, hate speech, etc.)
  - Reason for censorship
  - Severity level (low, medium, high)
- **FR-4.6**: Display risk breakdown by category
- **FR-4.7**: Generate text-based heatmap showing risk distribution

#### FR-5: Documentation Analysis
- **FR-5.1**: Accept text file uploads (.txt, .md, .pdf, .docx)
- **FR-5.2**: Extract and analyze text content
- **FR-5.3**: Detect sensitive information: PII, confidential data, inappropriate language
- **FR-5.4**: Generate sanitized version suitable for public release
- **FR-5.5**: Provide risk analysis and certification recommendations

### 2.2 Censorship Application

#### FR-6: Flexible Censorship Options
- **FR-6.1**: Cut clip duration (remove flagged segments entirely)
- **FR-6.2**: Cut captions only (remove subtitle text during flagged segments)
- **FR-6.3**: Hide captions (suppress subtitles without removing them)
- **FR-6.4**: Blur video (apply visual blur effect to flagged segments)
- **FR-6.5**: Add beep sound (overlay audio beep during flagged segments)
- **FR-6.6**: Mute audio (silence audio during flagged segments)
- **FR-6.7**: Support multiple simultaneous treatments (e.g., blur + beep)
- **FR-6.8**: Apply treatments only to approved segments

#### FR-7: Censored Content Generation
- **FR-7.1**: Generate censored video preview with selected treatments
- **FR-7.2**: Update video duration if segments are cut
- **FR-7.3**: Provide side-by-side comparison (original vs. censored)
- **FR-7.4**: Display censored timeline visualization showing:
  - Blurred segments (amber)
  - Beeped segments (blue)
  - Cut segments (red)
- **FR-7.5**: Support asynchronous rendering with progress tracking

### 2.3 Human Review & Oversight

#### FR-8: Segment Review Interface
- **FR-8.1**: Display all detected segments with metadata:
  - Labels/categories
  - Timestamps or percentage ranges
  - Risk scores per category
  - Peak risk score
  - Confidence level
  - AI reasoning/explanation
- **FR-8.2**: Allow human reviewers to approve/reject each segment
- **FR-8.3**: Default all segments to approved state
- **FR-8.4**: Visually distinguish approved vs. rejected segments
- **FR-8.5**: Update censorship preview based on review decisions

#### FR-9: Review Submission
- **FR-9.1**: Accept human review decisions for content
- **FR-9.2**: Recompute effective risk and certification based on approved segments
- **FR-9.3**: Store review decisions in version history
- **FR-9.4**: Append new version to content history stack

### 2.4 Version Control & History

#### FR-10: Content History Management
- **FR-10.1**: Maintain version history per content_id
- **FR-10.2**: Store each analysis result as a versioned snapshot
- **FR-10.3**: Support undo/restore to previous AI versions
- **FR-10.4**: Track history keys per content tab
- **FR-10.5**: Allow rollback of censorship decisions

### 2.5 AI Assistant

#### FR-11: Contextual AI Chat
- **FR-11.1**: Provide chat interface for user questions
- **FR-11.2**: Enforce strict on-topic responses (CensorCorpX usage, interpretation of results)
- **FR-11.3**: Refuse off-topic queries with polite redirection
- **FR-11.4**: Provide short, concise answers (2-3 sentences)
- **FR-11.5**: Display get-started cards with common questions

### 2.6 Child Protection Features

#### FR-12: Content Locking
- **FR-12.1**: Support per-tab child protection lock
- **FR-12.2**: Apply blur effect to locked content
- **FR-12.3**: Block user interaction with locked content
- **FR-12.4**: Display lock status indicator

### 2.7 Data Export & Reporting

#### FR-13: Analysis Export
- **FR-13.1**: Provide structured JSON response for all analysis endpoints
- **FR-13.2**: Include complete metadata: segments, scores, heatmap, certification
- **FR-13.3**: Support programmatic API access for integration

---

## 3. Non-Functional Requirements

### 3.1 Performance

#### NFR-1: Response Time
- **NFR-1.1**: API health check responds within 100ms
- **NFR-1.2**: Text analysis (social/docs) completes within 5 seconds for typical content
- **NFR-1.3**: Video analysis initiates within 2 seconds (async job start)
- **NFR-1.4**: Progress updates stream every 1-2 seconds during processing

#### NFR-2: Scalability
- **NFR-2.1**: Support concurrent analysis of multiple content items
- **NFR-2.2**: Handle video files up to 500MB
- **NFR-2.3**: Process text content up to 100,000 characters
- **NFR-2.4**: Maintain in-memory history for up to 1000 content items per session

#### NFR-3: Throughput
- **NFR-3.1**: Process at least 10 concurrent video analysis jobs
- **NFR-3.2**: Handle 100+ text analysis requests per minute

### 3.2 Reliability

#### NFR-4: Availability
- **NFR-4.1**: System uptime of 99.5% during business hours
- **NFR-4.2**: Graceful degradation when AI services are unavailable
- **NFR-4.3**: Automatic retry for transient failures

#### NFR-5: Error Handling
- **NFR-5.1**: Provide clear error messages for all failure scenarios
- **NFR-5.2**: Log errors with sufficient context for debugging
- **NFR-5.3**: Prevent data loss during processing failures
- **NFR-5.4**: Support job status tracking (queued, running, done, error)

### 3.3 Usability

#### NFR-6: User Interface
- **NFR-6.1**: VS Code-inspired dark theme with professional aesthetics
- **NFR-6.2**: Responsive layout supporting 1920x1080 minimum resolution
- **NFR-6.3**: Intuitive tab-based navigation for content types
- **NFR-6.4**: Real-time progress indicators with percentage display
- **NFR-6.5**: Smooth animations and transitions (Framer Motion)
- **NFR-6.6**: Accessible color coding for risk levels (green/amber/red)

#### NFR-7: User Experience
- **NFR-7.1**: Drag-and-drop file upload support
- **NFR-7.2**: Side-by-side content comparison
- **NFR-7.3**: Interactive timeline with hover tooltips
- **NFR-7.4**: One-click censorship application
- **NFR-7.5**: Clear visual feedback for all actions

### 3.4 Security

#### NFR-8: Data Protection
- **NFR-8.1**: Sanitize and validate all user inputs
- **NFR-8.2**: Prevent injection attacks (SQL, command, XSS)
- **NFR-8.3**: Secure file upload handling with type validation
- **NFR-8.4**: CORS configuration for API endpoints

#### NFR-9: Privacy
- **NFR-9.1**: Do not persist uploaded content beyond session
- **NFR-9.2**: Clear temporary files after processing
- **NFR-9.3**: No external data transmission without user consent
- **NFR-9.4**: Anonymize logs and error reports

### 3.5 Maintainability

#### NFR-10: Code Quality
- **NFR-10.1**: Modular architecture with clear separation of concerns
- **NFR-10.2**: Type-safe implementations (TypeScript, Pydantic)
- **NFR-10.3**: Consistent code formatting and naming conventions
- **NFR-10.4**: Comprehensive inline documentation

#### NFR-11: Extensibility
- **NFR-11.1**: Pluggable AI model integration (OpenAI, Whisper, Vision)
- **NFR-11.2**: Configurable risk thresholds and certification mappings
- **NFR-11.3**: Support for additional content types via modular design
- **NFR-11.4**: API versioning for backward compatibility

### 3.6 Compatibility

#### NFR-12: Platform Support
- **NFR-12.1**: Backend runs on Windows, macOS, Linux
- **NFR-12.2**: Frontend supports modern browsers (Chrome, Firefox, Safari, Edge)
- **NFR-12.3**: Python 3.8+ compatibility
- **NFR-12.4**: Node.js 16+ compatibility

#### NFR-13: Integration
- **NFR-13.1**: RESTful API design for easy integration
- **NFR-13.2**: Standard HTTP status codes and error formats
- **NFR-13.3**: JSON request/response format
- **NFR-13.4**: OpenAPI/Swagger documentation support

---

## 4. User Roles

### 4.1 Content Moderator
**Primary user role responsible for reviewing and censoring content**

**Responsibilities:**
- Upload content for analysis (videos, audio, text, URLs)
- Review AI-detected segments and risk assessments
- Approve or reject flagged segments
- Select appropriate censorship treatments
- Generate censored content previews
- Make final decisions on content certification

**Permissions:**
- Full access to all content types (OTT, YouTube, Music, Social, Docs)
- Ability to run AI analysis
- Ability to apply censorship treatments
- Access to human review interface
- Access to version history and undo functionality

**Typical Workflow:**
1. Upload or input content
2. Run AI analysis
3. Review detected segments and risk scores
4. Adjust approval status for segments
5. Select censorship options
6. Generate censored preview
7. Verify results and export

### 4.2 Platform Administrator
**System administrator managing platform configuration and monitoring**

**Responsibilities:**
- Configure AI model endpoints and API keys
- Set risk thresholds and certification mappings
- Monitor system performance and job queues
- Review error logs and system health
- Manage user access and permissions (future)
- Configure content policies and rules

**Permissions:**
- Access to system configuration files
- Backend server management
- Database and storage management
- API endpoint configuration
- Monitoring and logging access

### 4.3 AI Assistant (System Role)
**Automated agent providing contextual help and guidance**

**Responsibilities:**
- Answer user questions about platform usage
- Explain risk scores and certification logic
- Provide interpretation of analysis results
- Guide users through workflows
- Refuse off-topic queries

**Constraints:**
- Strictly on-topic responses only
- Short, concise answers (2-3 sentences)
- No sensitive or personal topic discussions
- No external information retrieval

### 4.4 End User (Future Role)
**Content creator or platform user submitting content for review**

**Responsibilities:**
- Submit content for automated review
- View analysis results and certification
- Accept or appeal moderation decisions
- Download censored versions

**Permissions:**
- Limited to own content submissions
- Read-only access to analysis results
- No access to system configuration

---

## 5. Constraints

### 5.1 Technical Constraints

#### TC-1: Technology Stack
- **TC-1.1**: Backend must use FastAPI framework (Python)
- **TC-1.2**: Frontend must use React + TypeScript + Vite
- **TC-1.3**: Video processing requires FFmpeg installation
- **TC-1.4**: Audio extraction requires MoviePy and OpenCV
- **TC-1.5**: YouTube downloads require yt-dlp

#### TC-2: AI Model Integration
- **TC-2.1**: Current prototype uses simulated AI detection (placeholder logic)
- **TC-2.2**: Production requires OpenAI API integration (GPT, Whisper, Vision)
- **TC-2.3**: AI model responses must be structured and parseable
- **TC-2.4**: Fallback logic required when AI services are unavailable

#### TC-3: Storage & Memory
- **TC-3.1**: In-memory storage for version history (no persistent database in prototype)
- **TC-3.2**: Temporary file storage for uploaded content
- **TC-3.3**: File cleanup required after processing
- **TC-3.4**: Session-based data retention only

#### TC-4: Processing Limitations
- **TC-4.1**: Video processing is CPU/GPU intensive
- **TC-4.2**: Large files may require extended processing time
- **TC-4.3**: Concurrent job limit based on server resources
- **TC-4.4**: No distributed processing in current architecture

### 5.2 Business Constraints

#### BC-1: Budget & Resources
- **BC-1.1**: Prototype development with minimal external API costs
- **BC-1.2**: OpenAI API usage subject to rate limits and costs
- **BC-1.3**: Server infrastructure limited to single-instance deployment
- **BC-1.4**: No dedicated database server in initial release

#### BC-2: Timeline
- **BC-2.1**: Prototype must demonstrate core functionality
- **BC-2.2**: Production-ready AI integration deferred to Phase 2
- **BC-2.3**: Advanced features (user management, analytics) planned for future releases

#### BC-3: Compliance & Legal
- **BC-3.1**: Content moderation must comply with platform policies
- **BC-3.2**: Certification mappings based on regional rating systems
- **BC-3.3**: User data privacy must be maintained
- **BC-3.4**: No storage of copyrighted content without authorization

### 5.3 Operational Constraints

#### OC-1: Deployment
- **OC-1.1**: Backend runs on port 8000 (configurable)
- **OC-1.2**: Frontend dev server proxies API requests to backend
- **OC-1.3**: Production requires separate static file serving
- **OC-1.4**: CORS configuration required for cross-origin requests

#### OC-2: Dependencies
- **OC-2.1**: Python virtual environment required for backend
- **OC-2.2**: Node.js and npm required for frontend
- **OC-2.3**: FFmpeg must be installed and accessible in PATH
- **OC-2.4**: Internet connection required for YouTube downloads and AI APIs

#### OC-3: Monitoring & Logging
- **OC-3.1**: Console logging for development
- **OC-3.2**: Structured logging required for production
- **OC-3.3**: Job status tracking via in-memory state
- **OC-3.4**: Error reporting via API responses and logs

### 5.4 User Experience Constraints

#### UX-1: Browser Requirements
- **UX-1.1**: Modern browser with ES6+ support required
- **UX-1.2**: JavaScript must be enabled
- **UX-1.3**: Minimum screen resolution: 1366x768
- **UX-1.4**: Recommended resolution: 1920x1080 or higher

#### UX-2: Content Limitations
- **UX-2.1**: Video file size limited by server configuration (default 500MB)
- **UX-2.2**: Text content limited to reasonable lengths for performance
- **UX-2.3**: YouTube URLs must be publicly accessible
- **UX-2.4**: Social media URLs must be from supported platforms

#### UX-3: Feature Availability
- **UX-3.1**: Real-time collaboration not supported
- **UX-3.2**: Offline mode not available
- **UX-3.3**: Mobile interface not optimized (desktop-first design)
- **UX-3.4**: Export formats limited to JSON and processed media files

---

## 6. System Architecture Overview

### 6.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TS)                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │   OTT    │ YouTube  │  Music   │  Social  │   Docs   │  │
│  │  Editor  │  Editor  │  Editor  │  Editor  │  Editor  │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Activity Bar │ Bottom Panel │ Assistant Panel       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Analysis Endpoints  │  Apply Endpoints  │  Utilities │  │
│  │  /ott/analyze        │  /ott/apply       │  /chat     │  │
│  │  /youtube/analyze    │  /youtube/apply   │  /review   │  │
│  │  /music/analyze      │  /music/apply     │  /history  │  │
│  │  /social/analyze     │                   │  /health   │  │
│  │  /docs/analyze       │                   │            │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Job Queue (Async)  │  Version History  │  AI Models │  │
│  │  SSE Event Streams  │  In-Memory Store  │  (Future)  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              External Services & Dependencies                │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │  FFmpeg  │  MoviePy │  yt-dlp  │  OpenAI  │  OpenCV  │  │
│  │  (Video) │  (Audio) │(YouTube) │   (AI)   │ (Vision) │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

1. **Content Upload**: User uploads/inputs content via frontend
2. **Analysis Request**: Frontend sends POST request to analysis endpoint
3. **Job Creation**: Backend creates async job and returns job_id
4. **Processing**: Backend worker processes content (extract, analyze, score)
5. **Progress Updates**: Backend streams progress via SSE to frontend
6. **Result Storage**: Analysis result stored in version history
7. **Result Display**: Frontend receives final result and updates UI
8. **Human Review**: User reviews segments and adjusts approvals
9. **Censorship Application**: User selects options and requests censored version
10. **Rendering**: Backend applies treatments and generates output
11. **Preview**: Frontend displays censored content side-by-side with original

---

## 7. API Endpoints Summary

### Analysis Endpoints
- `POST /api/ott/analyze_async` - Analyze OTT video (async)
- `POST /api/youtube/analyze_async` - Analyze YouTube video (async)
- `POST /api/music/analyze_async` - Analyze music/audio (async)
- `POST /api/social/analyze` - Analyze social media content (sync)
- `POST /api/docs/analyze` - Analyze documentation (sync)

### Application Endpoints
- `POST /api/ott/apply_async` - Apply OTT censorship (async)
- `POST /api/youtube/apply_async` - Apply YouTube censorship (async)
- `POST /api/music/apply_async` - Apply music censorship (async)

### Utility Endpoints
- `GET /api/health` - Health check
- `GET /api/jobs/{job_id}/events` - SSE stream for job progress
- `POST /api/review/submit` - Submit human review decisions
- `POST /api/history/restore` - Restore previous version
- `POST /api/chat` - AI assistant chat

---

## 8. Future Enhancements

### Phase 2 Features
- Real AI model integration (OpenAI GPT, Whisper, Vision)
- Persistent database (PostgreSQL) for content and history
- User authentication and authorization
- Multi-user collaboration and role-based access control
- Advanced analytics and reporting dashboard
- Batch processing for multiple files
- Custom rule engine for organization-specific policies

### Phase 3 Features
- Real-time collaborative review
- Mobile-responsive interface
- API rate limiting and quotas
- Webhook notifications for job completion
- Integration with major platforms (YouTube, TikTok, Instagram APIs)
- Machine learning model fine-tuning based on review feedback
- Multi-language support for international content

---

## Document Version
- **Version**: 1.0
- **Date**: February 14, 2026
- **Status**: Draft
- **Authors**: Team CensorCorpX AI
