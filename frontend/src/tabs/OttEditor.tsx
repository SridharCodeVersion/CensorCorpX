import React, { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTabContext } from '../state/TabContext'
import { analyzeOttAsync, applyOttAsync } from '../services/censorshipClient'
import type { AnalyzeResponseDto } from '../services/censorshipClient'

export const OttEditor: React.FC = () => {
  const { setTabState, tabs, addLog, state } = useTabContext()
  const current = tabs.ott

  // Local loading state for immediate feedback, but sync status to context
  const [loading, setLoading] = useState(current.jobStatus === 'running')

  // Sync loading on mount
  useEffect(() => {
    setLoading(current.jobStatus === 'running')
  }, [current.jobStatus])

  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number>(0)

  useEffect(() => {
    if (state.restoreOttRequest > 0) {
      setTabState('ott', (prev) => ({ ...prev, censoredUrl: null }))
    }
  }, [state.restoreOttRequest])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const objectUrl = URL.createObjectURL(f)
    setTabState('ott', (prev) => ({
      ...prev,
      file: f,
      previewUrl: objectUrl,
      originalUrl: null,
      censoredUrl: null,
      heatmap: [],
      jobStatus: 'idle',
      progress: 0,
      review: {},
      options: { ...prev.options } // keep existing options or reset?
    }))
    addLog(`Loaded clip: ${f.name}`)
  }

  const runAnalysis = async () => {
    if (!current.file) return
    setLoading(true)
    setTabState('ott', (prev) => ({ ...prev, jobStatus: 'running', progress: 0 }))

    try {
      addLog('Starting OTT analysis job…')
      const start = await analyzeOttAsync(current.file, current.options)
      setTabState('ott', (prev) => ({ ...prev, originalUrl: start.original_url }))

      const es = new EventSource(`/api/jobs/${start.job_id}/events`)
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'log') {
            if (typeof data.progress === 'number') {
              setTabState('ott', (prev) => ({ ...prev, progress: data.progress }))
            }
            addLog(data.message)
          }
          if (data.type === 'final') {
            es.close()
            if (data.status === 'error') {
              setTabState('ott', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog(data.error ?? 'Job failed', 'error')
              return
            }
            const analysis = data.result?.analysis as AnalyzeResponseDto | undefined
            if (!analysis) {
              setTabState('ott', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog('No analysis payload received.', 'error')
              return
            }

            const newReview = Object.fromEntries(analysis.segments.map((s) => [s.id, true]))

            setTabState('ott', (prev) => ({
              ...prev,
              jobStatus: 'done',
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
            addLog('OTT analysis complete.')
          }
        } catch {
          // ignore parse errors
        }
      }
    } catch (e: unknown) {
      console.error(e)
      setTabState('ott', (prev) => ({ ...prev, jobStatus: 'error' }))
      const errMsg =
        (e as { response?: { data?: { detail?: string }; status?: number } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'Failed to start analysis job. Is the backend running on port 8000?'
      addLog(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), 'error')
    } finally {
      setLoading(false)
    }
  }

  const applyCensorship = async () => {
    if (!current.contentId) return
    setLoading(true)
    setTabState('ott', (prev) => ({ ...prev, jobStatus: 'running', progress: 0 }))
    addLog('Rendering censored preview with selected options…')
    try {
      const start = await applyOttAsync(current.contentId, {
        cutClip: current.options?.cutClip ?? false,
        cutCaptions: current.options?.cutCaptions ?? false,
        hideCaptions: current.options?.hideCaptions ?? false,
        blurVideo: current.options?.blurVideo ?? true,
        addBeep: current.options?.addBeep ?? true,
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
              setTabState('ott', (prev) => ({ ...prev, progress: data.progress }))
            }
            addLog(data.message)
          }
          if (data.type === 'final') {
            finish()
            if (data.status === 'error') {
              setTabState('ott', (prev) => ({ ...prev, jobStatus: 'error' }))
              addLog(data.error ?? 'Render failed', 'error')
              return
            }
            const url = data.result?.censored_url as string | undefined
            const newDuration = data.result?.new_duration as number | undefined
            if (url) {
              setTabState('ott', (prev) => ({ ...prev, censoredUrl: `${url}?t=${Date.now()}` }))
              addLog('Censored preview ready.')
              if (typeof newDuration === 'number') {
                setTabState('ott', (prev) => ({ ...prev, durationSeconds: newDuration }))
                addLog(`Timeline updated to ${newDuration.toFixed(2)}s.`)
              }
            } else {
              addLog('No censored URL returned.', 'warn')
            }
            setTabState('ott', (prev) => ({ ...prev, jobStatus: 'done' }))
          }
        } catch {
          // ignore parse errors
        }
      }
      es.onerror = () => {
        finish()
        setTabState('ott', (prev) => ({ ...prev, jobStatus: 'error' }))
        addLog('Connection to job stream lost. Retry Apply Censorship.', 'error')
      }
    } catch (e: unknown) {
      console.error(e)
      setTabState('ott', (prev) => ({ ...prev, jobStatus: 'error' }))
      setLoading(false)
      const errMsg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as { message?: string })?.message ||
        'Failed to start render job.'
      addLog(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), 'error')
    }
  }

  const segmentsSorted = useMemo(() => {
    return [...current.segments].sort((a, b) => a.start - b.start)
  }, [current.segments])

  /** Duration in seconds for timeline (analysis or video metadata) */
  const timelineDuration = current.durationSeconds ?? videoDurationSeconds

  /** Approved segments that will be censored, with start/end in seconds */
  const approvedSegmentsSeconds = useMemo(() => {
    if (timelineDuration <= 0) return []
    return segmentsSorted
      .filter((s) => current.review?.[s.id] !== false)
      .map((s) => ({
        id: s.id,
        startSec: s.start * timelineDuration,
        endSec: s.end * timelineDuration,
        labels: s.labels
      }))
  }, [segmentsSorted, current.review, timelineDuration])

  const certification = current.certification

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Helper for options
  const opts = current.options || {}

  // Helper for status view
  const statusLabel = current.jobStatus === 'running' ? 'Live processing…' : current.jobStatus === 'done' ? 'Ready' : current.jobStatus === 'error' ? 'Error' : 'Idle'

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-[3] border-r border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">OTT Clip</span>
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="text-[11px] text-zinc-600 dark:text-zinc-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={!current.file || loading}
              className="px-3 py-1 rounded-smooth bg-accent text-[11px] text-white disabled:opacity-50"
            >
              {loading ? 'Working…' : 'Run AI (Live)'}
            </button>
            <button
              type="button"
              onClick={() => applyCensorship()}
              disabled={!current.contentId || loading}
              className="px-3 py-1 rounded-smooth bg-emerald-600 text-[11px] text-white disabled:opacity-50 hover:bg-emerald-500 disabled:hover:bg-emerald-600"
              title={!current.contentId ? 'Run AI (Live) first to analyze the clip' : 'Generate censored preview with your selected options'}
            >
              {loading ? 'Generating…' : 'Apply Censorship'}
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 flex items-center justify-center bg-black/60 relative p-3">
            {current.previewUrl ? (
              <>
                <div className="grid grid-cols-2 gap-3 w-full h-full">
                  <div className="relative h-full">
                    <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full bg-black/60 border border-zinc-700 text-zinc-300">
                      Original
                    </div>
                    <video
                      src={current.originalUrl ?? current.previewUrl}
                      controls
                      onLoadedMetadata={(e) => setVideoDurationSeconds(e.currentTarget.duration || 0)}
                      className={`h-full w-full object-contain rounded-smooth border border-zinc-800 ${current.locked ? 'blur-xl pointer-events-none select-none' : ''
                        }`}
                    />
                    {/* Heatmap overlay on video: yellow/orange = moderate, red = high risk */}
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
                              title={`${(h.start * timelineDuration).toFixed(1)}s–${(h.end * timelineDuration).toFixed(1)}s: ${h.categories.join(', ')}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative h-full">
                    <div className="absolute top-2 left-2 z-10 text-[10px] px-2 py-1 rounded-full bg-black/60 border border-zinc-700 text-zinc-300">
                      Censored Preview
                    </div>
                    <div className="h-full w-full rounded-smooth border border-zinc-800 bg-black/20 overflow-hidden flex items-center justify-center">
                      {current.censoredUrl ? (
                        <video
                          src={current.censoredUrl}
                          controls
                          className={`h-full w-full object-contain ${current.locked ? 'blur-xl pointer-events-none select-none' : ''
                            }`}
                        />
                      ) : (
                        <div className="text-xs text-zinc-500 px-6 text-center space-y-1">
                          <p>Run AI (Live), then choose how to treat flagged segments below.</p>
                          <p>Click <strong>Apply Censorship</strong> to generate the censored preview.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {current.locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="px-4 py-2 rounded-smooth border border-red-500/70 bg-black/70 text-xs text-red-300">
                      Child Protection lock is enabled for this tab.
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-xs text-zinc-500">
                Upload a movie clip to begin automated censorship.
              </div>
            )}
          </div>
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

          {/* Censored timeline: precise duration of blurred/beeped/cut portions */}
          {timelineDuration > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-white dark:bg-[#0E0E0E]">
              <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Censored timeline
                <span className="ml-2 text-zinc-500 font-normal">
                  {formatTime(0)} – {formatTime(timelineDuration)} (total {formatTime(timelineDuration)})
                </span>
              </div>
              <div className="space-y-2">
                {/* Time ruler */}
                <div className="relative h-3 rounded bg-zinc-100 dark:bg-zinc-900 mb-5">
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <span
                      key={frac}
                      className="absolute top-0 bottom-0 w-px bg-zinc-300 dark:bg-zinc-600"
                      style={{ left: `${frac * 100}%` }}
                    />
                  ))}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                    <span
                      key={`t-${frac}`}
                      className="absolute text-[9px] text-zinc-500 top-full mt-0.5"
                      style={{ left: `${frac * 100}%`, transform: 'translateX(-50%)' }}
                    >
                      {formatTime(frac * timelineDuration)}
                    </span>
                  ))}
                </div>
                {/* Treatment rows: only show if option enabled and there are approved segments */}
                {opts.blurVideo && approvedSegmentsSeconds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-16 shrink-0">Blurred</span>
                    <div className="relative flex-1 h-4 rounded bg-zinc-900 overflow-hidden">
                      {approvedSegmentsSeconds.map((seg) => (
                        <div
                          key={`blur-${seg.id}`}
                          className="absolute top-0 bottom-0 bg-amber-500/80 rounded"
                          style={{
                            left: `${(seg.startSec / timelineDuration) * 100}%`,
                            width: `${((seg.endSec - seg.startSec) / timelineDuration) * 100}%`
                          }}
                          title={`${formatTime(seg.startSec)} – ${formatTime(seg.endSec)} (blur)`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {opts.addBeep && approvedSegmentsSeconds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-16 shrink-0">Beeped</span>
                    <div className="relative flex-1 h-4 rounded bg-zinc-900 overflow-hidden">
                      {approvedSegmentsSeconds.map((seg) => (
                        <div
                          key={`beep-${seg.id}`}
                          className="absolute top-0 bottom-0 bg-blue-500/80 rounded"
                          style={{
                            left: `${(seg.startSec / timelineDuration) * 100}%`,
                            width: `${((seg.endSec - seg.startSec) / timelineDuration) * 100}%`
                          }}
                          title={`${formatTime(seg.startSec)} – ${formatTime(seg.endSec)} (beep)`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {opts.cutClip && approvedSegmentsSeconds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-16 shrink-0">Cut</span>
                    <div className="relative flex-1 h-4 rounded bg-zinc-900 overflow-hidden">
                      {approvedSegmentsSeconds.map((seg) => (
                        <div
                          key={`cut-${seg.id}`}
                          className="absolute top-0 bottom-0 bg-red-500/80 rounded"
                          style={{
                            left: `${(seg.startSec / timelineDuration) * 100}%`,
                            width: `${((seg.endSec - seg.startSec) / timelineDuration) * 100}%`
                          }}
                          title={`${formatTime(seg.startSec)} – ${formatTime(seg.endSec)} (cut)`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {approvedSegmentsSeconds.length === 0 && (
                <div className="text-[10px] text-zinc-500 mt-1">
                  {current.segments.length === 0
                    ? 'Run AI to detect sensitive portions; approved segments will appear here as Blurred / Beeped / Cut.'
                    : 'No segments approved for censorship. Toggle “Approve” on detected segments above.'}
                </div>
              )}
            </div>
          )}

          <div className="h-16 border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">Heatmap</div>
            <div className="relative h-4 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
              {(current.heatmap || []).map((h: any, idx: number) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${h.start * 100}%`,
                    width: `${(h.end - h.start) * 100}%`,
                    background:
                      h.intensity > 0.7
                        ? 'rgba(239,68,68,0.9)'
                        : h.intensity > 0.4
                          ? 'rgba(245,158,11,0.9)'
                          : 'rgba(34,197,94,0.9)'
                  }}
                  title={h.categories.join(', ')}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-[2] bg-zinc-50 dark:bg-[#0E0E0E]">
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Human Review & Options
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 text-xs space-y-3">
          <div className="space-y-2">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Detected segments (toggle to approve/reject)</div>
            {segmentsSorted.length === 0 && (
              <div className="text-[11px] text-zinc-500">
                No segments yet. Run AI to detect sensitive portions.
              </div>
            )}
            {segmentsSorted.map((s) => {
              const approved = current.review?.[s.id] ?? true
              const peak = Math.max(...s.riskScores.map((r) => r.score))
              return (
                <motion.div
                  key={s.id}
                  layout
                  className={`rounded-smooth border p-2 ${approved ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60' : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30 opacity-70'
                    }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      {s.labels.join(', ')}{' '}
                      <span className="text-zinc-500">
                        ({s.start_time ?? `${Math.round(s.start * 100)}%`}–{s.end_time ?? `${Math.round(s.end * 100)}%`})
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <input
                        type="checkbox"
                        checked={approved}
                        onChange={(e) => setTabState('ott', prev => ({ ...prev, review: { ...(prev.review || {}), [s.id]: e.target.checked } }))}
                      />
                      Approve
                    </label>
                  </div>
                  {(s.confidence || s.peak_risk_str) && (
                    <div className="mt-1 text-[10px] text-zinc-500">
                      Confidence: {s.confidence ?? '—'} · Peak risk: {s.peak_risk_str ?? (peak * 100).toFixed(0)}%
                    </div>
                  )}
                  {s.reason && (
                    <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400 italic">{s.reason}</div>
                  )}
                  <div className="mt-2">
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.round(peak * 100)}%`,
                          background:
                            peak > 0.7 ? 'rgba(239,68,68,0.9)' : peak > 0.4 ? 'rgba(245,158,11,0.9)' : 'rgba(34,197,94,0.9)'
                        }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      Peak risk: {s.peak_risk_str ?? (peak * 100).toFixed(0)}%
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Choose how to treat flagged segments. Only detected portions are affected.
            </div>
            {[
              ['cutClip', 'Cut clip duration'],
              ['cutCaptions', 'Cut captions only'],
              ['hideCaptions', 'Hide captions'],
              ['blurVideo', 'Blur video'],
              ['addBeep', 'Add beep sound']
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={opts[key] ?? false}
                  onChange={(e) =>
                    setTabState('ott', prev => ({ ...prev, options: { ...(prev.options || {}), [key]: e.target.checked } }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-3 border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2">
            <div className="font-semibold text-[11px] text-zinc-700 dark:text-zinc-300">Film Certification</div>
            <div className="flex items-center gap-3">
              <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                <div className="text-[10px] text-zinc-500">Before</div>
                <div className="text-sm font-bold">
                  {certification?.before ?? '—'}
                </div>
              </div>
              <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                <div className="text-[10px] text-zinc-500">After</div>
                <div className="text-sm font-bold text-emerald-500 dark:text-emerald-400">
                  {certification?.after ?? '—'}
                </div>
              </div>
              <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 px-2 py-1">
                <div className="text-[10px] text-zinc-500">Overall Risk</div>
                <div className="text-sm font-bold">
                  {current.overallRisk != null ? current.overallRisk.toFixed(2) : '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

