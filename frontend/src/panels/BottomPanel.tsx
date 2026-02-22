import React, { useState, useRef, useEffect } from 'react'
import { useTabContext } from '../state/TabContext'
import { restoreOttHistory } from '../services/censorshipClient'

type BottomTab = 'output' | 'undo' | 'analysis'

export const BottomPanel: React.FC = () => {
  const { state, setUiState, tabs, clearLogs, setTabState, addLog, triggerRestoreOtt } = useTabContext()
  const [restoring, setRestoring] = useState(false)
  const [tab, setTab] = React.useState<BottomTab>('output')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tab === 'output' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.outputLogs, tab])

  const height = state.bottomPanelHeight

  const handleClear = () => clearLogs()

  const onDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    const next = window.innerHeight - e.clientY
    const clamped = Math.min(360, Math.max(120, next))
    setUiState((prev) => ({ ...prev, bottomPanelHeight: clamped }))
  }

  return (
    <div
      className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E0E] text-xs text-zinc-700 dark:text-zinc-300"
      style={{ height }}
    >
      <div
        className="h-1 cursor-row-resize bg-zinc-100 dark:bg-zinc-900/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 transition-colors"
        onMouseDown={(e) => {
          const move = (ev: MouseEvent) => {
            const next = window.innerHeight - ev.clientY
            const clamped = Math.min(360, Math.max(120, next))
            setUiState((prev) => ({ ...prev, bottomPanelHeight: clamped }))
          }
          const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
          }
          window.addEventListener('mousemove', move)
          window.addEventListener('mouseup', up)
          onDrag(e)
        }}
      />
      <div className="flex items-center justify-between px-3 h-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80">
        <div className="flex items-center gap-2">
          {[
            { id: 'output', label: 'Output' },
            { id: 'analysis', label: 'AI Analysis' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as BottomTab)}
              className={`px-2 py-0.5 rounded-sm text-[11px] ${tab === t.id
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleClear}
          className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Clear
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-[calc(100%-1.75rem)] overflow-y-auto px-3 py-2 font-mono text-[11px] text-zinc-700 dark:text-zinc-300"
      >
        {tab === 'output' && (
          <div className="space-y-1">
            {state.outputLogs.length === 0 && (
              <div className="text-zinc-500">No output yet.</div>
            )}
            {state.outputLogs.map((l, i) => (
              <div key={i} className={l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-300' : ''}>
                <span className="text-zinc-500">
                  {new Date(l.ts).toLocaleTimeString()}
                </span>{' '}
                {l.message}
              </div>
            ))}
          </div>
        )}

        {tab === 'analysis' && (
          <div className="space-y-3">
            {/* OTT-specific: certification logic and per-segment why censored */}
            {tabs.ott.contentId && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">OTT — AI Analysis</div>
                {tabs.ott.certificationLogic && (
                  <div className="rounded-smooth border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-2">
                    <div className="font-semibold text-[11px] mb-1">Certification justification</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{tabs.ott.certificationLogic}</div>
                  </div>
                )}
                {tabs.ott.segments.map((s) => (
                  <div key={s.id} className="rounded-smooth border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-2">
                    <div className="font-semibold text-[11px] mb-1">
                      {s.labels.join(', ')} — {s.start_time ?? ''}–{s.end_time ?? ''}
                    </div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      {s.reason ?? 'Flagged for review.'} Peak risk: {s.peak_risk_str ?? '—'}
                    </div>
                  </div>
                ))}
                {tabs.ott.analysisCards.filter((c) => !c.title.startsWith('Segment')).map((card, idx) => (
                  <div key={`ott-${idx}`} className="rounded-smooth border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-2">
                    <div className="font-semibold text-[11px] mb-1">{card.title}</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{card.body}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Other tabs’ analysis cards */}
            <div className="grid grid-cols-2 gap-2">
              {tabs.ott.analysisCards.length === 0 &&
                tabs.youtube.analysisCards.length === 0 &&
                tabs.music.analysisCards.length === 0 &&
                tabs.social.analysisCards.length === 0 &&
                tabs.docs.analysisCards.length === 0 && (
                  <div className="text-zinc-500 col-span-2">No AI analysis yet. Run AI (Live) in OTT to see segment explanations and certification.</div>
                )}
              {tabs.youtube.analysisCards
                .concat(tabs.music.analysisCards, tabs.social.analysisCards, tabs.docs.analysisCards)
                .map((card, idx) => (
                  <div key={idx} className="rounded-smooth border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 p-2">
                    <div className="font-semibold text-[11px] mb-1">{card.title}</div>
                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{card.body}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

