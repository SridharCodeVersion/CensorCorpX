import React from 'react'
import { useTabContext } from '../state/TabContext'
import { analyzeDocs } from '../services/censorshipClient'
import type { SocialAnalyzeResponseDto } from '../services/censorshipClient'

export const DocsEditor: React.FC = () => {
  const { tabs, setTabState, state } = useTabContext()
  const current = tabs.docs
  const [file, setFile] = React.useState<File | null>(null)
  const [result, setResult] = React.useState<SocialAnalyzeResponseDto | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [logs, setLogs] = React.useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const runAnalysis = async () => {
    if (!file) return
    setLoading(true)
    setLogs([])

    try {
      addLog('Uploading file...')
      addLog(`Extracting text from ${file.name}...`)

      const data = await analyzeDocs(file)

      addLog(`Detected ${data.censored_elements?.length || 0} sensitive elements`)
      addLog('Analysis complete')

      setResult(data)

      setTabState('docs', () => ({
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
      addLog(`Error: ${e}`)
      alert("Analysis failed. See console and logs.")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setLogs([])
    }
  }

  return (
    <div className="flex h-full font-sans flex-col">
      {/* TOP: FILE UPLOAD + RESULTS */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: FILE UPLOAD */}
        <div className="flex-1 border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-w-[300px]">
          <div className="flex items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-x-4">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Document Upload</span>
            <div className="flex-1" />
            <button
              onClick={runAnalysis}
              disabled={!file || loading}
              className="px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>

          <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
            <div className="max-w-md w-full">
              <div className="mb-4 text-4xl">📄</div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Upload Document
              </label>
              <input
                type="file"
                accept=".docx,.doc,.pdf"
                onChange={handleFileChange}
                className="w-full px-4 py-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
              />
              {file && (
                <div className="mt-4 p-3 rounded bg-zinc-100 dark:bg-zinc-800 text-left">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">Selected File:</div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{file.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
              )}
              <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                Supports DOCX, DOC, and PDF files.
                <br />We extract text and analyze for sensitive/confidential information.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: RESULTS */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0d1117] min-w-[400px] overflow-hidden">
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
                <p className="text-sm">Upload a document and run analysis to see censorship details.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">

                {/* 1. SANITIZED OUTPUT */}
                <div className="p-5">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Sanitized Output</h3>
                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/50 text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {renderSanitized(result.sanitized_content || '')}
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
                      <span>Document Timeline</span>
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

      {/* BOTTOM: EXECUTION LOGS */}
      <div className="h-32 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 overflow-y-auto">
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2 font-semibold uppercase tracking-wider">Execution Logs</div>
        <div className="space-y-1 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
          {logs.length === 0 ? (
            <div className="text-zinc-400 italic">No logs yet. Upload a file and run analysis.</div>
          ) : (
            logs.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  )
}

// HELPERS

function renderSanitized(text: string) {
  const parts = text.split(/(\\*\\*\\*)/g);
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


