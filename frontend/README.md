# Dhurandhar – AI Censorship Intelligence UI (Frontend)

This is the React + TypeScript + Vite frontend for **Dhurandhar**, a VS Code–style censorship intelligence platform.

## Tech Stack

- React + TypeScript (Vite)
- Tailwind CSS (custom VS Code–like dark theme)
- Framer Motion (micro-animations)
- Monaco Editor (`@monaco-editor/react`) for text-based content
- Axios for API calls

## Layout

- **Top navigation**: Tabs for OTT, YouTube Video, Music, Social Media, Documentation + theme badge.
- **Left activity bar**: Icon-based menu (Run, AI Assistant, Human Review, Uncensor, Censor, Child Protection, Settings).
- **Center editor**: Tab-specific editors for each content type.
- **Bottom panel**: Terminal-style Output / Undo AI Changes / AI Analysis tabs.
- **Right panel**: AI Assistant with get-started cards and short, on-topic answers.

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://localhost:8000` (FastAPI backend), configured in `vite.config.ts`.

## Tabs & Features

- **OTT**
  - Upload video clip.
  - Run AI censorship (`/api/ott/analyze`) to detect segments and risk.
  - Heatmap overlay timeline, film certification before/after, overall risk.
  - Censorship options: cut clip, cut captions, hide captions, blur video, add beep.
  - Child Protection lock blurs the video and blocks interaction per tab.
- **YouTube Video**
  - Analyze by URL (`/api/youtube/analyze`).
  - Platform-specific risk flags (fake news, extremism, hate speech, etc.) and heatmap.
- **Music**
  - Upload audio/video or paste a YouTube link.
  - AI risk scoring for explicit lyrics via `/api/music/analyze` and heatmap.
- **Social Media**
  - Monaco editor for original post text.
  - `/api/social/analyze` for risk, plus sanitized preview with redacted phrases.
- **Documentation**
  - Monaco editor for documentation text.
  - `/api/docs/analyze` for risk + censored version, heatmap for long-form text.

## Assistant & Review

- **AI Assistant** (right panel) calls `/api/chat` and enforces short, relevant answers.
- **Undo/Uncensor** and **history** are exposed via `/api/history/restore` and tracked per tab in shared state.
- **Human Review** is wired into backend `/api/review/submit` and is intended to be driven from UI components bound to per-segment decisions. For the prototype, the data flow and API are in place; you can easily add per-segment approval toggles on top of the existing tab editors.

