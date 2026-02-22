import React from 'react'
import { motion } from 'framer-motion'
import { useTabContext } from '../state/TabContext'
import { chatWithAssistant } from '../services/chatClient'

export const AssistantPanel: React.FC = () => {
  const { tabs } = useTabContext()
  const [messages, setMessages] = React.useState<{ from: 'user' | 'ai'; text: string }[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const handleSend = async () => {
    if (!input.trim()) return
    const question = input.trim()
    setMessages((prev) => [...prev, { from: 'user', text: question }])
    setInput('')
    setLoading(true)
    try {
      const ott = tabs.ott.contentId
        ? {
          segments: tabs.ott.segments.map((s) => ({
            id: s.id,
            start_time: s.start_time,
            end_time: s.end_time,
            reason: s.reason,
            peak_risk_str: s.peak_risk_str,
            peak_risk: s.riskScores.length ? Math.max(...s.riskScores.map((r) => r.score)) : undefined,
            labels: s.labels
          })),
          certification_before: tabs.ott.certification?.before,
          certification_after: tabs.ott.certification?.after,
          overall_risk: tabs.ott.overallRisk
        }
        : undefined
      const res = await chatWithAssistant({
        question,
        context: {
          has_ott: !!tabs.ott.contentId,
          hasYoutube: !!tabs.youtube.contentId,
          hasMusic: !!tabs.music.contentId,
          hasSocial: !!tabs.social.contentId,
          hasDocs: !!tabs.docs.contentId,
          ott
        }
      })
      setMessages((prev) => [...prev, { from: 'ai', text: res.answer }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { from: 'ai', text: 'The assistant is currently unavailable. Please try again.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#0E0E0E]/95 backdrop-blur-sm flex flex-col"
    >
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        AI Assistant
      </div>
      <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 space-y-1 border-b border-zinc-200 dark:border-zinc-800">
        <div className="font-semibold text-zinc-700 dark:text-zinc-300">Get Started</div>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Ask why specific segments were censored.</li>
          <li>Request a summary of risk scores.</li>
          <li>Clarify CBFC-style certification decisions.</li>
        </ul>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`rounded-md px-2 py-1 ${m.from === 'user'
              ? 'bg-accent/20 text-accent self-end'
              : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200'
              }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 flex items-center gap-1">
        <input
          className="flex-1 rounded-smooth bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs outline-none focus:border-accent"
          placeholder="Ask about current analysis…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          disabled={loading}
          onClick={handleSend}
          className="text-xs rounded-smooth bg-accent text-white px-3 py-1 disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </motion.aside>
  )
}

