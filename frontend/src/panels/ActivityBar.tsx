import React from 'react'
import { motion } from 'framer-motion'
import { useTabContext } from '../state/TabContext'
import {
  Play,
  Bot,
  User,
  RefreshCw,
  Ban,
  Lock,
  Sun,
  Moon
} from 'lucide-react'

type ActionId =
  | 'run'
  | 'assistant'
  | 'human'
  | 'uncensor'
  | 'censor'
  | 'lock'
  | 'settings'

const actions: { id: ActionId; label: string; icon: React.ReactNode; bottom?: boolean }[] = [
  { id: 'run', label: 'Run AI', icon: <Play size={18} /> },
  { id: 'assistant', label: 'AI Assistant', icon: <Bot size={18} /> },
  { id: 'human', label: 'Human Review', icon: <User size={18} /> },
  { id: 'uncensor', label: 'Uncensor', icon: <RefreshCw size={18} /> },
  { id: 'censor', label: 'Show Censored', icon: <Ban size={18} /> },
  { id: 'lock', label: 'Child Protection', icon: <Lock size={18} /> },
  { id: 'settings', label: 'Theme', icon: null, bottom: true } // Icon handled dynamically
]

export const ActivityBar: React.FC = () => {
  const [active, setActive] = React.useState<ActionId | null>('run')
  const { setUiState, activeTab, setTabState, resetTab, state } = useTabContext()

  const handleClick = (id: ActionId) => {
    setActive(id)
    if (id === 'assistant') {
      setUiState((prev) => ({ ...prev, rightPanelVisible: !prev.rightPanelVisible }))
    }
    if (id === 'lock') {
      setTabState(activeTab, (prev) => ({ ...prev, locked: !prev.locked }))
    }
    if (id === 'uncensor') {
      if (window.confirm('Reset this tab? Current analysis will be lost.')) {
        resetTab(activeTab)
      }
    }
    if (id === 'settings') {
      setUiState((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))
    }
    // Other actions are wired into tab-specific components via API calls and history.
  }

  return (
    <aside className="flex flex-col justify-between w-12 bg-zinc-50 dark:bg-sidebar border-r border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="flex flex-col items-center py-2 gap-1">
        {actions
          .filter((a) => !a.bottom)
          .map((a) => {
            const selected = a.id === active
            return (
              <button
                key={a.id}
                onClick={() => handleClick(a.id)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${selected
                  ? 'bg-accent/20 text-accent shadow-accent-glow'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                title={a.label}
              >
                {a.icon}
                {selected && (
                  <motion.div
                    layoutId="activity-highlight"
                    className="absolute inset-0 rounded-lg border border-accent/60"
                  />
                )}
              </button>
            )
          })}
      </div>
      <div className="flex flex-col items-center py-2 gap-1">
        {actions
          .filter((a) => a.bottom)
          .map((a) => (
            <button
              key={a.id}
              onClick={() => handleClick(a.id)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              title={a.label}
            >
              {a.id === 'settings' ? (
                state.theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />
              ) : (
                a.icon
              )}
            </button>
          ))}
      </div>
    </aside>
  )
}

