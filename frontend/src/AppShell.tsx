import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { OttEditor } from './tabs/OttEditor'
import { YoutubeEditor } from './tabs/YoutubeEditor'
import { MusicEditor } from './tabs/MusicEditor'
import { SocialEditor } from './tabs/SocialEditor'
import { DocsEditor } from './tabs/DocsEditor'
import { AssistantPanel } from './panels/AssistantPanel'
import { BottomPanel } from './panels/BottomPanel'
import { ActivityBar } from './panels/ActivityBar'
import { TabProvider, useTabContext } from './state/TabContext'
import type { ContentType } from './state/TabContext'

const TopNav: React.FC = () => {
  const { activeTab, setActiveTab, setUiState, state } = useTabContext()
  const tabs: { id: ContentType; label: string }[] = [
    { id: 'ott', label: 'OTT' },
    { id: 'youtube', label: 'YouTube Video' },
    { id: 'music', label: 'Music' }
  ]

  // Effect to sync theme with DOM
  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [state.theme])

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E0E] shrink-0 transition-colors duration-200">
      {/* Left: Team Name (Boxed Tile) */}
      <div className="flex items-center justify-start">
        <div
          className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 rounded shadow-sm text-zinc-900 dark:text-zinc-100 font-bold text-base tracking-wide hover:scale-105 transition-transform duration-200 cursor-default"
          style={{ fontFamily: '"Copperplate Gothic", "Copperplate Gothic Light", serif' }}
        >
          Dhurandhar AI
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="flex items-center justify-center gap-1">
        {tabs.map((t) => {
          const selected = t.id === activeTab
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors ${selected
                ? 'text-zinc-900 dark:text-white'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
            >
              {t.label}
              {selected && (
                <motion.div
                  layoutId="topnav-underline"
                  className="absolute left-2 right-2 bottom-0 h-0.5 bg-accent"
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Right: Empty for spacing balance */}
      <div />
    </header>
  )
}

const GlobalHeader: React.FC = () => {
  return (
    <div className="px-6 py-2 bg-white dark:bg-[#0E0E0E] border-b border-zinc-200 dark:border-zinc-800 flex justify-center items-center shrink-0 transition-colors duration-200">
      <div
        className="px-6 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 rounded shadow-sm text-zinc-900 dark:text-zinc-100 font-bold text-sm tracking-widest uppercase hover:scale-105 transition-transform duration-200 cursor-default"
        style={{ fontFamily: '"Copperplate Gothic", "Copperplate Gothic Light", serif' }}
      >
        AI Automated Personalized Censorship & Intelligence Platform
      </div>
    </div>
  )
}

const SubHeader: React.FC = () => {
  const { activeTab } = useTabContext()

  const punchlines: Record<ContentType, string> = {
    ott: "Team Dhurandhar AI: AI-powered scene-level detection, censorship, risk scoring, and certification for OTT platforms.",
    youtube: "Team Dhurandhar AI: Automated AI moderation for videos detecting abuse, misinformation, copyright risks, and harmful content.",
    music: "Team Dhurandhar AI: Intelligent audio-visual censorship that removes explicit content while preserving musical flow and quality.",
    social: "Team Dhurandhar AI: AI sanitization of posts to prevent policy, safety, and compliance violations.",
    docs: "Team Dhurandhar AI: Context-aware AI censorship and risk analysis for text, research, news, and sensitive documents."
  }

  return (
    <div className="px-4 py-2 bg-zinc-50 dark:bg-[#141414] border-b border-zinc-200 dark:border-zinc-800 flex justify-center items-center shrink-0 transition-colors duration-200">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 text-center max-w-4xl leading-relaxed">
        {punchlines[activeTab]}
      </span>
    </div>
  )
}

export const AppShellInner: React.FC = () => {
  const { state, activeTab } = useTabContext()

  return (
    <div className={`flex flex-col h-full bg-zinc-50 dark:bg-[#0E0E0E] text-zinc-900 dark:text-zinc-100 transition-colors duration-200`}>
      <TopNav />
      <GlobalHeader />
      <SubHeader />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />

        {/* Center Content (Main + Bottom Panel) */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <main className="flex-1 overflow-hidden border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0E0E0E] relative">
            {activeTab === 'ott' && <OttEditor />}
            {activeTab === 'youtube' && <YoutubeEditor />}
            {activeTab === 'music' && <MusicEditor />}
            {activeTab === 'social' && <SocialEditor />}
            {activeTab === 'docs' && <DocsEditor />}
          </main>
          <BottomPanel />
        </div>

        {/* Right Sidebar (Full Height) */}
        {state.rightPanelVisible && <AssistantPanel />}
      </div>
    </div>
  )
}

export const AppShell: React.FC = () => {
  return (
    <TabProvider>
      <AppShellInner />
    </TabProvider>
  )
}

