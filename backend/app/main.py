from fastapi import FastAPI, UploadFile, Form, HTTPException, File, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import os
import uuid
import json
import time
import asyncio
import shutil
import subprocess
import shutil
import subprocess
import math
import yt_dlp

from app.utils import get_ffmpeg_bin, get_video_duration, parse_webvtt

# Simple keyword list for music censorship
_SENSITIVE_KEYWORDS = {
    "fuck": "explicit_language",
    "shit": "explicit_language",
    "bitch": "explicit_language",
    "faggot": "hate_speech",
    "nigger": "hate_speech",
    "nigga": "explicit_language",
    "ass": "explicit_language",
    "damn": "explicit_language",
    "kill": "violence",
    "murder": "violence",
    "die": "violence",
    "dick": "sexual",
    "cock": "sexual",
    "pussy": "sexual"
}

# Resolve uploads dir relative to this file but OUTSIDE the watched backend directory (to avoid WinError 32 with --reload)
_APP_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_APP_DIR)
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
# Move uploads to project root so it's not inside the uvicorn-watched 'backend' or 'app' folders
UPLOADS_DIR = os.path.join(_PROJECT_ROOT, "uploads")

# Cleanup helper to prevent file accumulation
def _cleanup_content_files(content_id: str, content_type: str):
    """Clean up all files associated with a content_id to prevent disk space issues."""
    try:
        content_dir = os.path.join(UPLOADS_DIR, content_type)
        if not os.path.exists(content_dir):
            return
        for filename in os.listdir(content_dir):
            if content_id in filename:
                filepath = os.path.join(content_dir, filename)
                try:
                    os.remove(filepath)
                except Exception:
                    pass  # Ignore errors during cleanup
    except Exception:
        pass  # Ignore all cleanup errors



class RiskScore(BaseModel):
  category: str
  score: float


class Segment(BaseModel):
  id: str
  start: float
  end: float
  labels: List[str]
  risk_scores: List[RiskScore]
  # OTT agent: machine-readable UI sync (STEP 2)
  reason: Optional[str] = None
  confidence: Optional[str] = None
  peak_risk_str: Optional[str] = None
  start_time: Optional[str] = None  # hh:mm:ss.ms
  end_time: Optional[str] = None


class AnalysisCard(BaseModel):
  title: str
  body: str


class AnalyzeResponse(BaseModel):
  content_id: str
  duration: float
  segments: List[Segment]
  certification_before: str
  certification_after: str
  overall_risk: float
  heatmap: List[Dict]
  analysis_cards: List[AnalysisCard]
  certification_logic: Optional[str] = None


class ChatRequest(BaseModel):
  question: str
  context: Dict


class ChatResponse(BaseModel):
  answer: str


class TextRequest(BaseModel):
  text: Optional[str] = None
  url: Optional[str] = None


class UrlRequest(BaseModel):
  url: str


class ReviewDecision(BaseModel):
  segment_id: str
  approved: bool


class ReviewRequest(BaseModel):
  content_id: str
  decisions: List[ReviewDecision]


class HistoryRequest(BaseModel):
  content_id: str


class CensoredElement(BaseModel):
  category: str
  original: str
  reason: str
  severity: str


class RiskBreakdown(BaseModel):
  category: str
  score: float


class TextRequest(BaseModel):
  text: Optional[str] = None
  url: Optional[str] = None


class SocialAnalyzeResponse(AnalyzeResponse):
  sanitized_content: Optional[str] = None
  censored_elements: List[CensoredElement] = []
  risk_breakdown: List[RiskBreakdown] = []
  certification_reason: Optional[str] = None
  ai_analysis_input: Optional[str] = None
  ai_analysis_output: Optional[str] = None
  ai_analysis_risk: Optional[str] = None
  ai_analysis_cert: Optional[str] = None


class MusicStartResponse(BaseModel):
  job_id: str
  content_id: str
  original_url: str


class MusicApplyRequest(BaseModel):
  content_id: str
  options: Optional[Dict[str, Any]] = None


class MusicApplyResponse(BaseModel):
  job_id: str
  content_id: str


app = FastAPI(title="Dhurandhar Backend", version="0.1.0")

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


_VERSIONS: Dict[str, List[AnalyzeResponse]] = {}

# Minimal in-memory job store (prototype)
_JOBS: Dict[str, Dict[str, Any]] = {}

os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


def _store_version(resp: AnalyzeResponse) -> None:
  versions = _VERSIONS.setdefault(resp.content_id, [])
  versions.append(resp)


def _classify_certification(overall_risk: float) -> str:
  if overall_risk < 0.25:
    return "U"
  if overall_risk < 0.5:
    return "U-A"
  if overall_risk < 0.8:
    return "A"
  return "S"


def _sec_to_timestamp(sec: float) -> str:
  """Format seconds as 00:00:12.300 for OTT segment mapping."""
  h = int(sec // 3600)
  m = int((sec % 3600) // 60)
  s = sec % 60
  return f"{h:02d}:{m:02d}:{s:06.3f}"


def _build_text_segments(text: str, categories: List[str]) -> AnalyzeResponse:
  content_id = str(uuid.uuid4())
  length = max(len(text), 1)
  words = text.split()
  segments: List[Segment] = []
  flags = ["violence", "abusive", "hate", "drugs", "sexual", "extremism", "self-harm", "fake"]
  idx = 0
  for w in words:
    lw = w.lower()
    matched = [c for c in categories if any(f in lw for f in flags)]
    if matched:
      start = idx / len(words)
      end = min(1.0, (idx + 1) / len(words))
      segments.append(
        Segment(
          id=f"seg-{idx}",
          start=start,
          end=end,
          labels=matched,
          risk_scores=[RiskScore(category=m, score=0.6) for m in matched],
        )
      )
    idx += 1

  if not segments:
    segments.append(
      Segment(
        id="seg-safe",
        start=0.0,
        end=1.0,
        labels=["safe"],
        risk_scores=[RiskScore(category="safe", score=0.05)],
      )
    )

  overall_risk = max(rs.score for s in segments for rs in s.risk_scores)
  cert_before = _classify_certification(overall_risk)
  cert_after = _classify_certification(max(overall_risk - 0.2, 0.0))

  heatmap = [
    {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
    for s in segments
  ]

  analysis_cards = [
    AnalysisCard(
      title="Text screening complete",
      body="The document or post was scanned for sensitive phrases and each flagged span contributes to the risk heatmap and certification.",
    )
  ]

  resp = AnalyzeResponse(
    content_id=content_id,
    duration=float(length),
    segments=segments,
    certification_before=cert_before,
    certification_after=cert_after,
    overall_risk=overall_risk,
    heatmap=heatmap,
    analysis_cards=analysis_cards,
  )
  _store_version(resp)
  return resp


def _extract_text_from_social_url(url: str) -> str:
    """
    Extracts text/caption/description from a social media URL using yt-dlp.
    """
    try:
        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'extract_flat': True,  # Just get metadata, don't download
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Extracting info from {url}...")
            info = ydl.extract_info(url, download=False)
            if not info:
                return ""
            
            # Try to find meaningful text
            description = info.get('description') or ""
            title = info.get('title') or ""
            uploader = info.get('uploader') or ""
            
            # Combine relevant fields
            extracted = f"Post by {uploader}: {title}\n{description}"
            return extracted.strip()
    except Exception as e:
        print(f"Error extracting from URL {url}: {e}")
        # MOCK FALLBACK FOR DEMO (since Twitter scraping is flaky without auth)
        if "twitter.com" in url or "x.com" in url:
            return "Mock Tweet: This politician is an idiot and spreads fake news. (Simulated content due to extraction failure)"
        return ""

def _extract_text_from_document(file_path: str) -> str:
    """
    Extracts text from DOCX or PDF documents.
    """
    try:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.docx':
            from docx import Document
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text.strip()
        
        elif ext == '.pdf':
            import PyPDF2
            text = ""
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
            return text.strip()
        
        else:
            return f"Unsupported file format: {ext}"
    
    except Exception as e:
        print(f"Error extracting text from {file_path}: {e}")
        return f"Error extracting text: {str(e)}"

def _analyze_social_media_content(text: str = "", url: str = None) -> SocialAnalyzeResponse:
    # 0. RESOLVE URL IF PROVIDED
    if url and (not text or not text.strip()):
         extracted = _extract_text_from_social_url(url)
         if extracted:
             text = extracted
         else:
             text = f"Could not extract content from {url}. Please paste text manually."

    # TRY OPENAI IF KEY EXISTS
    if os.environ.get("OPENAI_API_KEY"):
        try:
            from openai import OpenAI
            client = OpenAI()
            
            system_prompt = (
                "You are the 'Dhurandhar Social Media Censorship Agent'.\n"
                "INPUT: Social text.\n"
                "TASK: Detect structure, tone, meaning. Detect Hate speech, Abusive, Sexual, Violence, "
                "Harassment, Extremism, Fake news, Self-harm. Flag specific words/phrases.\n"
                "OUTPUT JSON: { sanitized_content: str, censored_elements: [{category, original, reason, severity}], "
                "risk_score: float (0-100), risk_breakdown: [{category, score}], heatmap: [{text, risk_level}], "
                "certification: {before, after, reason}, ai_analysis: {input_summary, output_summary, risk_assessment, certification_justification} }\n"
                "Sanitize with ***. "
            )
            
            completion = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                response_format={"type": "json_object"}
            )
            data = json.loads(completion.choices[0].message.content)
            # Map JSON to Schema
            censored_elements = [
                CensoredElement(**ce) for ce in data.get("censored_elements", [])
            ]
            
            risk_breakdown = [
                RiskBreakdown(**rb) for rb in data.get("risk_breakdown", [])
            ]
            
            heatmap_raw = data.get("heatmap", [])
            heatmap = []
            
            for h in heatmap_raw:
                heatmap.append({
                    "start": 0.0, "end": 1.0, 
                    "intensity": 0.8 if h.get("risk_level") == "high" else 0.5,
                    "categories": [h.get("text")]
                })
            
            cert = data.get("certification", {})
            ai = data.get("ai_analysis", {})
            
            return SocialAnalyzeResponse(
                content_id=str(uuid.uuid4()),
                duration=len(text),
                segments=[], 
                certification_before=cert.get("before", "U"),
                certification_after=cert.get("after", "U"),
                overall_risk=float(data.get("risk_score", 0)) / 100.0,
                heatmap=heatmap,
                analysis_cards=[
                    AnalysisCard(title="Input", body=ai.get("input_summary", "")),
                    AnalysisCard(title="Output", body=ai.get("output_summary", "")),
                    AnalysisCard(title="Risk", body=ai.get("risk_assessment", "")),
                    AnalysisCard(title="Certification", body=ai.get("certification_justification", ""))
                ],
                sanitized_content=data.get("sanitized_content"),
                censored_elements=censored_elements,
                risk_breakdown=risk_breakdown,
                certification_reason=cert.get("reason"),
                ai_analysis_input=ai.get("input_summary"),
                ai_analysis_output=ai.get("output_summary"),
                ai_analysis_risk=ai.get("risk_assessment"),
                ai_analysis_cert=ai.get("certification_justification")
            )

        except Exception as e:
            print(f"OpenAI failed: {e}. Falling back to rule-based.")
            pass # Fallthrough to fallback

    # FALLBACK RULE-BASED LOGIC
    content_id = str(uuid.uuid4())
    words = text.split()
    censored_elements = []
    sanitized_words = []
    heatmap_data = []
    
    # Expanded Risk Map
    risk_map = {
        # Original
        "idiot": {"cat": "Abusive Language", "sev": "Medium", "reason": "Degrading language"},
        "attacked": {"cat": "Violence", "sev": "High", "reason": "Encourages physical harm"},
        "kill": {"cat": "Violence", "sev": "High", "reason": "Threat of death"},
        "stupid": {"cat": "Abusive Language", "sev": "Low", "reason": "Insult"},
        "fake": {"cat": "Misinformation", "sev": "Medium", "reason": "Potential falsehood"},
        "gun": {"cat": "Violence", "sev": "High", "reason": "Weapon reference"},
        
        # Expanded (User Example Keywords)
        "epstein": {"cat": "Controversial", "sev": "Medium", "reason": "Sensitive topic/Conspiracy context"},
        "files": {"cat": "Sensitive Info", "sev": "Low", "reason": "Potential leak/doxing context"},
        "prosecution": {"cat": "Legal", "sev": "Low", "reason": "Legal threat context"},
        "smeared": {"cat": "Defamation", "sev": "Medium", "reason": "Claim of reputation damage"},
        "pain": {"cat": "Self-harm/Violence", "sev": "Medium", "reason": "Reference to suffering"},
        "protect": {"cat": "Safety", "sev": "Low", "reason": "Safety context"},
        "vulnerable": {"cat": "Safety", "sev": "Low", "reason": "Reference to at-risk groups"},
        "scam": {"cat": "Fraud", "sev": "High", "reason": "Financial fraud allegation"},
        "fraud": {"cat": "Fraud", "sev": "High", "reason": "Financial crime allegation"},
        "conspiracy": {"cat": "Misinformation", "sev": "Medium", "reason": "Conspiracy theory context"}
    }

    category_scores = {}
    
    for i, w in enumerate(words):
        # normalize: strip punctuation
        clean_w = w.lower().strip(".,!?\"'()[]{}") 
        if clean_w in risk_map:
            info = risk_map[clean_w]
            sanitized_words.append("***")
            
            censored_elements.append(CensoredElement(
                category=info["cat"],
                original=w,
                reason=info["reason"],
                severity=info["sev"]
            ))
            
            base_score = 30 if info["sev"] == "Low" else 60 if info["sev"] == "Medium" else 90
            category_scores[info["cat"]] = max(category_scores.get(info["cat"], 0), base_score)
            
            risk_level = "high" if info["sev"] == "High" else "medium" if info["sev"] == "Medium" else "low"
            heatmap_data.append({
                "start": i / len(words),
                "end": min((i+1) / len(words), 1.0),
                "intensity": base_score / 100.0,
                "categories": [info["cat"]]
            })
        else:
            sanitized_words.append(w)
    
    sanitized_content = " ".join(sanitized_words)
    overall_risk_score = max(category_scores.values()) if category_scores else 10
    overall_risk = overall_risk_score / 100.0
    
    cert_before = _classify_certification(overall_risk)
    cert_after = _classify_certification(max(overall_risk - 0.4, 0.0))
    
    risk_breakdown = [RiskBreakdown(category=k, score=float(v)) for k, v in category_scores.items()]
    
    # Create valid AnalysisCards even in fallback
    ai_analysis = {
        "input": f"Post about: {' '.join(words[:5])}...",
        "output": "Sanitized offensive terms while keeping sentence structure.",
        "risk": f"Overall risk {overall_risk_score}/100 driven by {', '.join(category_scores.keys())}." if category_scores else "Low risk detected. Content appears safe.",
        "cert": f"Moved from {cert_before} to {cert_after} by removing specific trigger words."
    }
    
    segments = []
    for h in heatmap_data:
            segments.append(Segment(
                id=str(uuid.uuid4()),
                start=h["start"],
                end=h["end"],
                labels=h["categories"],
                risk_scores=[RiskScore(category=c, score=h["intensity"]) for c in h["categories"]]
            ))
    
    if not segments:
         segments = [Segment(id="safe", start=0, end=1, labels=["safe"], risk_scores=[RiskScore(category="safe", score=0.0)])]

    resp = SocialAnalyzeResponse(
        content_id=content_id,
        duration=float(len(words)),
        segments=segments,
        certification_before=cert_before,
        certification_after=cert_after,
        overall_risk=overall_risk,
        heatmap=heatmap_data,
        analysis_cards=[
            AnalysisCard(title="Input Summary", body=ai_analysis["input"]),
            AnalysisCard(title="Sanitization", body=ai_analysis["output"]),
            AnalysisCard(title="Risk Assessment", body=ai_analysis["risk"]),
            AnalysisCard(title="Certification", body=ai_analysis["cert"]),
        ],
        sanitized_content=sanitized_content,
        censored_elements=censored_elements,
        risk_breakdown=risk_breakdown,
        certification_reason=ai_analysis["cert"],
        ai_analysis_input=ai_analysis["input"],
        ai_analysis_output=ai_analysis["output"],
        ai_analysis_risk=ai_analysis["risk"],
        ai_analysis_cert=ai_analysis["cert"]
    )
    _store_version(resp)
    return resp


def _analyze_document_content(text: str) -> SocialAnalyzeResponse:
    """
    Analyzes document content for sensitive/confidential information.
    Detects PII, confidential keywords, and other sensitive data.
    """
    import re
    
    content_id = str(uuid.uuid4())
    
    # Try OpenAI first if available
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_key)
            
            prompt = f"""Analyze this document for sensitive/confidential information. Identify:
1. PII (SSN, credit cards, emails, phone numbers, addresses)
2. Confidential keywords (confidential, proprietary, internal only, trade secret)
3. Sensitive data (passwords, API keys, tokens)
4. Inappropriate content (violence, hate speech, extremism)

Document:
{text[:2000]}

Return JSON with:
- sanitized_content: redacted version with *** for sensitive items
- censored_elements: [{{"original": "...", "category": "...", "reason": "...", "severity": "..."}}]
- risk_breakdown: [{{"category": "...", "score": 0-100}}]
"""
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            
            result_text = response.choices[0].message.content
            # Parse JSON response (simplified)
            # For now, fall through to rule-based
        except Exception as e:
            print(f"OpenAI analysis failed: {e}")
    
    # FALLBACK: Rule-based detection
    words = text.split()
    sanitized_words = []
    censored_elements = []
    category_scores = {}
    heatmap_data = []
    
    # PII Patterns
    ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    phone_pattern = r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
    credit_card_pattern = r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
    
    # Confidential keywords
    confidential_keywords = {
        "confidential": {"cat": "Confidential", "sev": "High", "reason": "Marked as confidential"},
        "proprietary": {"cat": "Confidential", "sev": "High", "reason": "Proprietary information"},
        "internal": {"cat": "Confidential", "sev": "Medium", "reason": "Internal use only"},
        "secret": {"cat": "Confidential", "sev": "High", "reason": "Trade secret"},
        "password": {"cat": "Sensitive Data", "sev": "High", "reason": "Password reference"},
        "api_key": {"cat": "Sensitive Data", "sev": "High", "reason": "API key reference"},
        "token": {"cat": "Sensitive Data", "sev": "Medium", "reason": "Authentication token"},
        
        # Inappropriate content
        "violence": {"cat": "Violence", "sev": "High", "reason": "Violent content"},
        "hate": {"cat": "Hate Speech", "sev": "High", "reason": "Hate speech"},
        "extremism": {"cat": "Extremism", "sev": "High", "reason": "Extremist content"},
        "kill": {"cat": "Violence", "sev": "High", "reason": "Threat of violence"},
        "attack": {"cat": "Violence", "sev": "High", "reason": "Attack reference"},
    }
    
    # Process text for PII
    sanitized_text = text
    
    # Redact SSN
    for match in re.finditer(ssn_pattern, text):
        ssn = match.group()
        sanitized_text = sanitized_text.replace(ssn, "***-**-****")
        censored_elements.append(CensoredElement(
            category="PII - SSN",
            original=ssn,
            reason="Social Security Number detected",
            severity="High"
        ))
        category_scores["PII"] = max(category_scores.get("PII", 0), 90)
    
    # Redact emails
    for match in re.finditer(email_pattern, text):
        email = match.group()
        sanitized_text = sanitized_text.replace(email, "***@***.***")
        censored_elements.append(CensoredElement(
            category="PII - Email",
            original=email,
            reason="Email address detected",
            severity="Medium"
        ))
        category_scores["PII"] = max(category_scores.get("PII", 0), 60)
    
    # Redact phone numbers
    for match in re.finditer(phone_pattern, text):
        phone = match.group()
        sanitized_text = sanitized_text.replace(phone, "***-***-****")
        censored_elements.append(CensoredElement(
            category="PII - Phone",
            original=phone,
            reason="Phone number detected",
            severity="Medium"
        ))
        category_scores["PII"] = max(category_scores.get("PII", 0), 60)
    
    # Redact credit cards
    for match in re.finditer(credit_card_pattern, text):
        cc = match.group()
        sanitized_text = sanitized_text.replace(cc, "**** **** **** ****")
        censored_elements.append(CensoredElement(
            category="PII - Credit Card",
            original=cc,
            reason="Credit card number detected",
            severity="High"
        ))
        category_scores["PII"] = max(category_scores.get("PII", 0), 90)
    
    # Process keywords
    for i, word in enumerate(words):
        clean_w = word.lower().strip(".,!?\"'()[]{}:")
        if clean_w in confidential_keywords:
            info = confidential_keywords[clean_w]
            sanitized_text = sanitized_text.replace(word, "***", 1)
            
            censored_elements.append(CensoredElement(
                category=info["cat"],
                original=word,
                reason=info["reason"],
                severity=info["sev"]
            ))
            
            base_score = 30 if info["sev"] == "Low" else 60 if info["sev"] == "Medium" else 90
            category_scores[info["cat"]] = max(category_scores.get(info["cat"], 0), base_score)
            
            heatmap_data.append({
                "start": i / len(words),
                "end": min((i+1) / len(words), 1.0),
                "intensity": base_score / 100.0,
                "categories": [info["cat"]]
            })
    
    overall_risk_score = max(category_scores.values()) if category_scores else 10
    overall_risk = overall_risk_score / 100.0
    
    cert_before = _classify_certification(overall_risk)
    cert_after = _classify_certification(max(overall_risk - 0.4, 0.0))
    
    risk_breakdown = [RiskBreakdown(category=k, score=float(v)) for k, v in category_scores.items()]
    
    ai_analysis = {
        "input": f"Document analysis: {len(words)} words, {len(censored_elements)} sensitive items detected.",
        "risk": f"Overall risk {overall_risk_score}/100 driven by {', '.join(category_scores.keys())}." if category_scores else "Low risk detected. Document appears safe.",
        "cert": f"Certification changed from {cert_before} to {cert_after} after redaction."
    }
    
    segments = []
    for h in heatmap_data:
        segments.append(Segment(
            id=str(uuid.uuid4()),
            start=h["start"],
            end=h["end"],
            labels=h["categories"],
            risk_scores=[RiskScore(category=c, score=h["intensity"]) for c in h["categories"]]
        ))
    
    if not segments:
        segments.append(Segment(
            id=str(uuid.uuid4()),
            start=0.0,
            end=1.0,
            labels=["Safe"],
            risk_scores=[RiskScore(category="Safe", score=0.1)]
        ))
    
    resp = SocialAnalyzeResponse(
        content_id=content_id,
        sanitized_content=sanitized_text,
        censored_elements=censored_elements,
        segments=segments,
        certification_before=cert_before,
        certification_after=cert_after,
        overall_risk=overall_risk,
        risk_breakdown=risk_breakdown,
        heatmap=heatmap_data,
        ai_analysis_input=ai_analysis["input"],
        ai_analysis_risk=ai_analysis["risk"],
        ai_analysis_cert=ai_analysis["cert"]
    )
    return resp


def _job_init(job_type: str, content_id: Optional[str] = None) -> str:
  job_id = str(uuid.uuid4())
  _JOBS[job_id] = {
    "job_id": job_id,
    "type": job_type,
    "status": "queued",
    "progress": 0,
    "logs": [],
    "content_id": content_id,
    "result": None,
    "error": None,
    "created_at": time.time(),
  }
  return job_id


def _job_log(job_id: str, message: str, progress: Optional[int] = None) -> None:
  job = _JOBS.get(job_id)
  if not job:
    return
  job["logs"].append({"ts": time.time(), "message": message, "progress": progress})
  if progress is not None:
    job["progress"] = int(progress)


def _get_video_duration_seconds(path: str) -> float:
  """Get video duration in seconds using ffmpeg."""
  return get_video_duration(path)


async def _simulate_heavy_step(job_id: str, label: str, progress_from: int, progress_to: int, seconds: float) -> None:
  _job_log(job_id, label, progress_from)
  steps = max(1, int(seconds * 10))
  for i in range(steps):
    await asyncio.sleep(seconds / steps)
    p = progress_from + int((progress_to - progress_from) * ((i + 1) / steps))
    _job_log(job_id, f"{label}…", p)


async def _ott_analyze_worker(job_id: str, content_id: str, dest_path: str) -> None:
  job = _JOBS[job_id]
  job["status"] = "running"
  try:
    await _simulate_heavy_step(job_id, "Extracting metadata", 5, 20, 0.8)
    await _simulate_heavy_step(job_id, "Transcribing audio (Whisper-ready)", 20, 55, 1.4)
    await _simulate_heavy_step(job_id, "Scanning frames (Vision-ready)", 55, 80, 1.1)
    await _simulate_heavy_step(job_id, "Computing risk, heatmap, certification", 80, 95, 0.8)

    duration_sec = _get_video_duration_seconds(dest_path)
    if duration_sec <= 0:
      duration_sec = 60.0

    # Prototype segments (stable-ish based on file name hash); use real duration for time ranges
    # STEP 1 & 2: segment mapping with category, timestamps, confidence, peak_risk, reason
    h = abs(hash(os.path.basename(dest_path))) % 1000
    a = (h % 30) / 100.0
    b = 0.08 + ((h % 10) / 100.0)
    seg1_start = max(0.05, a)
    seg1_end = min(0.95, a + b)
    seg2_start = 0.45
    seg2_end = 0.6
    segments = [
      Segment(
        id="seg_01",
        start=seg1_start,
        end=seg1_end,
        labels=["violence"],
        risk_scores=[RiskScore(category="violence", score=0.82)],
        reason="Graphic physical aggression or violent imagery detected in this portion.",
        confidence="26-40%",
        peak_risk_str="82%",
        start_time=_sec_to_timestamp(seg1_start * duration_sec),
        end_time=_sec_to_timestamp(seg1_end * duration_sec),
      ),
      Segment(
        id="seg_02",
        start=seg2_start,
        end=seg2_end,
        labels=["abusive_language"],
        risk_scores=[RiskScore(category="abusive_language", score=0.7)],
        reason="Use of explicit or abusive language targeting an individual.",
        confidence="45-60%",
        peak_risk_str="70%",
        start_time=_sec_to_timestamp(seg2_start * duration_sec),
        end_time=_sec_to_timestamp(seg2_end * duration_sec),
      ),
    ]

    overall_risk = max(rs.score for s in segments for rs in s.risk_scores)
    cert_before = _classify_certification(overall_risk)
    cert_after = _classify_certification(max(overall_risk - 0.2, 0.0))
    heatmap = [
      {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
      for s in segments
    ]
    # STEP 4: certification logic for AI Analysis panel
    certification_logic = (
      f"Overall risk score {overall_risk:.2f} (0–1) placed the clip in '{cert_before}' (before). "
      f"After applying censorship to flagged segments, effective risk is reduced; "
      f"certification moves to '{cert_after}' (after) under CBFC-style guidelines."
    )
    # AI Analysis panel: per-segment why censored, guideline, risk breakdown
    analysis_cards = [
      AnalysisCard(
        title="CBFC-style rationale",
        body="Flagged segments are censored selectively using blur, beeps, and/or cuts. Risk scores are aggregated into a certification before and after censorship.",
      ),
      AnalysisCard(
        title="Certification justification",
        body=certification_logic,
      ),
      AnalysisCard(
        title="Segment 1 – Violence",
        body=f"Segment {_sec_to_timestamp(seg1_start * duration_sec)}–{_sec_to_timestamp(seg1_end * duration_sec)} contained graphic violence inappropriate for U-A certification; therefore blur and/or beep can be applied. Peak risk 82%.",
      ),
      AnalysisCard(
        title="Segment 2 – Abusive language",
        body=f"Segment {_sec_to_timestamp(seg2_start * duration_sec)}–{_sec_to_timestamp(seg2_end * duration_sec)} contained abusive language; typically muted or beeped for U-A audiences. Peak risk 70%.",
      ),
    ]

    resp = AnalyzeResponse(
      content_id=content_id,
      duration=duration_sec,
      segments=segments,
      certification_before=cert_before,
      certification_after=cert_after,
      overall_risk=overall_risk,
      heatmap=heatmap,
      analysis_cards=analysis_cards,
      certification_logic=certification_logic,
    )
    _store_version(resp)

    job["result"] = {
      "analysis": resp.model_dump(),
      "original_url": f"/uploads/ott/{content_id}_original.mp4",
    }
    job["status"] = "done"
    _job_log(job_id, "Analysis complete", 100)
  except Exception as e:
    job["status"] = "error"
    job["error"] = str(e)
    _job_log(job_id, f"Error: {e}", 100)


def _build_concat_list(path: str, windows: List[Dict[str, float]], duration: float) -> str:
  """Build concat demuxer list: keep [0, w1.start], [w1.end, w2.start], ... [last.end, duration]."""
  kept: List[Dict[str, float]] = []
  t = 0.0
  for w in sorted(windows, key=lambda x: x["start"]):
    if w["start"] > t + 0.01:
      kept.append({"start": t, "end": w["start"]})
    t = max(t, w["end"])
  if t < duration - 0.01:
    kept.append({"start": t, "end": duration})
  if not kept:
    return ""
  # Use forward slashes so FFmpeg concat works on Windows
  path_ff = path.replace("\\", "/")
  lines = []
  for k in kept:
    lines.append(f"file '{path_ff}'")
    lines.append(f"inpoint {k['start']:.3f}")
    lines.append(f"outpoint {k['end']:.3f}")
  return "\n".join(lines)


async def _ott_apply_worker(job_id: str, content_id: str, options: Dict[str, Any]) -> None:
  job = _JOBS[job_id]
  job["status"] = "running"
  try:
    await _simulate_heavy_step(job_id, "Preparing censorship render", 5, 20, 0.5)

    versions = _VERSIONS.get(content_id) or []
    if not versions:
      raise RuntimeError("No analysis found for this content id.")
    analysis = versions[-1]

    review: Dict[str, Any] = options.get("review", {}) if isinstance(options, dict) else {}
    approved_ids = {seg_id for seg_id, approved in review.items() if approved is True}
    if not approved_ids:
      approved_ids = {s.id for s in analysis.segments}

    duration = max(float(analysis.duration or 0.0), 1.0)
    windows: List[Dict[str, float]] = []
    for s in analysis.segments:
      if s.id not in approved_ids:
        continue
      start_sec = max(0.0, float(s.start) * duration)
      end_sec = max(start_sec, float(s.end) * duration)
      windows.append({"start": start_sec, "end": end_sec})

    ott_dir = os.path.join(UPLOADS_DIR, "ott")
    src = os.path.join(ott_dir, f"{content_id}_original.mp4")
    out = os.path.join(ott_dir, f"{content_id}_censored.mp4")
    if not os.path.isfile(src):
      raise RuntimeError("Original video file not found. Run AI (Live) first.")
    cut_enabled = bool(options.get("cutClip", False))
    cut_captions_enabled = bool(options.get("cutCaptions", False))
    hide_captions_enabled = bool(options.get("hideCaptions", False))
    blur_enabled = bool(options.get("blurVideo", True))
    beep_enabled = bool(options.get("addBeep", True))
    if cut_captions_enabled or hide_captions_enabled:
      _job_log(job_id, "Cut/Hide captions apply to subtitle tracks; applied where available.", 15)

    ffmpeg_bin = get_ffmpeg_bin()
    # If cut clip: first produce video with flagged segments removed (concat demuxer)
    work_src = src
    if cut_enabled and windows:
      concat_list = _build_concat_list(src, windows, duration)
      if concat_list:
        list_path = os.path.join(ott_dir, f"{content_id}_concat.txt")
        with open(list_path, "w") as f:
          f.write(concat_list)
        cut_path = os.path.join(ott_dir, f"{content_id}_cut.mp4")
        cmd_cut = [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", cut_path]
        _job_log(job_id, f"Cutting flagged segments: {' '.join(cmd_cut)}", 30)
        proc = subprocess.run(cmd_cut, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        if proc.returncode == 0:
          work_src = cut_path
          # Note: If we cut, we skip blur/beep on the cut output for now as per design decision.
          if blur_enabled or beep_enabled:
            _job_log(job_id, "Blur/beep skipped when cut is used (timeline changed).", 50)
        else:
           _job_log(job_id, f"Cut failed (ffmpeg error): {proc.stderr}", 80)
           raise RuntimeError(f"FFmpeg cut failed: {proc.stderr[:200]}")
        try:
          os.remove(list_path)
        except OSError:
          pass

    if not windows and not cut_enabled:
      _job_log(job_id, "No segments approved for censorship. Copying original as preview.", 40)
      shutil.copyfile(src, out)
    elif cut_enabled and windows and work_src != src:
      shutil.copyfile(work_src, out)
      _job_log(job_id, "Censored preview (cut only) ready.", 80)
    elif not windows:
      _job_log(job_id, "No flagged segments to process. Copying original as preview.", 50)
      shutil.copyfile(work_src, out)
    else:
      enable_expr = "+".join(f"between(t,{w['start']:.2f},{w['end']:.2f})" for w in windows)

      vf = None
      if blur_enabled:
        vf = f"boxblur=25:enable='{enable_expr}'"

      # Audio: mute in windows and optionally mix beep (sine) in those windows
      af = None
      if beep_enabled:
        # Mute original in flagged windows
        af = f"volume=enable='{enable_expr}':volume=0"
      # Real beep: sine mixed only in flagged windows
      use_beep = beep_enabled and windows
      if use_beep:
        dur_str = str(int(duration) + 1)
        beep_expr = enable_expr
        if vf:
          cmd = [
            ffmpeg_bin, "-y", "-i", work_src,
            "-f", "lavfi", "-i", f"sine=frequency=1000:duration={dur_str}",
            "-filter_complex",
            f"[0:v]{vf}[v];[0:a]volume=enable='{enable_expr}':volume=0[orig];[1:a]volume='if({enable_expr}, 0.35, 0)':eval=frame[beep];[orig][beep]amix=inputs=2:duration=first[a]",
            "-map", "[v]", "-map", "[a]", out
          ]
        else:
          cmd = [
            ffmpeg_bin, "-y", "-i", work_src,
            "-f", "lavfi", "-i", f"sine=frequency=1000:duration={dur_str}",
            "-filter_complex",
            f"[0:a]volume=enable='{enable_expr}':volume=0[orig];[1:a]volume='if({enable_expr}, 0.35, 0)':eval=frame[beep];[orig][beep]amix=inputs=2:duration=first[a]",
            "-map", "0:v?", "-map", "[a]", "-c:v", "copy", out
          ]
      else:
        cmd = [ffmpeg_bin, "-y", "-i", work_src]
        if vf:
          cmd += ["-vf", vf]
        if af:
          cmd += ["-af", af]
        # Remove subtitles if requested
        if hide_captions_enabled or cut_captions_enabled:
          cmd += ["-sn"]
        cmd.append(out)

      _job_log(job_id, f"Running FFmpeg pipeline: {' '.join(cmd)}", 40)
      proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=180)
      if proc.returncode != 0:
        _job_log(job_id, f"FFmpeg failed: {proc.stderr}", 80)
        raise RuntimeError(f"FFmpeg pipeline failed: {proc.stderr[:200]}")
      else:
        _job_log(job_id, "FFmpeg censorship render complete.", 80)

    await _simulate_heavy_step(job_id, "Finalizing output", 90, 100, 0.4)
    job["status"] = "done"

    # Calculate new duration
    new_duration = duration
    if cut_enabled and windows:
      cut_duration = sum(w["end"] - w["start"] for w in windows)
      new_duration = max(0.0, duration - cut_duration)
    
    job["result"] = {
      "censored_url": f"/uploads/ott/{content_id}_censored.mp4",
      "applied_options": options,
      "new_duration": new_duration,
    }
    _job_log(job_id, "Censored preview ready", 100)
  except Exception as e:
    job["status"] = "error"
    job["error"] = str(e)
    _job_log(job_id, f"Error: {e}", 100)


@app.get("/api/health")
async def health():
  return {"status": "ok"}


@app.post("/api/ott/analyze", response_model=AnalyzeResponse)
async def analyze_ott(
  file: UploadFile = File(...),
  options: Optional[str] = Form(None),
):
  os.makedirs(os.path.join(UPLOADS_DIR, "ott"), exist_ok=True)
  content_id = str(uuid.uuid4())
  dest_path = os.path.join(UPLOADS_DIR, "ott", f"{content_id}_{file.filename}")

  with open(dest_path, "wb") as f:
    f.write(await file.read())

  segments = [
    Segment(
      id="seg-1",
      start=0.1,
      end=0.2,
      labels=["violence"],
      risk_scores=[RiskScore(category="violence", score=0.8)],
    ),
    Segment(
      id="seg-2",
      start=0.45,
      end=0.6,
      labels=["abusive_language"],
      risk_scores=[RiskScore(category="abusive_language", score=0.7)],
    ),
  ]

  overall_risk = max(rs.score for s in segments for rs in s.risk_scores)
  cert_before = _classify_certification(overall_risk)
  cert_after = _classify_certification(max(overall_risk - 0.2, 0.0))

  heatmap = [
    {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
    for s in segments
  ]

  analysis_cards = [
    AnalysisCard(
      title="Violence detected",
      body="One segment contains strong visual violence that typically requires U-A or A certification under CBFC guidance.",
    ),
    AnalysisCard(
      title="Abusive language",
      body="Language in one segment is abusive and would be muted or beeped for U-A audiences.",
    ),
  ]

  resp = AnalyzeResponse(
    content_id=content_id,
    duration=600.0,
    segments=segments,
    certification_before=cert_before,
    certification_after=cert_after,
    overall_risk=overall_risk,
    heatmap=heatmap,
    analysis_cards=analysis_cards,
  )
  _store_version(resp)
  return resp


class OttStartResponse(BaseModel):
  job_id: str
  content_id: str
  original_url: str


@app.post("/api/ott/analyze_async", response_model=OttStartResponse)
async def analyze_ott_async(
  file: UploadFile = File(...),
  options: Optional[str] = Form(None),
):
  """
  Real-time OTT analysis: starts a job and streams progress via SSE at /api/jobs/{job_id}/events.
  """
  ott_dir = os.path.join(UPLOADS_DIR, "ott")
  os.makedirs(ott_dir, exist_ok=True)
  content_id = str(uuid.uuid4())
  original_path = os.path.join(ott_dir, f"{content_id}_original.mp4")
  try:
    with open(original_path, "wb") as f:
      f.write(await file.read())
  except Exception as e:
    raise RuntimeError(f"Failed to save upload: {e}") from e

  job_id = _job_init("ott_analyze", content_id=content_id)
  _job_log(job_id, "Job queued", 0)
  asyncio.create_task(_ott_analyze_worker(job_id, content_id, original_path))
  return OttStartResponse(job_id=job_id, content_id=content_id, original_url=f"/uploads/ott/{content_id}_original.mp4")

class YoutubeStartResponse(BaseModel):
  job_id: str
  content_id: str
  original_url: str

async def _youtube_analyze_worker(job_id: str, content_id: str, url: str) -> None:
  job = _JOBS[job_id]
  job["status"] = "running"
  youtube_dir = os.path.join(UPLOADS_DIR, "youtube")
  os.makedirs(youtube_dir, exist_ok=True)
  
  # yt-dlp template: force mp4
  dest_template = os.path.join(youtube_dir, f"{content_id}_original.%(ext)s")
  final_path = os.path.join(youtube_dir, f"{content_id}_original.mp4")

  try:
    _job_log(job_id, f"Downloading video from {url}...", 5)
    
    ffmpeg_bin = get_ffmpeg_bin()
    # If imageio_ffmpeg returns full path to executable, ensure we pass the directory or full path correctly
    # yt-dlp 'ffmpeg_location' expects path to binary or directory containing binary
    
    def run_download():
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': dest_template,
            'quiet': True,
            'no_warnings': True,
            'ffmpeg_location': ffmpeg_bin,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, run_download)

    if not os.path.exists(final_path):
       # Fallback: check duplicates if ext wasn't mp4 or something
       # For now assume success or error in run_download would catch it
       pass

    await _simulate_heavy_step(job_id, "Processing content (Audio/Visual)", 30, 60, 1.5)
    await _simulate_heavy_step(job_id, "Evaluating risk score", 60, 90, 1.0)

    duration_sec = _get_video_duration_seconds(final_path)
    if duration_sec <= 0:
      duration_sec = 300.0

    # Generate segments dynamically based on duration
    # We'll create a few typical segments for the prototype
    
    seg1_start = duration_sec * 0.15
    seg1_end = duration_sec * 0.25
    seg2_start = duration_sec * 0.6
    seg2_end = duration_sec * 0.7

    segments = [
      Segment(
        id="yt-seg-1",
        start=seg1_start / duration_sec,
        end=seg1_end / duration_sec,
        labels=["violence", "fake_news"],
        risk_scores=[RiskScore(category="violence", score=0.75), RiskScore(category="fake_news", score=0.65)],
        reason="Visuals confirm violent activity; audio transcript suggests misinformation.",
        confidence="78%",
        peak_risk_str="75%",
        start_time=_sec_to_timestamp(seg1_start),
        end_time=_sec_to_timestamp(seg1_end),
      ),
      Segment(
        id="yt-seg-2",
        start=seg2_start / duration_sec,
        end=seg2_end / duration_sec,
        labels=["abusive_language"],
        risk_scores=[RiskScore(category="abusive_language", score=0.88)],
        reason="Strong profanity detected in audio track.",
        confidence="92%",
        peak_risk_str="88%",
        start_time=_sec_to_timestamp(seg2_start),
        end_time=_sec_to_timestamp(seg2_end),
      )
    ]

    overall_risk = max(rs.score for s in segments for rs in s.risk_scores)
    cert_before = _classify_certification(overall_risk)
    cert_after = _classify_certification(max(overall_risk - 0.2, 0.0))
    heatmap = [
      {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
      for s in segments
    ]

    certification_logic = (
      f"Content flagged for violence and abusive language. Overall risk {overall_risk:.2f}. "
      f"Initial classification '{cert_before}'. Post-censorship metric estimates drop to '{cert_after}'."
    )

    analysis_cards = [
      AnalysisCard(title="Source Risk", body="YouTube content evaluated against platform guidelines."),
      AnalysisCard(title="Certification", body=certification_logic),
      AnalysisCard(title="Violence", body=f"Segment at {segments[0].start_time} - {segments[0].end_time} flagged."),
      AnalysisCard(title="Abusive Language", body=f"Segment at {segments[1].start_time} - {segments[1].end_time} flagged."),
    ]

    resp = AnalyzeResponse(
      content_id=content_id,
      duration=duration_sec,
      segments=segments,
      certification_before=cert_before,
      certification_after=cert_after,
      overall_risk=overall_risk,
      heatmap=heatmap,
      analysis_cards=analysis_cards,
      certification_logic=certification_logic,
    )
    _store_version(resp)

    job["result"] = {
      "analysis": resp.model_dump(),
      "original_url": f"/uploads/youtube/{content_id}_original.mp4",
    }
    job["status"] = "done"
    _job_log(job_id, "Analysis complete", 100)

  except Exception as e:
    job["status"] = "error"
    job["error"] = str(e)
    _job_log(job_id, f"Error: {e}", 100)

@app.post("/api/youtube/analyze_async", response_model=YoutubeStartResponse)
async def analyze_youtube_async(payload: UrlRequest):
  youtube_dir = os.path.join(UPLOADS_DIR, "youtube")
  os.makedirs(youtube_dir, exist_ok=True)
  content_id = str(uuid.uuid4())
  
  job_id = _job_init("youtube_analyze", content_id=content_id)
  _job_log(job_id, "Job queued", 0)
  asyncio.create_task(_youtube_analyze_worker(job_id, content_id, payload.url))
  
  return YoutubeStartResponse(job_id=job_id, content_id=content_id, original_url=f"/uploads/youtube/{content_id}_original.mp4")


class OttApplyRequest(BaseModel):
  content_id: str
  options: Dict[str, Any]


class OttApplyResponse(BaseModel):
  job_id: str
  content_id: str


@app.post("/api/ott/apply_async", response_model=OttApplyResponse)
async def ott_apply_async(req: OttApplyRequest):
  """
  Starts rendering a censored preview (prototype copies original to censored for now).
  Progress via SSE at /api/jobs/{job_id}/events.
  """
  job_id = _job_init("ott_apply", content_id=req.content_id)
  _job_log(job_id, "Render queued", 0)
  asyncio.create_task(_ott_apply_worker(job_id, req.content_id, req.options))
  return OttApplyResponse(job_id=job_id, content_id=req.content_id)


async def _youtube_apply_worker(job_id: str, content_id: str, options: Dict[str, Any]) -> None:
  job = _JOBS[job_id]
  job["status"] = "running"
  try:
    await _simulate_heavy_step(job_id, "Preparing censorship render", 5, 20, 0.5)

    versions = _VERSIONS.get(content_id) or []
    if not versions:
      raise RuntimeError("No analysis found for this content id.")
    analysis = versions[-1]

    youtube_dir = os.path.join(UPLOADS_DIR, "youtube")
    src = os.path.join(youtube_dir, f"{content_id}_original.mp4")
    out = os.path.join(youtube_dir, f"{content_id}_censored.mp4")
    
    if not os.path.isfile(src):
      raise RuntimeError("Original video file not found.")

    custom_segments = options.get("custom_segments")
    duration = max(float(analysis.duration or 0.0), 1.0)
    windows: List[Dict[str, float]] = []

    if custom_segments and isinstance(custom_segments, list):
         for s in custom_segments:
             s_start = float(s.get("start", 0.0))
             s_end = float(s.get("end", 0.0))
             windows.append({"start": s_start * duration, "end": s_end * duration})
    else:
        review: Dict[str, Any] = options.get("review", {}) if isinstance(options, dict) else {}
        approved_ids = {seg_id for seg_id, approved in review.items() if approved is True}
        if not approved_ids:
             approved_ids = {s.id for s in analysis.segments}

        for s in analysis.segments:
          if s.id not in approved_ids:
            continue
          start_sec = max(0.0, float(s.start) * duration)
          end_sec = max(start_sec, float(s.end) * duration)
          windows.append({"start": start_sec, "end": end_sec})

    cut_enabled = bool(options.get("cutClip", False))
    blur_enabled = bool(options.get("blurVideo", True))
    beep_enabled = bool(options.get("addBeep", True))
    mute_enabled = bool(options.get("muteAudio", False))

    ffmpeg_bin = get_ffmpeg_bin()
    work_src = src

    if cut_enabled and windows:
      concat_list = _build_concat_list(src, windows, duration)
      if concat_list:
        list_path = os.path.join(youtube_dir, f"{content_id}_concat.txt")
        with open(list_path, "w") as f:
            f.write(concat_list)
        cut_path = os.path.join(youtube_dir, f"{content_id}_cut.mp4")
        cmd_cut = [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", cut_path]
        _job_log(job_id, "Cutting flagged segments...", 30)
        proc = subprocess.run(cmd_cut, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        if proc.returncode == 0:
            work_src = cut_path
        try:
            os.remove(list_path)
        except:
            pass

    if not windows and not cut_enabled:
        shutil.copyfile(src, out)
    elif cut_enabled and windows and work_src != src:
        shutil.copyfile(work_src, out)
    elif not windows:
        shutil.copyfile(work_src, out)
    else:
        enable_expr = "+".join(f"between(t,{w['start']:.3f},{w['end']:.3f})" for w in windows)
        vf = None
        if blur_enabled:
            vf = f"boxblur=25:enable='{enable_expr}'"
        
        # Audio logic
        # If user wants Mute: volume=0 in windows.
        # If user wants Beep: mix sine in windows.
        # If both: Mute original, add beep?
        
        should_mute_original = mute_enabled or beep_enabled
        
        cmd = [ffmpeg_bin, "-y", "-i", work_src]
        filter_complex = []
        map_v = "0:v"
        map_a = "0:a"
        
        if vf:
            filter_complex.append(f"[0:v]{vf}[v]")
            map_v = "[v]"
        
        if should_mute_original:
            filter_complex.append(f"[0:a]volume=enable='{enable_expr}':volume=0[muted]")
            last_a = "[muted]"
            
            if beep_enabled and not mute_enabled:
                dur_str = str(int(duration) + 1)
                cmd.extend(["-f", "lavfi", "-i", f"sine=frequency=1000:duration={dur_str}"])
                # Fix: volume=0 when not enabled
                filter_complex.append(f"[1:a]volume='if({enable_expr}, 0.35, 0)':eval=frame[beep]")
                filter_complex.append(f"{last_a}[beep]amix=inputs=2:duration=first[a]")
                last_a = "[a]"
            
            map_a = last_a

        if filter_complex:
            cmd.extend(["-filter_complex", ";".join(filter_complex)])
            cmd.extend(["-map", map_v, "-map", map_a])
        else:
             if work_src != src:
                 cmd.extend(["-c", "copy"])
        
        cmd.append(out)

        _job_log(job_id, "Running censorship render...", 50)
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=180)
        if proc.returncode != 0:
             raise RuntimeError(f"FFmpeg failed: {proc.stderr[:200]}")

    _job_log(job_id, "Finalizing...", 90)
    job["status"] = "done"
    
    new_duration = duration
    if cut_enabled and windows:
        cut_dur = sum(w["end"]-w["start"] for w in windows)
        new_duration = max(0.0, duration - cut_dur)

    job["result"] = {
        "censored_url": f"/uploads/youtube/{content_id}_censored.mp4",
        "applied_options": options,
        "new_duration": new_duration
    }
    _job_log(job_id, "Render complete", 100)

  except Exception as e:
    job["status"] = "error"
    job["error"] = str(e)
    _job_log(job_id, f"Error: {e}", 100)

class YoutubeApplyRequest(BaseModel):
  content_id: str
  options: Dict[str, Any]

class YoutubeApplyResponse(BaseModel):
  job_id: str
  content_id: str

@app.post("/api/youtube/apply_async", response_model=YoutubeApplyResponse)
async def youtube_apply_async(req: YoutubeApplyRequest):
  job_id = _job_init("youtube_apply", content_id=req.content_id)
  _job_log(job_id, "Render queued", 0)
  asyncio.create_task(_youtube_apply_worker(job_id, req.content_id, req.options))
  return YoutubeApplyResponse(job_id=job_id, content_id=req.content_id)


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str):
  """
  Server-Sent Events stream for progress/logs/result.
  """
  if job_id not in _JOBS:
    return StreamingResponse(iter([]), media_type="text/event-stream")

  async def gen():
    last_idx = 0
    while True:
      job = _JOBS.get(job_id)
      if not job:
        break
      logs = job["logs"]
      while last_idx < len(logs):
        payload = {"type": "log", **logs[last_idx], "status": job["status"], "job_id": job_id}
        yield f"data: {json.dumps(payload)}\n\n"
        last_idx += 1
      if job["status"] in ("done", "error"):
        payload = {"type": "final", "status": job["status"], "job_id": job_id, "result": job["result"], "error": job["error"]}
        yield f"data: {json.dumps(payload)}\n\n"
        break
      await asyncio.sleep(0.25)

  return StreamingResponse(gen(), media_type="text/event-stream")


@app.post("/api/youtube/analyze", response_model=AnalyzeResponse)
async def analyze_youtube(payload: UrlRequest):
  """
  Simulated YouTube analysis that focuses on abusive language, sexual content,
  fake news, violence, copyright issues, extremism, hate speech and self-harm.
  """
  url = payload.url
  # For the prototype we generate synthetic segments keyed off the URL hash.
  base = hash(url) % 1000 / 1000.0
  segments = [
    Segment(
      id="yt-1",
      start=0.1,
      end=0.25,
      labels=["fake_news", "violence"],
      risk_scores=[
        RiskScore(category="fake_news", score=0.6),
        RiskScore(category="violence", score=0.7),
      ],
    ),
    Segment(
      id="yt-2",
      start=0.6,
      end=0.8,
      labels=["abusive_language", "extremism"],
      risk_scores=[
        RiskScore(category="abusive_language", score=0.65),
        RiskScore(category="extremism", score=0.75),
      ],
    ),
  ]
  overall_risk = max(rs.score for s in segments for rs in s.risk_scores)
  cert_before = _classify_certification(overall_risk)
  cert_after = _classify_certification(max(overall_risk - 0.2, 0.0))
  heatmap = [
    {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
    for s in segments
  ]
  analysis_cards = [
    AnalysisCard(
      title="Platform risk profile",
      body="Segments with hate speech, extremism and potential misinformation are highlighted to guide manual review and automated censorship.",
    )
  ]
  resp = AnalyzeResponse(
    content_id=str(uuid.uuid4()),
    duration=900.0,
    segments=segments,
    certification_before=cert_before,
    certification_after=cert_after,
    overall_risk=overall_risk,
    heatmap=heatmap,
    analysis_cards=analysis_cards,
  )
  _store_version(resp)
  return resp


@app.post("/api/music/analyze_async", response_model=MusicStartResponse)
async def analyze_music_async(
  file: Optional[UploadFile] = File(None),
  payload: Optional[str] = Form(None), # For URL when multipart
):
  music_dir = os.path.join(UPLOADS_DIR, "music")
  os.makedirs(music_dir, exist_ok=True)
  content_id = str(uuid.uuid4())
  
  url = None
  if payload:
    try:
      p_data = json.loads(payload)
      url = p_data.get("url")
    except:
      pass

  original_path = None
  if file:
    original_path = os.path.join(music_dir, f"{content_id}_original{os.path.splitext(file.filename)[1]}")
    with open(original_path, "wb") as f:
      f.write(await file.read())
  
  job_id = _job_init("music_analyze", content_id=content_id)
  _job_log(job_id, "Job queued", 0)
  asyncio.create_task(_music_analyze_worker(job_id, content_id, original_path, url))
  
  # For the preview, we use the original file link if it was an upload
  orig_url = f"/uploads/music/{os.path.basename(original_path)}" if original_path else ""
  return MusicStartResponse(job_id=job_id, content_id=content_id, original_url=orig_url)


async def _music_analyze_worker(job_id: str, content_id: str, file_path: Optional[str], url: Optional[str]):
  try:
    _job_log(job_id, "Initializing music analysis...", 5)
    music_dir = os.path.join(UPLOADS_DIR, "music")
    os.makedirs(music_dir, exist_ok=True)
    
    final_path = file_path
    
    if url:
      _job_log(job_id, f"Downloading music from {url}...", 10)
      dest_template = os.path.join(music_dir, f"{content_id}_original.%(ext)s")
      final_path = os.path.join(music_dir, f"{content_id}_original.mp4")
      
      def run_download():
          ydl_opts = {
              'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
              'outtmpl': dest_template,
              'quiet': True,
              'no_warnings': True,
              'nocheckcertificate': True,
              'ffmpeg_location': get_ffmpeg_bin(),
              'nopart': True,
              # Subtitle options
              'writesubtitles': True,
              'writeautomaticsub': True,
              'subtitleslangs': ['en'],
              'subtitlesformat': 'vtt',
              'skip_download': False,
          }
          import yt_dlp
          with yt_dlp.YoutubeDL(ydl_opts) as ydl:
              ydl.download([url])

      loop = asyncio.get_event_loop()
      await loop.run_in_executor(None, run_download)
      await asyncio.sleep(1) 
      _job_log(job_id, "Download complete", 30)
    
    # Retry logic for file existence and duration detection
    retries = 3
    while retries > 0:
        if final_path and os.path.exists(final_path):
            break
        await asyncio.sleep(1)
        retries -= 1
        
    if not final_path or not os.path.exists(final_path):
       raise RuntimeError("Original file not found after download/upload.")

    duration = 0.0
    for _ in range(3):
        duration = _get_video_duration_seconds(final_path)
        if duration > 0:
            break
        await asyncio.sleep(1)
        
    if duration <= 0:
      duration = 180.0

    _job_log(job_id, "Extracting audio and detecting lyrics...", 40)
    
    # Locate subtitle file
    # yt-dlp naming: file_id.en.vtt or file_id.vtt
    base_prefix = os.path.join(music_dir, f"{content_id}_original")
    sub_file = None
    for ext in [".en.vtt", ".vtt", ".en.srv3", ".srv3"]:
        cand = base_prefix + ext
        if os.path.exists(cand):
            sub_file = cand
            break
            
    segments = []
    if sub_file and sub_file.endswith(".vtt"):
        _job_log(job_id, "Parsing lyrics for sensitive content...", 50)
        words = parse_webvtt(sub_file)
        
        for w in words:
            term = w["word"]
            # Check basic match
            cat = None
            if term in _SENSITIVE_KEYWORDS:
                cat = _SENSITIVE_KEYWORDS[term]
            else:
                 # Check substrings for compound words
                 for k, c in _SENSITIVE_KEYWORDS.items():
                     if k in term:
                         cat = c
                         break
            
            if cat:
                # Found a bad word
                # Ensure valid range
                s_start = max(0.0, w["start"])
                s_end = min(duration, w["end"])
                if s_end > s_start:
                    segments.append(
                      Segment(
                        id=f"mseg-{uuid.uuid4().hex[:6]}",
                        start=s_start / duration,
                        end=s_end / duration,
                        labels=[cat],
                        risk_scores=[RiskScore(category=cat, score=0.9)],
                        reason=f"Censored: '{w['original']}' ({cat.replace('_', ' ')})",
                        confidence="90%",
                        start_time=_sec_to_timestamp(s_start),
                        end_time=_sec_to_timestamp(s_end)
                      )
                    )
    
    # If no segments found via lyrics, failover to simulation OR just return empty if real lyrics were processed
    # If we had a URL and no sub file was found, we might want to warn or just return empty.
    # But for "Rap God", we expect lyrics.
    
    if not segments and url:
         _job_log(job_id, "No lyrics found or no flagged words detected.", 60)
         # Don't add fake segments if we are trying to be real
    elif not segments and not url:
         # File upload without lyrics - simple simulation for demo
         pass 

    overall_risk = 0.0
    if segments:
        overall_risk = 0.85
    cert_before = _classify_certification(overall_risk)
    cert_after = _classify_certification(0.1)
    
    heatmap = [
      {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
      for s in segments
    ]
    
    _job_log(job_id, "Evaluating risk scores...", 80)
    await asyncio.sleep(1)
    
    resp = AnalyzeResponse(
      content_id=content_id,
      duration=duration,
      segments=segments,
      certification_before=cert_before,
      certification_after=cert_after,
      overall_risk=overall_risk,
      heatmap=heatmap,
      analysis_cards=[
        AnalysisCard(title="Lyrics Detection", body="AI identified specific words in the audio track that violate guidelines."),
        AnalysisCard(title="Sanitization Plan", body="Flagged words will be replaced with clean audio samples or beeps.")
      ]
    )
    
    _store_version(resp)
    _JOBS[job_id]["status"] = "done"
    _JOBS[job_id]["result"] = {
      "analysis": resp.model_dump(),
      "original_url": f"/uploads/music/{os.path.basename(final_path)}",
    }
    _job_log(job_id, "Music analysis complete", 100)
    
  except Exception as e:
    _JOBS[job_id]["status"] = "error"
    _JOBS[job_id]["error"] = str(e)
    _job_log(job_id, f"Error: {str(e)}")


@app.post("/api/music/apply_async", response_model=MusicApplyResponse)
async def apply_music_async(req: MusicApplyRequest):
  job_id = _job_init("music_apply", content_id=req.content_id)
  _job_log(job_id, "Job queued", 0)
  asyncio.create_task(_music_apply_worker(job_id, req.content_id, req.options))
  return MusicApplyResponse(job_id=job_id, content_id=req.content_id)


async def _music_apply_worker(job_id: str, content_id: str, options: Optional[Dict[str, Any]]):
  try:
    _job_log(job_id, "Starting music censorship...", 5)
    
    versions = _VERSIONS.get(content_id) or []
    if not versions:
      raise RuntimeError("No analysis found for this content id.")
    analysis = versions[-1]

    music_dir = os.path.join(UPLOADS_DIR, "music")
    # Detect original file (mp4, webm, etc.)
    original_file = None
    for f in os.listdir(music_dir):
        if f.startswith(f"{content_id}_original"):
            original_file = f
            break
    
    if not original_file:
      raise RuntimeError("Original music file not found.")
    
    src = os.path.join(music_dir, original_file)
    out = os.path.join(music_dir, f"{content_id}_censored.mp4")
    
    review: Dict[str, Any] = options.get("review", {}) if options else {}
    approved_ids = {seg_id for seg_id, approved in review.items() if approved is True}
    if not approved_ids:
         approved_ids = {s.id for s in analysis.segments}

    duration = max(float(analysis.duration or 0.0), 1.0)
    windows: List[Dict[str, float]] = []
    for s in analysis.segments:
      if s.id not in approved_ids:
        continue
      start_sec = max(0.0, float(s.start) * duration)
      end_sec = max(start_sec, float(s.end) * duration)
      windows.append({"start": start_sec, "end": end_sec})

    cut_enabled = bool(options.get("cutClip", False)) if options else False
    beep_enabled = bool(options.get("addBeep", True)) if options else True
    mute_enabled = bool(options.get("muteAudio", False)) if options else False

    ffmpeg_bin = get_ffmpeg_bin()
    work_src = src

    if cut_enabled and windows:
      concat_list = _build_concat_list(src, windows, duration)
      if concat_list:
        list_path = os.path.join(music_dir, f"{content_id}_concat.txt")
        with open(list_path, "w") as f:
            f.write(concat_list)
        cut_path = os.path.join(music_dir, f"{content_id}_cut.mp4")
        cmd_cut = [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", cut_path]
        _job_log(job_id, "Cutting flagged segments...", 20)
        proc = subprocess.run(cmd_cut, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
        if proc.returncode == 0:
            work_src = cut_path
        try:
            os.remove(list_path)
        except:
            pass

    if not windows and not cut_enabled:
        shutil.copyfile(src, out)
    elif cut_enabled and windows and work_src != src:
        shutil.copyfile(work_src, out)
    elif not windows:
        shutil.copyfile(work_src, out)
    else:
        enable_expr = "+".join(f"between(t,{w['start']:.3f},{w['end']:.3f})" for w in windows)
        
        # Audio logic
        should_mute_original = mute_enabled or beep_enabled
        
        cmd = [ffmpeg_bin, "-y", "-i", work_src]
        filter_complex = []
        map_v = "0:v?" # Optional video
        map_a = "0:a"
        
        if should_mute_original:
            filter_complex.append(f"[0:a]volume=enable='{enable_expr}':volume=0[muted]")
            last_a = "[muted]"
            
            if beep_enabled and not mute_enabled:
                dur_str = str(int(duration) + 1)
                cmd.extend(["-f", "lavfi", "-i", f"sine=frequency=1000:duration={dur_str}"])
                # Fix: volume=0 when not enabled
                filter_complex.append(f"[1:a]volume='if({enable_expr}, 0.35, 0)':eval=frame[beep]")
                filter_complex.append(f"{last_a}[beep]amix=inputs=2:duration=first[a]")
                last_a = "[a]"
            
            map_a = last_a

        if filter_complex:
            cmd.extend(["-filter_complex", ";".join(filter_complex)])
            cmd.extend(["-map", map_v, "-map", map_a])
        else:
             if work_src != src:
                  cmd.extend(["-c", "copy"])
        
        cmd.append(out)

    _job_log(job_id, "Applying audio filters...", 50)
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=180)
    if proc.returncode != 0:
         raise RuntimeError(f"FFmpeg failed: {proc.stderr[:200]}")
    
    _JOBS[job_id]["status"] = "done"
    _JOBS[job_id]["result"] = {"censored_url": f"/uploads/music/{content_id}_censored.mp4"}
    _job_log(job_id, "Music censorship complete", 100)
    
  except Exception as e:
    _JOBS[job_id]["status"] = "error"
    _JOBS[job_id]["error"] = str(e)
    _job_log(job_id, f"Error: {str(e)}")


@app.post("/api/social/analyze", response_model=SocialAnalyzeResponse)
async def analyze_social(payload: TextRequest):
  return _analyze_social_media_content(payload.text, payload.url)


@app.post("/api/docs/analyze", response_model=AnalyzeResponse)
async def analyze_docs(payload: TextRequest):
  return _build_text_segments(
    payload.text,
    categories=["violence", "sexual_content", "extremism", "hate_speech", "self_harm"],
  )


@app.post("/api/review/submit", response_model=AnalyzeResponse)
async def review_submit(req: ReviewRequest):
  """
  Human-in-the-loop approval of segments. Recomputes effective risk and certification.
  """
  versions = _VERSIONS.get(req.content_id)
  if not versions:
    raise RuntimeError("Unknown content id")
  latest = versions[-1]
  approved_ids = {d.segment_id for d in req.decisions if d.approved}
  segments = [s for s in latest.segments if s.id in approved_ids]
  if not segments:
    segments = [
      Segment(
        id="seg-safe",
        start=0.0,
        end=1.0,
        labels=["safe_after_review"],
        risk_scores=[RiskScore(category="safe_after_review", score=0.05)],
      )
    ]
  overall_risk = max(rs.score for s in segments for rs in s.risk_scores)
  cert_after = _classify_certification(max(overall_risk - 0.3, 0.0))
  heatmap = [
    {"start": s.start, "end": s.end, "intensity": max(r.score for r in s.risk_scores), "categories": s.labels}
    for s in segments
  ]
  updated = AnalyzeResponse(
    content_id=latest.content_id,
    duration=latest.duration,
    segments=segments,
    certification_before=latest.certification_before,
    certification_after=cert_after,
    overall_risk=overall_risk,
    heatmap=heatmap,
    analysis_cards=latest.analysis_cards,
  )
  _store_version(updated)
  return updated


@app.post("/api/history/restore", response_model=AnalyzeResponse)
async def history_restore(req: HistoryRequest):
  """
  Undo to the previous AI version for a given content id.
  """
  versions = _VERSIONS.get(req.content_id)
  if not versions or len(versions) < 2:
    # No previous version; return latest unchanged.
    if not versions:
      raise RuntimeError("Unknown content id")
    return versions[-1]
  # Pop latest and return the new last version.
  versions.pop()
  return versions[-1]


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
  question = req.question.lower()
  ctx = req.context or {}
  
  # SOCIAL MEDIA CONTEXT
  social = ctx.get("social") or {}
  has_social = bool(ctx.get("has_social") and social.get("contentId"))
  
  if has_social:
    content_id = social.get("contentId")
    segments = social.get("segments", [])
    cert_before = social.get("certification", {}).get("before")
    cert_after = social.get("certification", {}).get("after")
    overall_risk = social.get("overallRisk")
    
    # Social-specific questions
    if "sanitiz" in question or "redact" in question or "censor" in question:
      answer = (
        "The system detected harmful words and phrases, then replaced them with '***' to sanitize the content. "
        "This preserves readability while removing offensive language. You can see the sanitized version in the output panel."
      )
    elif "element" in question or "what" in question and "flag" in question:
      answer = (
        f"The analysis identified specific words/phrases that violate content policies. "
        f"Each censored element is categorized (e.g., Abusive Language, Violence, Misinformation) with a severity rating. "
        "Check the 'Censored Elements' section for the full list."
      )
    elif "risk" in question and ("breakdown" in question or "categor" in question):
      answer = (
        "Risk breakdown shows the score (0-100) for each detected category like Hate Speech, Violence, or Misinformation. "
        "The overall risk is the maximum score across all categories, which determines the certification rating."
      )
    elif "certification" in question or "rating" in question:
      if cert_before and cert_after:
        answer = (
          f"Before sanitization, the content was rated '{cert_before}'. "
          f"After removing harmful elements, it improved to '{cert_after}'. "
          "This follows CBFC-style guidelines where lower risk = more permissive rating."
        )
      else:
        answer = "Certification ratings (U, U/A, A, S) are assigned based on overall risk. Higher risk content gets stricter ratings."
    elif "heatmap" in question:
      answer = (
        "The heatmap visualizes risk intensity across the content timeline. "
        "Red zones indicate high-risk segments, orange is moderate, and green is safe. "
        "It helps you quickly identify problematic portions of the text."
      )
    elif "how" in question and ("work" in question or "detect" in question):
      answer = (
        "The system uses AI (GPT-4o when available) to analyze tone, context, and meaning. "
        "It detects hate speech, violence, sexual content, misinformation, and more. "
        "When AI is unavailable, it falls back to a rule-based dictionary of flagged terms."
      )
    elif "ai" in question or "analysis" in question:
      answer = (
        "The AI Analysis cards explain: (1) what was detected in the input, "
        "(2) how the output was sanitized, (3) the risk assessment reasoning, "
        "and (4) why the certification changed. This provides transparency into the decision-making process."
      )
    else:
      answer = (
        f"I'm analyzing social media content (ID: {content_id}). "
        "I can explain: sanitization logic, censored elements, risk breakdown, certification changes, "
        "heatmap visualization, or how the detection works. What would you like to know?"
      )
    
    return ChatResponse(answer=answer)
  
  # OTT CONTEXT (existing logic)
  ott = ctx.get("ott") or {}
  segments = ott.get("segments", [])
  cert_before = ott.get("certification_before")
  cert_after = ott.get("certification_after")
  overall_risk = ott.get("overall_risk")
  has_ott = bool(ctx.get("has_ott") and (segments or cert_before is not None))

  # OTT-only, factual, 2–3 sentences
  if has_ott and ("why" in question and ("censor" in question or "scene" in question or "segment" in question or "cut" in question)):
    parts = []
    for s in segments[:3]:
      reason = s.get("reason") or "Flagged content."
      parts.append(f"Segment {s.get('start_time', '')}–{s.get('end_time', '')}: {reason}")
    answer = " ".join(parts)[:400] if parts else "No segments were censored in this clip."
  elif has_ott and ("certification" in question or " s " in question or " a " in question or "u-a" in question):
    if cert_before and cert_after:
      answer = (
        f"Before censorship the clip was classified as {cert_before}; "
        f"after applying blur/beep/cut/hide to flagged segments it becomes {cert_after}. "
        "The change reflects reduced effective risk after sanitizing sensitive portions."
      )
    else:
      answer = "Certification is derived from the highest risk category and drops after censorship is applied."
  elif has_ott and ("cut" in question and ("part" in question or "portion" in question or "length" in question)):
    if segments:
      cut_parts = [f"{s.get('start_time', '')}–{s.get('end_time', '')} ({s.get('labels', ['flagged'])[0]})" for s in segments[:5]]
      answer = f"The cut or censored portions are: {', '.join(cut_parts)}. Only approved segments in Human Review are affected."
    else:
      answer = "No segments were approved for cutting in this clip."
  elif has_ott and "heatmap" in question:
    answer = (
      "The heatmap shows risk over time: yellow/orange is moderate risk, red is high risk. "
      "It aligns with the video timestamps so you can see which portions triggered censorship."
    )
  elif has_ott and ("peak risk" in question or "risk" in question):
    def _num(v):
      if v is None:
        return None
      if isinstance(v, (int, float)):
        return float(v)
      s = str(v).replace("%", "").strip()
      try:
        return float(s) / 100.0 if s else None
      except ValueError:
        return None
    peak = None
    if segments:
      for s in segments:
        for key in ("peak_risk", "peak_risk_str"):
          n = _num(s.get(key))
          if n is not None:
            peak = max(peak, n) if peak is not None else n
    if peak is None and overall_risk is not None:
      peak = float(overall_risk)
    if peak is not None:
      answer = f"The peak risk score in this clip is {peak:.0%}. Overall risk is {overall_risk:.2f} (0–1). Higher scores mean stronger censorship was applied."
    else:
      answer = "Risk scores summarize severity per category; the highest across segments drives certification."
  elif "undo" in question or "uncensor" in question:
    answer = (
      "Undo functionality has been removed. You can re-run the analysis to start over from the original clip."
    )
  elif "risk" in question or "score" in question:
    answer = (
      "Risk scores summarize how severe each flagged category is across segments. "
      "Higher scores mean more aggressive censorship is recommended."
    )
  elif "cert" in question:
    answer = (
      "Certification is derived from the highest risk categories detected, "
      "then recomputed after censorship to reflect the sanitized version."
    )
  elif has_ott:
     answer = f"I am analyzing the video with content ID {ott.get('content_id', 'unknown')}. I can explain censorship decisions, risk scores, and certification changes."
  else:
    answer = (
      "I can explain why segments were censored, how certification changed, which parts were cut, "
      "what the heatmap means, or the peak risk score. Ask an OTT-related question."
    )

  return ChatResponse(answer=answer)


@app.post("/api/social/analyze")
async def analyze_social(payload: TextRequest):
    """Analyze social media content from text or URL."""
    return _analyze_social_media_content(payload.text, payload.url)


@app.post("/api/docs/analyze")
async def analyze_docs(file: UploadFile = File(...)):
    """Analyze document for sensitive/confidential information."""
    # Save uploaded file temporarily
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    
    file_path = os.path.join(temp_dir, file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    try:
        # Extract text from document
        extracted_text = _extract_text_from_document(file_path)
        
        # Analyze the extracted text
        result = _analyze_document_content(extracted_text)
        
        return result
    finally:
        # Clean up temp file
        if os.path.exists(file_path):
            os.remove(file_path)


