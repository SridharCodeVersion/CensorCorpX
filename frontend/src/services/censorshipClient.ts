import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000
})

export interface HeatmapItem {
  start: number
  end: number
  intensity: number
  categories: string[]
}

export interface SegmentDto {
  id: string
  start: number
  end: number
  labels: string[]
  risk_scores: { category: string; score: number }[]
  reason?: string
  confidence?: string
  peak_risk_str?: string
  start_time?: string
  end_time?: string
}

export interface AnalyzeResponseDto {
  content_id: string
  duration: number
  segments: SegmentDto[]
  certification_before: string
  certification_after: string
  overall_risk: number
  heatmap: HeatmapItem[]
  analysis_cards: { title: string; body: string }[]
  certification_logic?: string
}

export async function analyzeOtt(file: File, options: unknown): Promise<AnalyzeResponseDto> {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))
  const res = await api.post<AnalyzeResponseDto>('/ott/analyze', form)
  return res.data
}

export interface OttStartResponseDto {
  job_id: string
  content_id: string
  original_url: string
}

export async function analyzeOttAsync(file: File, options: unknown): Promise<OttStartResponseDto> {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))
  const res = await api.post<OttStartResponseDto>('/ott/analyze_async', form)
  return res.data
}

export interface OttApplyResponseDto {
  job_id: string
  content_id: string
}

export async function applyOttAsync(contentId: string, options: unknown): Promise<OttApplyResponseDto> {
  const res = await api.post<OttApplyResponseDto>('/ott/apply_async', {
    content_id: contentId,
    options
  })
  return res.data
}

export async function restoreOttHistory(contentId: string): Promise<AnalyzeResponseDto> {
  const res = await api.post<AnalyzeResponseDto>('/history/restore', { content_id: contentId })
  return res.data
}

export interface JobLogEvent {
  type: 'log'
  ts: number
  message: string
  progress?: number
  status: 'queued' | 'running' | 'done' | 'error'
  job_id: string
}

export interface JobFinalEvent {
  type: 'final'
  status: 'done' | 'error'
  job_id: string
  result: any
  error?: string | null
}

export interface ApplyOptions {
  cutClip?: boolean
  cutCaptions?: boolean
  hideCaptions?: boolean
  blurVideo?: boolean
  addBeep?: boolean
  muteAudio?: boolean
  review?: Record<string, boolean>
  custom_segments?: SegmentDto[]
}


export async function analyzeYoutube(url: string): Promise<AnalyzeResponseDto> {
  const res = await api.post<AnalyzeResponseDto>('/youtube/analyze', { url })
  return res.data
}

export interface YoutubeStartResponseDto {
  job_id: string
  content_id: string
  original_url: string
}

export async function analyzeYoutubeAsync(url: string): Promise<YoutubeStartResponseDto> {
  const res = await api.post<YoutubeStartResponseDto>('/youtube/analyze_async', { url })
  return res.data
}

export interface YoutubeApplyResponseDto {
  job_id: string
  content_id: string
}

export async function applyYoutubeAsync(contentId: string, options: unknown): Promise<YoutubeApplyResponseDto> {
  const res = await api.post<YoutubeApplyResponseDto>('/youtube/apply_async', {
    content_id: contentId,
    options
  })
  return res.data
}

export interface MusicStartResponseDto {
  job_id: string
  content_id: string
  original_url: string
}

export async function analyzeMusicAsync(file?: File, url?: string): Promise<MusicStartResponseDto> {
  const form = new FormData()
  if (file) form.append('file', file)
  if (url) form.append('payload', JSON.stringify({ url }))
  const res = await api.post<MusicStartResponseDto>('/music/analyze_async', form)
  return res.data
}

export interface MusicApplyResponseDto {
  job_id: string
  content_id: string
}

export async function applyMusicAsync(contentId: string, options: unknown): Promise<MusicApplyResponseDto> {
  const res = await api.post<MusicApplyResponseDto>('/music/apply_async', {
    content_id: contentId,
    options
  })
  return res.data
}

export async function analyzeMusic(fileOrUrl: { file?: File; url?: string }): Promise<AnalyzeResponseDto> {
  if (fileOrUrl.file) {
    const form = new FormData()
    form.append('file', fileOrUrl.file)
    const res = await api.post<AnalyzeResponseDto>('/music/analyze', form)
    return res.data
  }
  const res = await api.post<AnalyzeResponseDto>('/music/analyze', { url: fileOrUrl.url })
  return res.data
}

export interface CensoredElement {
  category: string
  original: string
  reason: string
  severity: string
}

export interface RiskBreakdown {
  category: string
  score: number
}

export interface SocialAnalyzeResponseDto extends AnalyzeResponseDto {
  sanitized_content?: string
  censored_elements?: CensoredElement[]
  risk_breakdown?: RiskBreakdown[]
  certification_reason?: string
  ai_analysis_input?: string
  ai_analysis_output?: string
  ai_analysis_risk?: string
  ai_analysis_cert?: string
}

export async function analyzeSocial(text?: string, url?: string): Promise<SocialAnalyzeResponseDto> {
  const res = await api.post<SocialAnalyzeResponseDto>('/social/analyze', { text, url })
  return res.data
}

export async function analyzeDocs(file: File): Promise<SocialAnalyzeResponseDto> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<SocialAnalyzeResponseDto>('/docs/analyze', form)
  return res.data
}

