import React, { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTabContext } from '../state/TabContext'
import { analyzeMusicAsync, applyMusicAsync } from '../services/censorshipClient'
import type { AnalyzeResponseDto, SegmentDto } from '../services/censorshipClient'

export const MusicEditor: React.FC = () => {
  const { setTabState, tabs, addLog } = useTabContext()
  const current = tabs.music

  const [loading, setLoading] = useState(current.jobStatus === 'running')
  useEffect(() => {
    setLoading(current.jobStatus === 'running')
  }, [current.jobStatus])

  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number>(0)

  const runAnalysis = async () => {
    if (!current.url?.trim() && !current.file) return
    setLoading(true)
    setTabState('music', (prev) => ({ ...prev, jobStatus: 'running', progress: 0 }))

    setTabState('music', (prev) => ({
      ...prev,
      originalUrl: null,
      censoredUrl: null,
      heatmap: [],
      review: {},
      segments: [],
      contentId: undefined,
      certification: undefined,
      overallRisk: undefined,
      analysisCards: [],
      options: { ...prev.options }
    }))

    try {
      addLog(`Starting Music analysis...`)
      const start = await analyzeMusicAsync(current.file ?? undefined, current.url?.trim() || undefined)

      // If it was a file upload, we might already have the original URL for preview
      if (start.original_url) {
        setTabState('music', (prev) => ({ ...prev, originalUrl: start.original_url }))
      }

      const es = new EventSource(`/api/jobs/${start.job_id}/events`)
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'log') {
            if (typeof data.progress === 'number') {
              setTabState('music', (prev) => ({ ...prev, progress: data.progress }))
            }
            addLog(data.message)
          }
          if (data.type === 'final') {
            es.close()
            if (data.status === 'error') {
              setTabState('music', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog(data.error ?? 'Job failed', 'error')
              return
            }
            const result = data.result
            const analysis = result?.analysis as AnalyzeResponseDto | undefined
            const finalOriginalUrl = result?.original_url as string | undefined

            if (!analysis) {
              setTabState('music', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog('No analysis payload received.', 'error')
              return
            }

            const newReview = Object.fromEntries(analysis.segments.map((s) => [s.id, true]))

            setTabState('music', (prev) => ({
              ...prev,
              jobStatus: 'done',
              originalUrl: finalOriginalUrl ?? prev.originalUrl,
              heatmap: analysis.heatmap,
              review: newReview,
              locked: prev.locked,
              contentId: analysis.content_id,
              segments: analysis.segments.map((s) => ({
                id: s.id,
                start: s.start,
                end: s.end,
                labels: s.labels,
                riskScores: s.risk_scores,
                reason: s.reason,
                confidence: s.confidence,
                peak_risk_str: s.peak_risk_str,
                start_time: s.start_time,
                end_time: s.end_time
              })),
              certification: {
                before: analysis.certification_before as any,
                after: analysis.certification_after as any
              },
              overallRisk: analysis.overall_risk,
              durationSeconds: analysis.duration,
              analysisCards: analysis.analysis_cards,
              historyKeys: [...prev.historyKeys, analysis.content_id]
            }))
            addLog('Music analysis complete.')
          }
        } catch { }
      }
    } catch (e: any) {
      setTabState('music', (prev) => ({ ...prev, jobStatus: 'error' }))
      addLog(e.message || 'Failed to start analysis', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyCensorship = async () => {
    if (!current.contentId) return
    setLoading(true)
    setTabState('music', (prev) => ({ ...prev, jobStatus: 'running', progress: 0 }))
    addLog('Rendering censored track...')

    const segmentsToApply = current.segments.filter(s => current.review?.[s.id] !== false)

    try {
      const start = await applyMusicAsync(current.contentId, {
        ...current.options,
        custom_segments: segmentsToApply.map(s => ({
          ...s,
          risk_scores: s.riskScores || []
        })),
        review: current.review
      })

      const es = new EventSource(`/api/jobs/${start.job_id}/events`)
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'log') {
            if (typeof data.progress === 'number') {
              setTabState('music', (prev) => ({ ...prev, progress: data.progress }))
            }
            addLog(data.message)
          }
          if (data.type === 'final') {
            es.close()
            setLoading(false)
            if (data.status === 'error') {
              setTabState('music', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog(data.error ?? 'Render failed', 'error')
              return
            }
            const url = data.result?.censored_url
            if (url) {
              setTabState('music', (prev) => ({ ...prev, censoredUrl: `${url}?t=${Date.now()}` }))
              addLog('Censored track ready.')
            }
            setTabState('music', (prev) => ({ ...prev, jobStatus: 'done' }))
          }
        } catch { }
      }
      es.onerror = () => {
        es.close()
        setTabState('music', (prev) => ({ ...prev, jobStatus: 'error' }))
        setLoading(false)
        addLog('Connection lost', 'error')
      }
    } catch (e: any) {
      setTabState('music', (prev) => ({ ...prev, jobStatus: 'error' }))
      setLoading(false)
      addLog(e.message || 'Failed to start render', 'error')
    }
  }

  const timelineDuration = current.durationSeconds ?? audioDurationSeconds

  const approvedSegmentsSeconds = useMemo(() => {
    if (timelineDuration <= 0) return []
    return current.segments
      .filter((s) => current.review?.[s.id] !== false)
      .map((s) => ({
        id: s.id,
        startSec: s.start * timelineDuration,
        endSec: s.end * timelineDuration,
      }))
  }, [current.segments, current.review, timelineDuration])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Parse reasoning to find the word to highlight
  const getCensoredWord = (reason?: string) => {
    if (!reason) return null
    const match = reason.match(/'([^']+)'/)
    return match ? match[1] : null
  }

  const statusLabel = current.jobStatus === 'running' ? 'Processing Assets' : current.jobStatus === 'done' ? 'Task Complete' : 'Idle'

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-[3] border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400">File</span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (f) {
                    setTabState('music', (prev) => ({ ...prev, file: f, originalUrl: URL.createObjectURL(f) }))
                  } else {
                    setTabState('music', (prev) => ({ ...prev, file: null, originalUrl: null }))
                  }
                }}
                className="text-[11px] text-zinc-600 dark:text-zinc-300 w-40"
              />
            </div>
            <span className="text-zinc-400 dark:text-zinc-500 font-bold">OR</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400">URL</span>
              <input
                className="px-2 py-1 rounded-smooth bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-800 dark:text-zinc-200 w-64"
                placeholder="YouTube music link"
                value={current.url}
                onChange={(e) => setTabState('music', prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={(!current.file && !current.url?.trim()) || loading}
              className="px-3 py-1 rounded-smooth bg-accent text-[11px] text-white disabled:opacity-50"
            >
              {loading && current.jobStatus === 'running' && !current.contentId ? 'Analyzing…' : 'Run AI (Live)'}
            </button>
            <button
              onClick={applyCensorship}
              disabled={!current.contentId || loading}
              className="px-3 py-1 rounded-smooth bg-emerald-600 text-[11px] text-white disabled:opacity-50 hover:bg-emerald-500"
            >
              {loading && current.jobStatus === 'running' && current.contentId ? 'Generating…' : 'Apply Censorship'}
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center bg-black/60 p-4">
            <div className="grid grid-cols-1 gap-4 w-full max-w-2xl">
              {/* Audio visualizer placeholders or subtle players */}
              <div className="bg-zinc-900/50 rounded-smooth p-4 border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider font-bold">Original Track</div>
                {current.originalUrl ? (
                  <audio
                    src={current.originalUrl}
                    controls
                    className="w-full h-8"
                    onLoadedMetadata={(e) => setAudioDurationSeconds(e.currentTarget.duration)}
                  />
                ) : (
                  <div className="h-8 flex items-center justify-center text-[10px] text-zinc-600 italic">No audio loaded</div>
                )}
              </div>

              <div className="bg-emerald-950/10 rounded-smooth p-4 border border-emerald-900/30">
                <div className="text-[10px] text-emerald-500/70 mb-2 uppercase tracking-wider font-bold">Censored Version</div>
                {current.censoredUrl ? (
                  <audio src={current.censoredUrl} controls className="w-full h-8" autoPlay />
                ) : (
                  <div className="h-8 flex items-center justify-center text-[10px] text-zinc-600 italic">Run analysis and apply censorship to generate</div>
                )}
              </div>
            </div>
          </div>

          {/* Heatmap Area */}
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 h-16 bg-white dark:bg-[#0E0E0E]">
            <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-tighter">Audio Risk Heatmap</div>
            <div className="relative h-4 rounded bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              {(current.heatmap || []).map((h: any, idx: number) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${h.start * 100}%`,
                    width: `${(h.end - h.start) * 100}%`,
                    background: h.intensity > 0.7 ? '#ef4444' : h.intensity > 0.4 ? '#f59e0b' : '#10b981'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E0E]">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] uppercase font-bold text-zinc-500">
                System Status: <span className="text-zinc-800 dark:text-zinc-200 font-normal ml-1">
                  {statusLabel}
                </span>
              </div>
              <div className="text-[10px] font-bold text-accent">{current.progress ?? 0}%</div>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${current.progress ?? 0}%` }}
                className="h-full bg-accent"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-[2] bg-zinc-50 dark:bg-[#0E0E0E]">
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Human Review & Lyrics Analysis
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-xs space-y-4">

          {/* Timeline Visualizer */}
          {timelineDuration > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                <span>Timeline</span>
                <span>{formatTime(timelineDuration)}</span>
              </div>
              <div className="relative h-4 rounded bg-zinc-200 dark:bg-zinc-900">
                {approvedSegmentsSeconds.map(s => (
                  <div
                    key={s.id}
                    className="absolute top-0 bottom-0 bg-red-500/50 border-x border-red-600 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                    style={{ left: `${(s.startSec / timelineDuration) * 100}%`, width: `${((s.endSec - s.startSec) / timelineDuration) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-[10px] text-zinc-500 font-bold uppercase">Detected sensitive lyrics</div>
            {current.segments.length === 0 && (
              <div className="p-4 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-smooth text-center text-zinc-400 italic">
                No sensitive lyrics detected yet.
              </div>
            )}
            {current.segments.map((s) => {
              const approved = current.review?.[s.id] ?? true
              const censoredWord = getCensoredWord(s.reason)
              return (
                <motion.div
                  key={s.id}
                  layout
                  className={`rounded-smooth border p-3 ${approved ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 shadow-sm' : 'opacity-60 border-zinc-100 dark:border-zinc-900'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-bold text-zinc-500">
                        {s.start_time} - {s.end_time}
                      </div>
                      {censoredWord && (
                        <div className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold border border-red-200 dark:border-red-900/50">
                          {censoredWord}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={approved}
                        onChange={(e) => setTabState('music', prev => ({ ...prev, review: { ...(prev.review || {}), [s.id]: e.target.checked } }))}
                        className="rounded accent-accent"
                      />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Approve</span>
                    </label>
                  </div>

                  <div className="text-[11px] text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    {s.reason || "Potentially harmful content detected in audio track."}
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                      <span>Conf: <span className="text-emerald-500">{s.confidence}</span></span>
                      <span>Category: <span className="text-amber-500">{s.labels[0]}</span></span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Certification Section */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-2 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <div className="text-[9px] uppercase font-bold text-zinc-500 mb-1">Before Censorship</div>
                <div className="text-xl font-black text-zinc-800 dark:text-zinc-100">{current.certification?.before || '—'}</div>
              </div>
              <div className="p-2 rounded bg-emerald-100/30 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30">
                <div className="text-[9px] uppercase font-bold text-emerald-600/70 mb-1">Optimized Rating</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{current.certification?.after || '—'}</div>
              </div>
            </div>
            <div className="p-3 rounded-smooth bg-accent/5 border border-accent/20">
              <div className="text-[10px] uppercase font-bold text-accent mb-1">AI Risk Assessment</div>
              <div className="flex items-end gap-2">
                <div className="text-lg font-black">{current.overallRisk != null ? (current.overallRisk * 100).toFixed(0) : '0'}%</div>
                <div className="text-[10px] text-zinc-500 mb-1 font-medium">calculated based on lyric density and severity.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


