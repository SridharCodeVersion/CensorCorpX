import React, { createContext, useContext, useState } from 'react'

export type ContentType = 'ott' | 'youtube' | 'music' | 'social' | 'docs'

export interface RiskScore {
  category: string
  score: number
}

export interface Segment {
  id: string
  start: number
  end: number
  labels: string[]
  riskScores: RiskScore[]
  reason?: string
  confidence?: string
  peak_risk_str?: string
  start_time?: string
  end_time?: string
}

export interface Certification {
  before: 'U' | 'U-A' | 'A' | 'S'
  after: 'U' | 'U-A' | 'A' | 'S'
}

export interface TabState {
  contentId?: string
  locked: boolean
  segments: Segment[]
  certification?: Certification
  overallRisk?: number
  /** Video duration in seconds (from analysis or video metadata) */
  durationSeconds?: number
  /** CBFC-style certification explanation for AI Analysis panel */
  certificationLogic?: string
  analysisCards: { title: string; body: string }[]
  historyKeys: string[]
  // Persistence fields
  file?: File | null
  url?: string
  previewUrl?: string | null
  originalUrl?: string | null
  censoredUrl?: string | null
  jobStatus?: 'idle' | 'running' | 'done' | 'error'
  progress?: number
  heatmap?: any[] // Simplified type for heatmap
  review?: Record<string, boolean>
  options?: any
}

interface UiState {
  rightPanelVisible: boolean
  bottomPanelHeight: number
  outputLogs: { ts: number; message: string; level?: 'info' | 'warn' | 'error' }[]
  restoreOttRequest: number
  theme: 'dark' | 'light'
}

interface TabContextValue {
  tabs: Record<ContentType, TabState>
  setTabState: (type: ContentType, updater: (prev: TabState) => TabState) => void
  state: UiState
  setUiState: (updater: (prev: UiState) => UiState) => void
  activeTab: ContentType
  setActiveTab: (tab: ContentType) => void
  addLog: (message: string, level?: 'info' | 'warn' | 'error') => void
  clearLogs: () => void
  triggerRestoreOtt: () => void
  resetTab: (tab: ContentType) => void
}

const TabContext = createContext<TabContextValue | null>(null)

export const TabProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const DEFAULT_OPTIONS = {
    cutClip: false,
    cutCaptions: false,
    hideCaptions: false,
    blurVideo: true,
    addBeep: true,
    muteAudio: false
  }

  const [tabs, setTabs] = useState<Record<ContentType, TabState>>({
    ott: {
      locked: false,
      segments: [],
      analysisCards: [],
      historyKeys: [],
      options: { ...DEFAULT_OPTIONS }
    },
    youtube: {
      locked: false,
      segments: [],
      analysisCards: [],
      historyKeys: [],
      options: { ...DEFAULT_OPTIONS }
    },
    music: { locked: false, segments: [], analysisCards: [], historyKeys: [] },
    social: { locked: false, segments: [], analysisCards: [], historyKeys: [] },
    docs: { locked: false, segments: [], analysisCards: [], historyKeys: [] }
  })
  const [state, setState] = useState<UiState>({
    rightPanelVisible: true,
    bottomPanelHeight: 220,
    outputLogs: [],
    restoreOttRequest: 0,
    theme: 'dark'
  })

  const triggerRestoreOtt = () => {
    setState((prev) => ({ ...prev, restoreOttRequest: Date.now() }))
  }
  const [activeTab, setActiveTab] = useState<ContentType>('ott')

  const setTabState = (type: ContentType, updater: (prev: TabState) => TabState) => {
    setTabs((prev) => ({
      ...prev,
      [type]: updater(prev[type])
    }))
  }

  const setUiState = (updater: (prev: UiState) => UiState) => {
    setState((prev) => updater(prev))
  }

  const addLog = (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    setState((prev) => ({
      ...prev,
      outputLogs: [...prev.outputLogs, { ts: Date.now(), message, level }].slice(-400)
    }))
  }

  const clearLogs = () => {
    setState((prev) => ({ ...prev, outputLogs: [] }))
  }

  const resetTab = (type: ContentType) => {
    setTabs((prev) => ({
      ...prev,
      [type]: {
        locked: false,
        segments: [],
        analysisCards: [],
        historyKeys: [],
        file: null,
        url: '',
        previewUrl: null,
        originalUrl: null,
        censoredUrl: null,
        jobStatus: 'idle',
        progress: 0,
        heatmap: [],
        review: {},
        options: { ...DEFAULT_OPTIONS }
      }
    }))
    addLog(`Reset ${type} tab.`)
  }

  return (
    <TabContext.Provider
      value={{
        tabs,
        setTabState,
        state,
        setUiState,
        activeTab,
        setActiveTab,
        addLog,
        clearLogs,
        triggerRestoreOtt,
        resetTab
      }}
    >
      {children}
    </TabContext.Provider >
  )
}

export const useTabContext = () => {
  const ctx = useContext(TabContext)
  if (!ctx) {
    throw new Error('useTabContext must be used inside TabProvider')
  }
  return ctx
}


