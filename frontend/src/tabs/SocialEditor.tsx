import React from 'react'
import Editor from '@monaco-editor/react'
import { useTabContext } from '../state/TabContext'
import { analyzeSocial } from '../services/censorshipClient'
import type { SocialAnalyzeResponseDto } from '../services/censorshipClient'

export const SocialEditor: React.FC = () => {
  const { tabs, setTabState, state } = useTabContext()
  const current = tabs.social
  const [activeInput, setActiveInput] = React.useState<'text' | 'link'>('text')
  const [text, setText] = React.useState('// Paste a tweet or post text here\nNobody has fought harder for full release of the Epstein files and prosecution...')
  const [url, setUrl] = React.useState('')
  const [result, setResult] = React.useState<SocialAnalyzeResponseDto | null>(null)
  const [loading, setLoading] = React.useState(false)

  const runAnalysis = async () => {
    if (activeInput === 'text' && !text.trim()) return
    if (activeInput === 'link' && !url.trim()) return

    setLoading(true)
    try {
      const data = await analyzeSocial(
        activeInput === 'text' ? text : undefined,
        activeInput === 'link' ? url : undefined
      )
      setResult(data)

      setTabState('social', () => ({
        locked: current.locked,
        contentId: data.content_id,
        segments: data.segments.map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          labels: s.labels,
          riskScores: s.risk_scores
        })),
        certification: {
          before: data.certification_before as any,
          after: data.certification_after as any
        },
        overallRisk: data.overall_risk,
        analysisCards: data.analysis_cards,
        historyKeys: [...current.historyKeys, data.content_id]
      }))
    } catch (e) {
      console.error(e)
      alert("Analysis failed. See console.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full font-sans">
      {/* LEFT: INPUT */}
      <div className="flex-1 border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-w-[300px]">
        {/* Input Toggle */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-x-4">
          <button
            onClick={() => setActiveInput('text')}
            className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-colors ${activeInput === 'text' ? 'text-blue-600 border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-700'}`}
          >
            Text Input
          </button>
          <button
            onClick={() => setActiveInput('link')}
            className={`text-xs font-semibold uppercase tracking-wider pb-1 border-b-2 transition-colors ${activeInput === 'link' ? 'text-blue-600 border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-700'}`}
          >
            Link Input
          </button>

          <div className="flex-1" /> {/* Spacer */}

          <button
            onClick={runAnalysis}
            disabled={(activeInput === 'text' && !text.trim()) || (activeInput === 'link' && !url.trim()) || loading}
            className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>

        <div className="flex-1 relative bg-white dark:bg-[#1e1e1e]">
          {activeInput === 'text' ? (
            <Editor
              height="100%"
              defaultLanguage="markdown"
              theme={state.theme === 'dark' ? 'vs-dark' : 'light'}
              value={text}
              onChange={(value) => setText(value ?? '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                padding: { top: 16, bottom: 16 }
              }}
            />
          ) : (
            <div className="p-8 flex flex-col items-center justify-center h-full text-center">
              <div className="max-w-md w-full">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 text-left">
                  Paste Social Media Link
                </label>
                <input
                  type="url"
                  placeholder="https://twitter.com/user/status/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  Supports X (Twitter), Instagram, Threads, and other public social platforms.
                  <br />We extract the post caption and analyze it for safety.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: RESULTS */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#0d1117] min-w-[400px] overflow-hidden">
        {/* HEADER */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Analysis Results</span>
          {result && (
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRiskColor(result.overall_risk)}`}>
                Risk: {Math.round(result.overall_risk * 100)}%
              </span>
              <span className="text-xs text-zinc-400">
                {result.certification_before} → {result.certification_after}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {!result ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 p-8 text-center opacity-60">
              <div className="mb-2 text-4xl">🔍</div>
              <p className="text-sm">Enter text and run analysis to see censorship details.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">

              {/* 1. SANITIZED PREVIEW */}
              <div className="p-5">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Sanitized Output</h3>
                <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/50 text-sm leading-relaxed whitespace-pre-wrap">
                  {renderSanitized(result.sanitized_content || text)}
                </div>
              </div>

              {/* 2. CENSORED ELEMENTS */}
              {result.censored_elements && result.censored_elements.length > 0 && (
                <div className="p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center">
                    Censored Elements
                    <span className="ml-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full text-[10px]">
                      {result.censored_elements.length}
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {result.censored_elements.map((el, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800 hover:border-red-200 dark:hover:border-red-900/50 transition-colors group">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-mono font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                            "{el.original}"
                          </span>
                          <span className="text-xs text-zinc-500">➜</span>
                          <span className="text-xs text-zinc-400 italic">{el.category}</span>
                        </div>
                        <div className="mt-2 sm:mt-0 text-[10px] text-zinc-400 flex items-center">
                          <span className="mr-2">{el.reason}</span>
                          <span className={`px-1.5 py-0.5 rounded uppercase font-bold tracking-tight ${getSeverityColor(el.severity)}`}>
                            {el.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. RISK BREAKDOWN & HEATMAP */}
              <div className="p-5">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Risk Analysis</h3>

                {/* Heatmap Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                    <span>Content Timeline</span>
                    <span>{Math.round(result.overall_risk * 100)}/100 Risk</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    {result.heatmap.map((h, idx) => (
                      <div
                        key={idx}
                        className="absolute top-0 bottom-0 transition-all duration-500"
                        style={{
                          left: `${h.start * 100}%`,
                          width: `${Math.max((h.end - h.start) * 100, 1)}%`,
                          backgroundColor: h.intensity > 0.7 ? '#ef4444' : h.intensity > 0.4 ? '#f59e0b' : '#22c55e',
                          opacity: 0.8
                        }}
                        title={`${h.categories.join(', ')} (${Math.round(h.intensity * 100)}%)`}
                      />
                    ))}
                  </div>
                </div>

                {/* Categories Grid */}
                {result.risk_breakdown && (
                  <div className="grid grid-cols-2 gap-2">
                    {result.risk_breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-zinc-50 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-600 dark:text-zinc-400">{item.category}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-1 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono w-6 text-right text-zinc-500">{item.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. AI CARDS */}
              <div className="p-5">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Agent Reasoning</h3>
                <div className="grid grid-cols-1 gap-3">
                  <AiCard title="Input Analysis" content={result.ai_analysis_input} icon="📝" />
                  <AiCard title="Risk Assessment" content={result.ai_analysis_risk} icon="🛡️" />
                  <AiCard title="Certification Logic" content={result.ai_analysis_cert} icon="🎓" />
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// HELPERS

function renderSanitized(text: string) {
  const parts = text.split(/(\*\*\*)/g);
  return parts.map((part, i) => {
    if (part === '***') {
      return <span key={i} className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1 rounded font-mono font-bold mx-0.5 text-xs select-none" title="Censored Content">***</span>
    }
    return <span key={i}>{part}</span>
  });
}

function getRiskColor(risk: number) {
  if (risk > 0.7) return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
  if (risk > 0.3) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
}

function getSeverityColor(sev: string) {
  const s = sev.toLowerCase()
  if (s === 'high') return 'bg-red-100 text-red-600 dark:bg-red-900/30'
  if (s === 'medium') return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'
  return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
}

const AiCard = ({ title, content, icon }: { title: string, content?: string, icon: string }) => {
  if (!content) return null;
  return (
    <div className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900/40 dark:to-transparent">
      <div className="flex items-center space-x-2 mb-1.5 opacity-70">
        <span className="text-sm grayscale">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{title}</span>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-snug">{content}</p>
    </div>
  )
}


