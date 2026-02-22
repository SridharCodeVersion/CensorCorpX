import React, { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTabContext } from '../state/TabContext'
import { analyzeYoutubeAsync, applyYoutubeAsync } from '../services/censorshipClient'
import type { AnalyzeResponseDto, SegmentDto } from '../services/censorshipClient'

export const YoutubeEditor: React.FC = () => {
  const { setTabState, tabs, addLog } = useTabContext()
  const current = tabs.youtube

  // Local loading state for immediate feedback
  const [loading, setLoading] = useState(current.jobStatus === 'running')

  useEffect(() => {
    setLoading(current.jobStatus === 'running')
  }, [current.jobStatus])

  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(0)

  // NOTE: Edited segments are directly modifying current.segments in TabState.
  // This ensures persistence. 

  const runAnalysis = async () => {
    if (!current.url.trim()) return
    setLoading(true)
    setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'running', progress: 0 }))

    // Clear previous results
    setTabState('youtube', (prev) => ({
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
      // keep options?
      options: { ...prev.options }
    }))

    try {
      addLog(`Starting YouTube analysis for: ${current.url}`)
      const start = await analyzeYoutubeAsync(current.url.trim())

      const es = new EventSource(`/api/jobs/${start.job_id}/events`)
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'log') {
            if (typeof data.progress === 'number') {
              setTabState('youtube', (prev) => ({ ...prev, progress: data.progress }))
            }
            addLog(data.message)
          }
          if (data.type === 'final') {
            es.close()
            if (data.status === 'error') {
              setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog(data.error ?? 'Job failed', 'error')
              return
            }
            const result = data.result
            const analysis = result?.analysis as AnalyzeResponseDto | undefined
            const originalVidUrl = result?.original_url as string | undefined

            if (!analysis) {
              setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog('No analysis payload received.', 'error')
              return
            }

            const newReview = Object.fromEntries(analysis.segments.map((s) => [s.id, true]))

            setTabState('youtube', (prev) => ({
              ...prev,
              jobStatus: 'done',
              originalUrl: originalVidUrl ?? null,
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
              certificationLogic: analysis.certification_logic,
              analysisCards: analysis.analysis_cards,
              historyKeys: [...prev.historyKeys, analysis.content_id]
            }))
            addLog('YouTube analysis complete.')
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch (e: any) {
      console.error(e)
      setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'error' }))
      addLog(e.message || 'Failed to start analysis', 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyCensorship = async () => {
    if (!current.contentId) return
    setLoading(true)
    setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'running', progress: 0 }))
    addLog('Rendering censored preview (YouTube)…')

    // Filter segments based on Review
    const segmentsToApply = current.segments.filter(s => current.review?.[s.id] !== false)

    try {
      const start = await applyYoutubeAsync(current.contentId, {
        cutClip: current.options?.cutClip,
        cutCaptions: current.options?.cutCaptions,
        hideCaptions: current.options?.hideCaptions,
        blurVideo: current.options?.blurVideo,
        addBeep: current.options?.addBeep,
        muteAudio: current.options?.muteAudio,
        // Map back to SegmentDto (snake_case) for API
        custom_segments: segmentsToApply.map(s => ({
          ...s,
          risk_scores: s.riskScores || []
        })),
        review: current.review
      })

      const es = new EventSource(`/api/jobs/${start.job_id}/events`)
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        es.close()
        setLoading(false)
      }

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'log') {
            if (typeof data.progress === 'number') {
              setTabState('youtube', (prev) => ({ ...prev, progress: data.progress }))
            }
            addLog(data.message)
          }
          if (data.type === 'final') {
            finish()
            if (data.status === 'error') {
              setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog(data.error ?? 'Render failed', 'error')
              return
            }
            const url = data.result?.censored_url
            const newDuration = data.result?.new_duration
            if (url) {
              setTabState('youtube', (prev) => ({ ...prev, censoredUrl: `${url}?t=${Date.now()}` }))
              addLog('Censored preview ready.')
              if (typeof newDuration === 'number') {
                setTabState('youtube', (prev) => ({ ...prev, durationSeconds: newDuration }))
              }
            } else {
              addLog('No censored URL returned', 'warn')
            }
            setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'done' }))
          }
        } catch { }
      }
      es.onerror = () => {
        finish()
        setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'error' }))
        addLog('Connection lost', 'error')
      }
    } catch (e: any) {
      console.error(e)
      setTabState('youtube', (prev) => ({ ...prev, jobStatus: 'error' }))
      setLoading(false)
      addLog(e.message || 'Failed to start render', 'error')
    }
  }

  const timelineDuration = current.durationSeconds ?? videoDurationSeconds

  // Timeline visualization uses editedSegments (which is current.segments now)
  const approvedSegmentsSeconds = useMemo(() => {
    if (timelineDuration <= 0) return []
    return current.segments
      .filter((s) => current.review?.[s.id] !== false)
      .map((s) => ({
        id: s.id,
        startSec: s.start * timelineDuration,
        endSec: s.end * timelineDuration,
        labels: s.labels
      }))
  }, [current.segments, current.review, timelineDuration])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const updateSegmentTime = (id: string, field: 'start' | 'end', val: string) => {
    // User inputs seconds. Convert to ratio.
    const sec = parseFloat(val)
    if (isNaN(sec)) return
    const ratio = sec / timelineDuration
    setTabState('youtube', (prev) => ({
      ...prev,
      segments: prev.segments.map(s => s.id === id ? { ...s, [field]: ratio } : s)
    }))
  }

  const addSegment = () => {
    const id = `new-${Date.now()}`
    const newSeg = {
      id,
      start: 0,
      end: 0.1, // default 10% length
      labels: ['manual'],
      riskScores: [], // Correct field name for Segment
      start_time: '00:00:00',
      end_time: '00:00:05',
      confidence: '1.0',
      peak_risk_str: 'Manual'
    }
    setTabState('youtube', (prev) => ({
      ...prev,
      segments: [...prev.segments, newSeg as any],
      review: { ...(prev.review || {}), [id]: true }
    }))
  }

  const deleteSegment = (id: string) => {
    setTabState('youtube', (prev) => ({
      ...prev,
      segments: prev.segments.filter(s => s.id !== id)
    }))
  }

  // Helper values
  const opts = current.options || {}
  const statusLabel = current.jobStatus === 'running' ? 'Processing…' : current.jobStatus === 'done' ? 'Ready' : current.jobStatus === 'error' ? 'Error' : 'Idle'

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-[3] border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">YouTube URL</span>
            <input
              className="px-2 py-1 rounded-smooth bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-[11px] text-zinc-800 dark:text-zinc-200 w-80"
              placeholder="https://youtube.com/..."
              value={current.url}
              onChange={(e) => setTabState('youtube', prev => ({ ...prev, url: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={!current.url?.trim() || loading}
              className="px-3 py-1 rounded-smooth bg-accent text-[11px] text-white disabled:opacity-50"
            >
              {loading && current.jobStatus === 'running' && !current.contentId ? 'Analyzing…' : 'Run AI (Live)'}
            </button>
            <button
              type="button"
              onClick={() => applyCensorship()}
              disabled={!current.contentId || loading}
              className="px-3 py-1 rounded-smooth bg-emerald-600 text-[11px] text-white disabled:opacity-50 hover:bg-emerald-500 disabled:hover:bg-emerald-600"
              title={!current.contentId ? 'Analyze first' : 'Generate censored preview'}
            >
              {loading && current.jobStatus === 'running' && current.contentId ? 'Generating…' : 'Apply Censorship'}
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 flex items-center justify-center bg-black/60 relative p-3">
            {current.originalUrl ? (
              <div className="grid grid-cols-2 gap-3 w-full h-full">
                {/* Original */}
                <div className="relative h-full">
                  <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full bg-black/60 border border-zinc-700 text-zinc-300">
                    Original
                  </div>
                  <video
                    src={current.originalUrl}
                    controls
                    onLoadedMetadata={(e) => setVideoDurationSeconds(e.currentTarget.duration || 0)}
                    className={`h-full w-full object-contain rounded-smooth border border-zinc-800 ${current.locked ? 'blur-xl pointer-events-none' : ''}`}
                  />
                  {/* Heatmap overlay */}
                  {(current.heatmap || []).length > 0 && timelineDuration > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-black/50 rounded-b-smooth pointer-events-none z-10">
                      <div className="absolute inset-0 flex">
                        {(current.heatmap || []).map((h: any, idx: number) => (
                          <div
                            key={idx}
                            className="absolute top-0 bottom-0"
                            style={{
                              left: `${h.start * 100}%`,
                              width: `${(h.end - h.start) * 100}%`,
                              background:
                                h.intensity > 0.7
                                  ? 'rgba(239,68,68,0.85)'
                                  : h.intensity > 0.4
                                    ? 'rgba(245,158,11,0.85)'
                                    : 'rgba(34,197,94,0.75)'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Censored */}
                <div className="relative h-full">
                  <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full bg-black/60 border border-zinc-700 text-zinc-300">
                    Censored Preview
                  </div>
                  <div className="h-full w-full rounded-smooth border border-zinc-800 bg-black/20 overflow-hidden flex items-center justify-center">
                    {current.censoredUrl ? (
                      <video
                        src={current.censoredUrl}
                        controls
                        className={`h-full w-full object-contain ${current.locked ? 'blur-xl pointer-events-none' : ''}`}
                      />
                    ) : (
                      <div className="text-xs text-zinc-500 px-6 text-center space-y-1">
                        <p>Run AI, approve segments, then Apply Censorship.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 text-center">
                <p>Enter a YouTube URL to begin.</p>
                <p className="mt-2 text-[10px] opacity-70">Supports valid YouTube video links.</p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E0E]">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {statusLabel}
              </div>
              <div className="text-[11px] text-zinc-500">{current.progress ?? 0}%</div>
            </div>
            <div className="h-2 mt-1 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${current.progress ?? 0}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 30 }}
                className="h-full bg-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Human Review & Options */}
      <div className="flex flex-col flex-[2] bg-zinc-50 dark:bg-[#0E0E0E]">
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Human Review & Options
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-xs space-y-3">

          {/* Censored Timeline - Moved here */}
          {timelineDuration > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-smooth p-3 bg-white dark:bg-[#0E0E0E]">
              <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Censored timeline <span className="ml-2 text-zinc-500 font-normal">{formatTime(0)} – {formatTime(timelineDuration)}</span>
              </div>
              <div className="space-y-2">
                <div className="relative h-3 rounded bg-zinc-100 dark:bg-zinc-900 mb-5">
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <span key={frac} className="absolute top-0 bottom-0 w-px bg-zinc-300 dark:bg-zinc-600" style={{ left: `${frac * 100}%` }} />
                  ))}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <span key={`t-${frac}`} className="absolute text-[9px] text-zinc-500 top-full mt-0.5" style={{ left: `${frac * 100}%`, transform: 'translateX(-50%)' }}>
                      {formatTime(frac * timelineDuration)}
                    </span>
                  ))}
                </div>

                {/* Render ALL Timeline options for visualization */}
                {(opts.blurVideo || opts.cutClip || opts.addBeep || opts.muteAudio) && approvedSegmentsSeconds.length > 0 && (
                  <div className="relative flex-1 h-4 rounded bg-zinc-900 overflow-hidden mt-1">
                    {approvedSegmentsSeconds.map((s) => {
                      let color = 'bg-zinc-500' // default
                      if (opts.cutClip) color = 'bg-red-500/80'
                      else if (opts.blurVideo) color = 'bg-amber-500/80'
                      else if (opts.addBeep) color = 'bg-blue-500/80'
                      else if (opts.muteAudio) color = 'bg-gray-400/80'

                      return (
                        <div key={s.id} className={`absolute top-0 bottom-0 ${color} rounded`}
                          style={{ left: `${(s.startSec / timelineDuration) * 100}%`, width: `${((s.endSec - s.startSec) / timelineDuration) * 100}%` }} />
                      )
                    })}
                  </div>
                )}

              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Detected segments (toggle to approve/reject)</div>
              <button
                onClick={addSegment}
                className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-[10px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                + Add Segment
              </button>
            </div>

            {current.segments.length === 0 && (
              <div className="text-[11px] text-zinc-500">No segments. Run AI or add manual one.</div>
            )}

            {current.segments.map((s) => {
              const approved = current.review?.[s.id] ?? true
              const peak = s.riskScores ? Math.max(...s.riskScores.map((r) => r.score), 0) : 0
              return (
                <motion.div key={s.id} layout className={`rounded-smooth border p-2 ${approved ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60' : 'opacity-70 border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      {s.labels.length > 0 ? s.labels.join(', ') : 'Manual Segment'}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 cursor-pointer">
                        <input type="checkbox" checked={approved} onChange={(e) => setTabState('youtube', prev => ({ ...prev, review: { ...(prev.review || {}), [s.id]: e.target.checked } }))} />
                        Approve
                      </label>
                      <button title="Delete" onClick={() => deleteSegment(s.id)} className="text-zinc-400 hover:text-red-500">
                        &times;
                      </button>
                    </div>
                  </div>

                  {/* Editing Inputs */}
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-1">
                    <span>Start:</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-12 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-800 dark:text-zinc-200"
                      value={(s.start * timelineDuration).toFixed(1)}
                      onChange={(e) => updateSegmentTime(s.id, 'start', e.target.value)}
                      disabled={!approved}
                    />
                    <span>s</span>

                    <span className="ml-2">End:</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-12 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-800 dark:text-zinc-200"
                      value={(s.end * timelineDuration).toFixed(1)}
                      onChange={(e) => updateSegmentTime(s.id, 'end', e.target.value)}
                      disabled={!approved}
                    />
                    <span>s</span>
                  </div>

                  {(s.confidence || s.peak_risk_str) && (
                    <div className="mt-1 text-[10px] text-zinc-500">Confidence: {s.confidence ?? '-'} · Peak: {s.peak_risk_str ?? (peak * 100).toFixed(0) + '%'}</div>
                  )}
                  {s.reason && <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 italic">{s.reason}</div>}
                </motion.div>
              )
            })}
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Treat flagged segments:</div>
            {[
              ['cutClip', 'Cut clip duration'],
              ['blurVideo', 'Blur video'],
              ['addBeep', 'Add beep sound'],
              ['muteAudio', 'Mute audio']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[11px]">
                <input type="checkbox" checked={opts[key] ?? false} onChange={(e) => setTabState('youtube', prev => ({ ...prev, options: { ...(prev.options || {}), [key]: e.target.checked } }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-3 border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2">
            <div className="font-semibold text-[11px] text-zinc-700 dark:text-zinc-300">Video Certification</div>
            <div className="flex items-center gap-3">
              <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                <div className="text-[10px] text-zinc-500">Before</div>
                <div className="text-sm font-bold">{current.certification?.before ?? '-'}</div>
              </div>
              <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                <div className="text-[10px] text-zinc-500">After</div>
                <div className="text-sm font-bold text-emerald-500 dark:text-emerald-400">{current.certification?.after ?? '-'}</div>
              </div>
              <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                <div className="text-[10px] text-zinc-500">Risk</div>
                <div className="text-sm font-bold">{current.overallRisk != null ? current.overallRisk.toFixed(2) : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
