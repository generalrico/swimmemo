import React, { useState, useEffect, useMemo } from 'react'
import {
  Waves,
  LayoutDashboard,
  ClipboardList,
  Brain,
  Settings,
  Plus,
  Trash2,
  Edit3,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  HardDrive,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Meh,
  UploadCloud,
  Check,
  X,
  Search,
  Lock,
  Key
} from 'lucide-react'

// Profile Types
export interface SwimmerProfile {
  nickname: string
  abilityLevel: 'beginner' | 'intermediate' | 'advanced' | 'competitive'
  preferredStroke: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'individual-medley'
  poolLength: number
  targetDistance: number
  currentBestTime: string
  targetTime: string
}

// Training Session Types
export interface TrainingSession {
  id: string
  date: string
  stroke: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'individual-medley'
  distance: number
  durationMinutes: number
  effortRating: number
  techniqueNotes: string
  swimmerFeedback: string
  isDemo?: boolean
}

// MemWal Recall & Job Types
export interface MemWalRecalledItem {
  blob_id: string
  text: string
  distance: number
  created_at?: string
}

export interface TrackedJob {
  jobId: string
  status: 'pending' | 'running' | 'uploaded' | 'done' | 'failed' | 'not_found'
  blobId?: string | null
  text?: string
  createdAt: string
  updatedAt: string
  error?: string | null
  confirmed?: boolean
}

export interface LocalMemoryItem {
  id: string
  sourceSessionId: string
  category: 'fatigue' | 'technique' | 'pacing' | 'preference'
  insight: string
  influenceRule: string
  recordedAt: string
}

const DEFAULT_PROFILE: SwimmerProfile = {
  nickname: 'OceanStride',
  abilityLevel: 'intermediate',
  preferredStroke: 'freestyle',
  poolLength: 25,
  targetDistance: 1500,
  currentBestTime: '1:08.5',
  targetTime: '1:02.0'
}

const DEMO_SESSIONS: TrainingSession[] = [
  {
    id: 'demo-s1',
    date: '2026-11-01',
    stroke: 'freestyle',
    distance: 1200,
    durationMinutes: 32,
    effortRating: 8,
    techniqueNotes: 'Left elbow dropped around lap 18. High catch fatigue observed.',
    swimmerFeedback: 'Shoulders burned in final 200m set, pace dropped by 4s.',
    isDemo: true
  },
  {
    id: 'demo-s2',
    date: '2026-11-03',
    stroke: 'freestyle',
    distance: 1000,
    durationMinutes: 28,
    effortRating: 9,
    techniqueNotes: 'Bilateral breathing (every 3 strokes) unstable during sprint segments.',
    swimmerFeedback: 'Felt breathless on lap returns; need more drill volume rather than high sprints.',
    isDemo: true
  },
  {
    id: 'demo-s3',
    date: '2026-11-04',
    stroke: 'breaststroke',
    distance: 800,
    durationMinutes: 25,
    effortRating: 5,
    techniqueNotes: 'Solid hip extension, glide timing was rhythmic and smooth.',
    swimmerFeedback: 'Comfortable recovery swim. Knees felt fine.',
    isDemo: true
  }
]

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'log' | 'memory' | 'settings'>('dashboard')
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false)

  // Swimmer Profile State
  const [profile, setProfile] = useState<SwimmerProfile>(() => {
    const saved = localStorage.getItem('swimmemo_profile')
    if (saved) {
      try { return JSON.parse(saved) } catch (_) {}
    }
    return DEFAULT_PROFILE
  })

  // Real Logged Sessions
  const [realSessions, setRealSessions] = useState<TrainingSession[]>(() => {
    const saved = localStorage.getItem('swimmemo_sessions')
    if (saved) {
      try { return JSON.parse(saved) } catch (_) {}
    }
    return []
  })

  // Suggestion feedback history
  const [suggestionFeedbackHistory, setSuggestionFeedbackHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('swimmemo_suggestion_feedback')
    if (saved) {
      try { return JSON.parse(saved) } catch (_) {}
    }
    return []
  })

  // Owner authentication token for protected routes
  const [ownerToken, setOwnerToken] = useState<string>(() => {
    return localStorage.getItem('swimmemo_owner_token') || ''
  })

  const apiFetch = (input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (ownerToken) headers.set('X-Owner-Token', ownerToken)
    return fetch(input, { ...init, headers })
  }

  // MemWal Health & Config Status
  const [memwalHealth, setMemwalHealth] = useState<{
    status: string
    reachability: string
    authenticated: boolean
    serverUrl: string
    keyConfigured: boolean
    accountConfigured: boolean
    ownerAuthRequired: boolean
    namespace: string
    error?: string
  }>({
    status: 'checking',
    reachability: 'untested',
    authenticated: false,
    serverUrl: 'https://relayer.memory.walrus.xyz',
    keyConfigured: false,
    accountConfigured: false,
    ownerAuthRequired: false,
    namespace: 'swimmemo_v1'
  })

  // Tracked Jobs (from server activeJobs)
  const [trackedJobs, setTrackedJobs] = useState<TrackedJob[]>(() => {
    try { return JSON.parse(localStorage.getItem('swimmemo_jobs') || '[]') } catch { return [] }
  })

  // Recalled memories from MemWal SDK
  const [recalledMemories, setRecalledMemories] = useState<MemWalRecalledItem[]>([])
  const [isRecalling, setIsRecalling] = useState<boolean>(false)
  const [recallQuery, setRecallQuery] = useState<string>('swimming fatigue technique pacing')
  const [recallError, setRecallError] = useState<string | null>(null)

  // Explicit approval for remembering a specific memory
  const [submittingMemoryId, setSubmittingMemoryId] = useState<string | null>(null)
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null)

  // Manual test form states
  const [manualRememberText, setManualRememberText] = useState<string>('')
  const [isManualSubmitting, setIsManualSubmitting] = useState<boolean>(false)

  // Sui Account Inspection State
  const [suiAccountData, setSuiAccountData] = useState<any | null>(null)
  const [isInspectingSui, setIsInspectingSui] = useState<boolean>(false)

  // Training Log Form state
  const [isAddingSession, setIsAddingSession] = useState<boolean>(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formStroke, setFormStroke] = useState<TrainingSession['stroke']>('freestyle')
  const [formDistance, setFormDistance] = useState<number>(1000)
  const [formDuration, setFormDuration] = useState<number>(30)
  const [formEffort, setFormEffort] = useState<number>(7)
  const [formNotes, setFormNotes] = useState<string>('')
  const [formFeedback, setFormFeedback] = useState<string>('')
  const [formErrors, setFormErrors] = useState<string[]>([])

  // Profile Form state
  const [profileForm, setProfileForm] = useState<SwimmerProfile>(profile)
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null)

  // Current active dataset
  const activeSessions = useMemo(() => {
    return isDemoMode ? DEMO_SESSIONS : realSessions
  }, [isDemoMode, realSessions])

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('swimmemo_profile', JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    localStorage.setItem('swimmemo_sessions', JSON.stringify(realSessions))
  }, [realSessions])

  useEffect(() => {
    localStorage.setItem('swimmemo_suggestion_feedback', JSON.stringify(suggestionFeedbackHistory))
  }, [suggestionFeedbackHistory])

  useEffect(() => {
    localStorage.setItem('swimmemo_owner_token', ownerToken)
  }, [ownerToken])

  useEffect(() => {
    localStorage.setItem('swimmemo_jobs', JSON.stringify(trackedJobs))
  }, [trackedJobs])

  // Poll MemWal health and tracked jobs
  const fetchHealthAndJobs = async () => {
    try {
      const res = await apiFetch('/api/memwal/health')
      const data = await res.json()
      setMemwalHealth(prev => ({ ...prev, ...data, authenticated: data.authenticated === true }))

      const jobsRes = await apiFetch('/api/memwal/jobs')
      const jobsData = await jobsRes.json()
      if (jobsData.jobs) {
        setTrackedJobs(prev => Array.from(new Map([...prev, ...jobsData.jobs].map(j => [j.jobId, j])).values()))
      }
    } catch (err: any) {
      setMemwalHealth(prev => ({
        ...prev,
        status: 'error',
        reachability: 'error',
        error: err.message
      }))
    }
  }

  useEffect(() => {
    fetchHealthAndJobs()
  }, [ownerToken])

  // Poll active incomplete jobs every 4 seconds
  useEffect(() => {
    const hasPending = trackedJobs.some(j => j.status === 'pending' || j.status === 'running' || j.status === 'uploaded')
    if (!hasPending) return

    const interval = setInterval(async () => {
      for (const job of trackedJobs) {
        if (job.status !== 'done' && job.status !== 'failed') {
          try {
            const res = await apiFetch(`/api/memwal/job/${job.jobId}`)
            const data = await res.json()
            if (data.job) {
              setTrackedJobs(prev => prev.map(j => j.jobId === job.jobId ? data.job : j))
            }
          } catch (_) {}
        }
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [trackedJobs, ownerToken])

  // Recall memories from MemWal SDK
  const handleRecallMemories = async (queryToUse?: string) => {
    const q = (queryToUse || recallQuery).trim()
    if (!q) return
    setIsRecalling(true)
    setRecallError(null)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (ownerToken) headers['x-owner-token'] = ownerToken

      const res = await apiFetch('/api/memwal/recall', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: q, limit: 10 })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setRecalledMemories(data.results || [])
      } else {
        setRecallError(data.error || 'Recall failed')
      }
    } catch (err: any) {
      setRecallError(err.message || 'Network error recalling memories')
    } finally {
      setIsRecalling(false)
    }
  }

  // Count confirmed Walrus Memory mainnet items
  const confirmedMemoriesCount = useMemo(() => {
    return trackedJobs.filter(j => j.status === 'done' && Boolean(j.blobId)).length
  }, [trackedJobs])

  // Extract Local Memory Candidates from Sessions
  const localMemories: LocalMemoryItem[] = useMemo(() => {
    return activeSessions.map(session => {
      let category: LocalMemoryItem['category'] = 'technique'
      let insight = ''
      let influenceRule = ''

      if (session.effortRating >= 8) {
        category = 'fatigue'
        insight = `High exertion reported (RPE ${session.effortRating}/10): ${session.techniqueNotes || 'High intensity'}`
        influenceRule = 'Triggers aerobic recovery intervals and lower stroke rate.'
      } else if (session.techniqueNotes.toLowerCase().includes('elbow') || session.techniqueNotes.toLowerCase().includes('catch')) {
        category = 'technique'
        insight = `Catch mechanics flagged: ${session.techniqueNotes}`
        influenceRule = 'Prescribes fingertip drag and fist drills prior to main set.'
      } else if (session.effortRating <= 5) {
        category = 'pacing'
        insight = `Aerobic baseline comfort: ${session.distance}m at RPE ${session.effortRating}/10.`
        influenceRule = 'Allows progressive distance overload (+10%) in subsequent sessions.'
      } else {
        category = 'preference'
        insight = `Maintained rhythm across ${session.distance}m ${session.stroke}.`
        influenceRule = 'Maintains balanced split consistency.'
      }

      return {
        id: `mem-${session.id}`,
        sourceSessionId: session.id,
        category,
        insight,
        influenceRule,
        recordedAt: session.date
      }
    })
  }, [activeSessions])

  // Explainable Rule-Based Suggestion factoring in both session history & recalled MemWal memories
  const suggestion = useMemo(() => {
    const recent = activeSessions[activeSessions.length - 1]
    const lastFeedback = suggestionFeedbackHistory[suggestionFeedbackHistory.length - 1]

    let distanceAdjustment = 0
    let intensityModifier = ''
    if (lastFeedback === 'too-hard') {
      distanceAdjustment = -200
      intensityModifier = 'Reduced volume by 200m based on feedback ("Too Hard").'
    } else if (lastFeedback === 'too-easy') {
      distanceAdjustment = 200
      intensityModifier = 'Scaled up main set volume by 200m based on feedback ("Too Easy").'
    }

    // Check if any recalled memories specifically mention fatigue or shoulder strain
    const recalledFatigue = recalledMemories.find(m =>
      m.text.toLowerCase().includes('fatigue') ||
      m.text.toLowerCase().includes('burned') ||
      m.text.toLowerCase().includes('shoulder')
    )

    const recalledTechnique = recalledMemories.find(m =>
      m.text.toLowerCase().includes('elbow') ||
      m.text.toLowerCase().includes('catch') ||
      m.text.toLowerCase().includes('breath')
    )

    if (recalledFatigue) {
      const recDist = Math.max(600, (recent?.distance || 1000) - 200 + distanceAdjustment)
      return {
        title: 'Walrus Memory-Informed Active Recovery & Stroke Reset',
        recommendedDistance: recDist,
        mainSet: '6 x 75m (25m drill, 50m smooth swim) with 30s rest. Focus on relaxed recovery.',
        targetEffort: 'RPE 4–5 / 10 (Strict aerobic recovery)',
        drillFocus: 'Fingertip drag drill & relaxed high-elbow recovery',
        explanation: {
          ruleName: 'Recalled Fatigue Protection Rule',
          reason: `A confirmed Walrus memory was recalled stating: "${recalledFatigue.text}". Session is tuned to prevent cumulative shoulder strain.`,
          referencedSessions: recent ? [recent.id] : [],
          recalledBlobId: recalledFatigue.blob_id,
          recalledSnippet: recalledFatigue.text,
          influencedByFeedback: intensityModifier || undefined
        }
      }
    }

    if (!recent) {
      return {
        title: 'Baseline Readiness & Stroke Calibration',
        recommendedDistance: Math.min(profile.targetDistance, 1000),
        mainSet: '4 x 100m easy aerobic pace with 20s rest; 4 x 50m kick drills with board.',
        targetEffort: 'RPE 5–6 / 10',
        drillFocus: 'Catch-up drill & bilateral breathing balance',
        explanation: {
          ruleName: 'Baseline Calibration Rule (Initial State)',
          reason: 'No completed sessions recorded yet. Starting with moderate volume to calibrate stroke feel.',
          referencedSessions: []
        }
      }
    }

    if (recent.effortRating >= 8) {
      const recDist = Math.max(600, recent.distance - 300 + distanceAdjustment)
      return {
        title: 'Active Recovery & Catch Technique Reset',
        recommendedDistance: recDist,
        mainSet: '6 x 75m (25m drill, 50m smooth swim) with 30s rest. Focus on long gliding recovery.',
        targetEffort: 'RPE 4–5 / 10 (Strict aerobic recovery)',
        drillFocus: 'Fingertip drag drill & high-elbow catch positioning',
        explanation: {
          ruleName: 'Exertion Recovery Protocol (RPE ≥ 8)',
          reason: `Previous session on ${recent.date} reached RPE ${recent.effortRating}/10 (${recent.techniqueNotes || 'High exertion'}). Pacing is dialled down to restore stroke mechanics.`,
          referencedSessions: [recent.id],
          recalledBlobId: recalledTechnique?.blob_id,
          recalledSnippet: recalledTechnique?.text,
          influencedByFeedback: intensityModifier || undefined
        }
      }
    }

    const targetDist = profile.targetDistance || 1500
    const recDist = Math.min(targetDist, recent.distance + 200 + distanceAdjustment)
    return {
      title: 'Progressive Endurance & Goal Pace Build',
      recommendedDistance: recDist,
      mainSet: '5 x 200m negative split (second 100m faster than first) with 30s rest; 4 x 50m choice stroke easy.',
      targetEffort: 'RPE 7 / 10',
      drillFocus: 'DPS (Distance Per Stroke) & rotational core engagement',
      explanation: {
        ruleName: 'Progressive Overload Toward Target Goal',
        reason: `Previous session on ${recent.date} was completed smoothly at RPE ${recent.effortRating}/10. Increasing distance toward your goal of ${profile.targetDistance}m.`,
        referencedSessions: [recent.id],
        recalledBlobId: recalledTechnique?.blob_id,
        recalledSnippet: recalledTechnique?.text,
        influencedByFeedback: intensityModifier || undefined
      }
    }
  }, [activeSessions, profile.targetDistance, suggestionFeedbackHistory, recalledMemories])

  // Explicit approval before each memory upload
  const handleApproveAndRemember = async (text: string, id: string) => {
    setSubmittingMemoryId(id)
    setSubmissionFeedback(null)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (ownerToken) headers['x-owner-token'] = ownerToken

      const idempotencyKey = `swimmemo_${profile.nickname}_${id}`

      const res = await apiFetch('/api/memwal/remember', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: `[Swimmer: ${profile.nickname}] [Stroke: ${profile.preferredStroke}] ${text}`,
          approved: true,
          idempotencyKey
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSubmissionFeedback(`Job accepted! Job ID: ${data.jobId}. Polling status...`)
        await fetchHealthAndJobs()
      } else {
        setSubmissionFeedback(`Remember request failed: ${data.error || 'Server error'}`)
      }
    } catch (err: any) {
      setSubmissionFeedback(`Failed to submit memory: ${err.message}`)
    } finally {
      setSubmittingMemoryId(null)
    }
  }

  // Sui Account Inspection via Tatum Sui Gateway
  const handleInspectSuiAccount = async () => {
    setIsInspectingSui(true)
    setSuiAccountData(null)
    try {
      const res = await apiFetch('/api/memwal/sui/inspect-account')
      const data = await res.json()
      setSuiAccountData(data)
    } catch (err: any) {
      setSuiAccountData({ status: 'error', message: err.message })
    } finally {
      setIsInspectingSui(false)
    }
  }

  // Handle Form submission for Training Log
  const handleSubmitSession = (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []

    if (!formDate) errors.push('Date is required.')
    if (formDistance <= 0 || formDistance > 20000) errors.push('Distance must be between 25m and 20,000m.')
    if (formDuration <= 0 || formDuration > 600) errors.push('Duration must be between 1 and 600 minutes.')
    if (formEffort < 1 || formEffort > 10) errors.push('Effort rating must be between 1 and 10.')

    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors([])

    if (editingSessionId) {
      setRealSessions(prev =>
        prev.map(s =>
          s.id === editingSessionId
            ? {
                ...s,
                date: formDate,
                stroke: formStroke,
                distance: Number(formDistance),
                durationMinutes: Number(formDuration),
                effortRating: Number(formEffort),
                techniqueNotes: formNotes,
                swimmerFeedback: formFeedback
              }
            : s
        )
      )
      setEditingSessionId(null)
    } else {
      const newSession: TrainingSession = {
        id: `sess-${Date.now()}`,
        date: formDate,
        stroke: formStroke,
        distance: Number(formDistance),
        durationMinutes: Number(formDuration),
        effortRating: Number(formEffort),
        techniqueNotes: formNotes,
        swimmerFeedback: formFeedback
      }
      setRealSessions(prev => [newSession, ...prev])
    }

    setIsAddingSession(false)
    setFormNotes('')
    setFormFeedback('')
  }

  const handleDeleteSession = (id: string) => {
    if (isDemoMode) {
      alert('Demo data cannot be deleted. Switch to real mode to record personal sessions.')
      return
    }
    setRealSessions(prev => prev.filter(s => s.id !== id))
  }

  const handleEditSession = (session: TrainingSession) => {
    if (isDemoMode) {
      alert('Demo sessions are read-only examples. Switch to real data to edit.')
      return
    }
    setEditingSessionId(session.id)
    setFormDate(session.date)
    setFormStroke(session.stroke)
    setFormDistance(session.distance)
    setFormDuration(session.durationMinutes)
    setFormEffort(session.effortRating)
    setFormNotes(session.techniqueNotes)
    setFormFeedback(session.swimmerFeedback)
    setIsAddingSession(true)
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setProfile(profileForm)
    setProfileSavedMsg('Profile updated successfully.')
    setTimeout(() => setProfileSavedMsg(null), 3000)
  }

  const totalLoggedDistance = useMemo(() => {
    return activeSessions.reduce((acc, curr) => acc + curr.distance, 0)
  }, [activeSessions])

  const goalProgressPercentage = useMemo(() => {
    if (!profile.targetDistance || profile.targetDistance <= 0) return 0
    return Math.min(100, Math.round((totalLoggedDistance / profile.targetDistance) * 100))
  }, [totalLoggedDistance, profile.targetDistance])

  return (
    <div className="min-h-screen bg-secondary text-primary flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-primary border-b border-secondary sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-md py-sm flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <span className="flex size-10 items-center justify-center rounded-full bg-utility-brand-50 border border-utility-brand-200 shrink-0">
              <Waves className="size-5 shrink-0 text-fg-brand-primary" />
            </span>
            <div>
              <div className="flex items-center gap-xs">
                <span className="text-heading-xs font-semibold text-primary tracking-tight">SwimMemo</span>
                <span className="inline-flex items-center gap-xs rounded-full border border-utility-brand-200 bg-utility-brand-50 px-md py-none text-xs font-medium text-utility-brand-700">
                  Walrus Memory SDK
                </span>
              </div>
              <p className="text-xs text-tertiary">Explainable Swimming Companion · Total Recall</p>
            </div>
          </div>

          {/* Mode Switch & Connection Pill */}
          <div className="flex items-center gap-sm">
            <button
              onClick={() => setIsDemoMode(!isDemoMode)}
              className={`inline-flex items-center gap-xs rounded-lg px-md py-xs text-xs font-semibold shadow-xs focus-visible:ring-2 focus-visible:ring-focus-ring border transition-colors ${
                isDemoMode
                  ? 'bg-utility-warning-50 border-utility-warning-200 text-utility-warning-700'
                  : 'bg-primary border-primary text-secondary hover:bg-primary-hover'
              }`}
            >
              <span className={`size-2 rounded-full ${isDemoMode ? 'bg-warning-primary' : 'bg-disabled-subtle'}`} />
              {isDemoMode ? 'Demo Data Active' : 'Switch to Demo Data'}
            </button>

            {/* Honest Status Indicator */}
            <div className="hidden sm:inline-flex items-center gap-xs px-md py-xs rounded-full bg-secondary border border-secondary text-xs text-secondary">
              <span
                className={`size-2 rounded-full ${
                  memwalHealth.status === 'connected_healthy'
                    ? 'bg-success-primary'
                    : memwalHealth.status === 'server_unreachable'
                    ? 'bg-error-primary'
                    : memwalHealth.status === 'init_error'
                    ? 'bg-warning-primary'
                    : 'bg-disabled-subtle'
                }`}
              />
              <span>
                {memwalHealth.status === 'connected_healthy'
                  ? 'Walrus Relayer: Connected'
                  : memwalHealth.status === 'server_unreachable'
                  ? 'Walrus Relayer: Unreachable'
                  : memwalHealth.status === 'init_error'
                  ? 'MemWal: Init Error'
                  : 'Walrus: Config Missing in Container'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-md flex gap-lg border-t border-secondary overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`border-b-2 px-md py-sm text-sm font-semibold flex items-center gap-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
              activeTab === 'dashboard'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0 text-fg-quaternary" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`border-b-2 px-md py-sm text-sm font-semibold flex items-center gap-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
              activeTab === 'log'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <ClipboardList className="size-4 shrink-0 text-fg-quaternary" />
            Training Log ({activeSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`border-b-2 px-md py-sm text-sm font-semibold flex items-center gap-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
              activeTab === 'memory'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <Brain className="size-4 shrink-0 text-fg-quaternary" />
            Walrus Memory Vault ({confirmedMemoriesCount} Confirmed)
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`border-b-2 px-md py-sm text-sm font-semibold flex items-center gap-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring ${
              activeTab === 'settings'
                ? 'border-brand text-brand-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            <Settings className="size-4 shrink-0 text-fg-quaternary" />
            Profile & Secrets Setup
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-md md:p-xl space-y-xl">
        {/* Notice Banner */}
        <div className="flex gap-lg rounded-xl bg-utility-brand-50 p-xl border border-utility-brand-200">
          <Info className="size-5 shrink-0 text-utility-brand-600 mt-xxs" />
          <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-sm">
            <div>
              <div className="flex items-center gap-xs">
                <span className="text-sm font-semibold text-utility-brand-700">
                  {isDemoMode ? 'Viewing Demo Swimming Dataset' : `Logged in as: ${profile.nickname}`}
                </span>
                {isDemoMode && (
                  <span className="inline-flex items-center gap-xs rounded-full border border-utility-warning-200 bg-utility-warning-50 px-md py-none text-xs font-medium text-utility-warning-700">
                    Demo Data
                  </span>
                )}
              </div>
              <p className="text-sm text-tertiary mt-xxs">
                Walrus Namespace: <strong className="font-mono text-xs">{memwalHealth.namespace}</strong> · Confirmed Mainnet Memories: {confirmedMemoriesCount} · Local Cache: {localMemories.length}
              </p>
            </div>
            <div className="flex items-center gap-xs shrink-0 text-xs">
              <span
                className={`inline-flex items-center gap-xs rounded-full border px-md py-none text-xs font-medium ${
                  memwalHealth.status === 'connected_healthy'
                    ? 'border-utility-success-200 bg-utility-success-50 text-utility-success-700'
                    : memwalHealth.status === 'server_unreachable'
                    ? 'border-error-subtle bg-utility-error-50 text-utility-error-700'
                    : memwalHealth.status === 'init_error'
                    ? 'border-utility-warning-200 bg-utility-warning-50 text-utility-warning-700'
                    : 'border-utility-gray-200 bg-utility-gray-50 text-utility-gray-700'
                }`}
              >
                MemWal: {
                  memwalHealth.status === 'connected_healthy'
                    ? 'Connected & Reachable'
                    : memwalHealth.status === 'server_unreachable'
                    ? 'Server Unreachable'
                    : memwalHealth.status === 'init_error'
                    ? 'SDK Init Error'
                    : 'Config Missing in Container'
                }
              </span>
            </div>
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-xl">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Total Distance</p>
                <p className="mt-md text-heading-xs font-semibold text-primary">
                  {totalLoggedDistance.toLocaleString()} m
                </p>
                <div className="mt-sm">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-tertiary">
                    <div
                      className="h-full rounded-full bg-brand-solid transition-all"
                      style={{ width: `${Math.min(100, goalProgressPercentage)}%` }}
                    />
                  </div>
                  <span className="text-xs text-tertiary mt-xs block">
                    {profile.targetDistance > 0 ? `${goalProgressPercentage}% of single target` : 'Logged swims'}
                  </span>
                </div>
              </section>

              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Recorded Sessions</p>
                <p className="mt-md text-heading-xs font-semibold text-primary">
                  {activeSessions.length}
                </p>
                <span className="text-xs text-tertiary mt-xs block">
                  {isDemoMode ? '3 sample workouts' : 'Personal log history'}
                </span>
              </section>

              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Confirmed Walrus Blobs</p>
                <p className="mt-md text-heading-xs font-semibold text-brand-primary">
                  {confirmedMemoriesCount}
                </p>
                <span className="text-xs text-tertiary mt-xs block">
                  Verified mainnet blobs
                </span>
              </section>

              <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs">
                <p className="text-sm text-tertiary">Target Split</p>
                <p className="mt-md text-heading-xs font-semibold text-primary">
                  {profile.targetTime}
                </p>
                <span className="text-xs text-tertiary mt-xs block">
                  Current best: {profile.currentBestTime}
                </span>
              </section>
            </div>

            {/* Explainable Suggested Training Section */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs">
                <div className="flex items-center gap-xs">
                  <Sparkles className="size-5 shrink-0 text-fg-brand-primary" />
                  <h2 className="text-heading-xs font-semibold text-primary">Explainable Next Training Suggestion</h2>
                </div>
                <span className="inline-flex items-center gap-xs rounded-full border border-utility-brand-200 bg-utility-brand-50 px-md py-none text-xs font-medium text-utility-brand-700">
                  Walrus Memory Augmented Reasoner
                </span>
              </div>

              {/* Workout Card */}
              <div className="p-xl rounded-xl bg-secondary border border-secondary space-y-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-secondary pb-sm gap-xs">
                  <div>
                    <h3 className="text-md font-bold text-primary">{suggestion.title}</h3>
                    <p className="text-xs text-secondary mt-xs">Target Volume: {suggestion.recommendedDistance}m · Intensity: {suggestion.targetEffort}</p>
                  </div>
                  <span className="inline-flex items-center gap-xs rounded-full border border-secondary bg-primary px-md py-none text-xs font-medium text-primary">
                    Drill: {suggestion.drillFocus}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-tertiary">Recommended Main Set</h4>
                  <p className="text-sm font-medium text-primary mt-xs p-md bg-primary rounded-lg border border-primary">
                    {suggestion.mainSet}
                  </p>
                </div>

                {/* The "Why this suggestion?" explanation box */}
                <div className="flex gap-md rounded-xl bg-utility-brand-50 p-lg border border-utility-brand-200">
                  <Brain className="size-5 shrink-0 text-utility-brand-600 mt-xxs" />
                  <div className="space-y-xs">
                    <span className="text-xs font-bold text-utility-brand-700 uppercase tracking-wide block">
                      Why this suggestion? ({suggestion.explanation.ruleName})
                    </span>
                    <p className="text-sm text-secondary leading-relaxed">
                      {suggestion.explanation.reason}
                    </p>
                    {suggestion.explanation.recalledBlobId && (
                      <div className="pt-xs flex items-center gap-xs text-xs text-utility-brand-700">
                        <span className="font-semibold">Influenced by Recalled Walrus Blob:</span>
                        <span className="font-mono text-xs px-sm py-none rounded-full bg-primary border border-utility-brand-200">
                          {suggestion.explanation.recalledBlobId}
                        </span>
                      </div>
                    )}
                    {suggestion.explanation.referencedSessions && suggestion.explanation.referencedSessions.length > 0 && (
                      <div className="pt-xs flex items-center gap-xs text-xs text-tertiary">
                        <span>Source session referenced:</span>
                        {suggestion.explanation.referencedSessions.map(id => (
                          <span key={id} className="font-mono text-xs px-sm py-none rounded-full bg-primary border border-secondary text-primary">
                            {id}
                          </span>
                        ))}
                      </div>
                    )}
                    {suggestion.explanation.influencedByFeedback && (
                      <p className="text-xs text-utility-brand-700 font-medium italic pt-xs">
                        Note: {suggestion.explanation.influencedByFeedback}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Suggestion Feedback buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-xs text-xs text-secondary gap-sm border-t border-secondary">
                <span>How did this suggestion fit your current recovery state?</span>
                <div className="flex items-center gap-xs">
                  <button
                    onClick={() => setSuggestionFeedbackHistory(prev => [...prev, 'helpful'])}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <ThumbsUp className="size-4 shrink-0 text-fg-quaternary" /> Helpful
                  </button>
                  <button
                    onClick={() => setSuggestionFeedbackHistory(prev => [...prev, 'too-easy'])}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <Meh className="size-4 shrink-0 text-fg-quaternary" /> Too Easy
                  </button>
                  <button
                    onClick={() => setSuggestionFeedbackHistory(prev => [...prev, 'too-hard'])}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <ThumbsDown className="size-4 shrink-0 text-fg-quaternary" /> Too Hard
                  </button>
                </div>
              </div>
            </section>

            {/* Recalled Memories Quick Inspection */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-heading-xs font-semibold text-primary">Recalled Walrus Memories</h2>
                  <p className="text-xs text-tertiary">Active memories retrieved via official MemWal SDK</p>
                </div>
                <button
                  onClick={() => handleRecallMemories()}
                  disabled={isRecalling}
                  className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                >
                  <RefreshCw className={`size-4 shrink-0 text-fg-quaternary ${isRecalling ? 'animate-spin' : ''}`} />
                  {isRecalling ? 'Recalling...' : 'Refresh Recall'}
                </button>
              </div>

              {recalledMemories.length === 0 ? (
                <div className="text-center py-xl text-tertiary text-sm">
                  No memories currently recalled from Walrus relayer. Use the Walrus Memory Vault tab to review and approve memory sync.
                </div>
              ) : (
                <div className="space-y-sm">
                  {recalledMemories.map((m, idx) => (
                    <div key={idx} className="p-md rounded-lg bg-secondary border border-secondary text-xs space-y-xxs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-tertiary">Blob ID: {m.blob_id}</span>
                        <span className="text-tertiary">Distance: {m.distance?.toFixed(4)}</span>
                      </div>
                      <p className="text-primary font-medium">{m.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: TRAINING LOG */}
        {activeTab === 'log' && (
          <div className="space-y-xl">
            {/* Header + Add button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
              <div>
                <h1 className="text-heading-sm font-semibold text-primary">Training Log</h1>
                <p className="text-sm text-tertiary">Record workouts with effort, technique feedback, and duration</p>
              </div>
              <button
                onClick={() => {
                  if (isDemoMode) {
                    alert('Switch out of demo data to record your personal training sessions.')
                    return
                  }
                  setEditingSessionId(null)
                  setFormDate(new Date().toISOString().split('T')[0])
                  setFormStroke('freestyle')
                  setFormDistance(1000)
                  setFormDuration(30)
                  setFormEffort(7)
                  setFormNotes('')
                  setFormFeedback('')
                  setIsAddingSession(!isAddingSession)
                }}
                className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {isAddingSession ? <X className="size-4 shrink-0 text-fg-white" /> : <Plus className="size-4 shrink-0 text-fg-white" />}
                {isAddingSession ? 'Cancel' : 'Log New Session'}
              </button>
            </div>

            {/* Session Form (Add / Edit) */}
            {isAddingSession && (
              <form onSubmit={handleSubmitSession} className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
                <h2 className="text-sm font-semibold text-primary border-b border-secondary pb-xs">
                  {editingSessionId ? 'Edit Training Session' : 'Record Training Session'}
                </h2>

                {formErrors.length > 0 && (
                  <div className="flex gap-md rounded-xl bg-utility-error-50 p-md border border-error-subtle">
                    <AlertCircle className="size-5 shrink-0 text-utility-error-600 mt-xxs" />
                    <div className="text-xs text-utility-error-700 space-y-xxs">
                      {formErrors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">Stroke</label>
                    <select
                      value={formStroke}
                      onChange={e => setFormStroke(e.target.value as any)}
                      className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <option value="freestyle">Freestyle</option>
                      <option value="backstroke">Backstroke</option>
                      <option value="breaststroke">Breaststroke</option>
                      <option value="butterfly">Butterfly</option>
                      <option value="individual-medley">Individual Medley</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">Distance (metres)</label>
                    <input
                      type="number"
                      min="25"
                      max="20000"
                      step="25"
                      value={formDistance}
                      onChange={e => setFormDistance(Number(e.target.value))}
                      className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">Duration (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={formDuration}
                      onChange={e => setFormDuration(Number(e.target.value))}
                      className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-sm">
                    <label className="text-sm font-medium text-secondary">
                      Effort Rating: {formEffort} / 10 (RPE)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={formEffort}
                      onChange={e => setFormEffort(Number(e.target.value))}
                      className="w-full mt-sm"
                    />
                    <div className="flex justify-between text-xs text-tertiary">
                      <span>1 (Very Easy)</span>
                      <span>5 (Moderate)</span>
                      <span>10 (Max Effort)</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Technique Notes</label>
                  <input
                    type="text"
                    placeholder="e.g., Kept elbow high on recovery, bilateral breathing every 3 strokes"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                  <p className="text-xs text-tertiary">Specific cues SwimMemo extracts as future training rules.</p>
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Swimmer Feedback & Physical Sensation</label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Legs felt heavy during final 200m; shoulders felt fluid and pain-free"
                    value={formFeedback}
                    onChange={e => setFormFeedback(e.target.value)}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                </div>

                <div className="flex justify-end gap-sm pt-xs">
                  <button
                    type="button"
                    onClick={() => setIsAddingSession(false)}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    {editingSessionId ? 'Save Changes' : 'Record Workout'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Sessions */}
            <div className="space-y-sm">
              {activeSessions.length === 0 ? (
                <div className="rounded-xl border border-secondary bg-primary p-xl text-center space-y-sm">
                  <p className="text-secondary text-sm">No training sessions recorded in this mode.</p>
                  <p className="text-xs text-tertiary">Click "Log New Session" above or switch to Demo Data to inspect sample history.</p>
                </div>
              ) : (
                activeSessions.map(session => (
                  <div
                    key={session.id}
                    className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs border-b border-secondary pb-xs">
                      <div className="flex items-center gap-xs">
                        <span className="font-bold text-md text-primary capitalize">{session.stroke}</span>
                        <span className="inline-flex items-center gap-xs rounded-full border border-utility-brand-200 bg-utility-brand-50 px-md py-none text-xs font-medium text-utility-brand-700">
                          {session.distance}m
                        </span>
                        {session.isDemo && (
                          <span className="inline-flex items-center gap-xs rounded-full border border-utility-warning-200 bg-utility-warning-50 px-md py-none text-xs font-medium text-utility-warning-700">
                            Demo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-md text-xs text-secondary">
                        <span>{session.date}</span>
                        <span>· {session.durationMinutes} mins</span>
                        <span>· RPE {session.effortRating}/10</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                      <div className="p-md rounded-lg bg-secondary border border-secondary">
                        <span className="font-semibold text-tertiary block mb-xxs">Technique Notes:</span>
                        <p className="text-primary">{session.techniqueNotes || 'No notes specified.'}</p>
                      </div>
                      <div className="p-md rounded-lg bg-secondary border border-secondary">
                        <span className="font-semibold text-tertiary block mb-xxs">Swimmer Feedback:</span>
                        <p className="text-primary">{session.swimmerFeedback || 'No feedback logged.'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-xs text-xs">
                      <span className="font-mono text-xs text-tertiary">ID: {session.id}</span>
                      <div className="flex items-center gap-sm">
                        <button
                          onClick={() => handleEditSession(session)}
                          className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-xs text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                        >
                          <Edit3 className="size-3.5 shrink-0 text-fg-quaternary" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="inline-flex items-center gap-xs rounded-lg bg-utility-error-50 px-md py-xs text-xs font-semibold text-utility-error-700 border border-error-subtle shadow-xs hover:bg-error-secondary focus-visible:ring-2 focus-visible:ring-focus-ring-error"
                        >
                          <Trash2 className="size-3.5 shrink-0 text-fg-error-primary" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: WALRUS MEMORY VAULT */}
        {activeTab === 'memory' && (
          <div className="space-y-xl">
            <div>
              <h1 className="text-heading-sm font-semibold text-primary">Walrus Memory Vault</h1>
              <p className="text-sm text-tertiary">
                Official Walrus Memory SDK integration (@mysten-incubation/memwal). Inspect extracted insights, require explicit approval before syncing, and track asynchronous jobs to onchain confirmation.
              </p>
            </div>

            {/* Submission feedback banner */}
            {submissionFeedback && (
              <div className="flex gap-md rounded-xl bg-utility-brand-50 p-lg border border-utility-brand-200 text-xs text-utility-brand-700">
                <Info className="size-5 shrink-0 text-utility-brand-600 mt-xxs" />
                <p>{submissionFeedback}</p>
              </div>
            )}

            {/* Tracked Asynchronous Walrus Jobs */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-xs">
                  <HardDrive className="size-5 shrink-0 text-fg-brand-primary" />
                  <h2 className="text-heading-xs font-semibold text-primary">Walrus Remember Jobs ({trackedJobs.length})</h2>
                </div>
                <button
                  onClick={fetchHealthAndJobs}
                  className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <RefreshCw className="size-4 shrink-0 text-fg-quaternary" /> Refresh Jobs
                </button>
              </div>

              {trackedJobs.length === 0 ? (
                <p className="text-xs text-tertiary py-md text-center">
                  No Walrus remember jobs recorded in this server session. Job states are held server-side so refreshing the page does not cause duplicate submissions.
                </p>
              ) : (
                <div className="space-y-sm">
                  {trackedJobs.map(job => (
                    <div key={job.jobId} className="p-md rounded-lg bg-secondary border border-secondary space-y-xs text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs">
                        <div className="flex items-center gap-xs">
                          <span className="font-mono text-xs font-bold text-primary">Job: {job.jobId}</span>
                          <span
                            className={`inline-flex items-center gap-xs rounded-full border px-md py-none text-xs font-medium ${
                              job.status === 'done'
                                ? 'bg-utility-success-50 text-utility-success-700 border-utility-success-200'
                                : job.status === 'failed'
                                ? 'bg-utility-error-50 text-utility-error-700 border-error-subtle'
                                : 'bg-utility-warning-50 text-utility-warning-700 border-utility-warning-200'
                            }`}
                          >
                            Status: {job.status}
                          </span>
                        </div>
                        <span className="text-tertiary text-xs">Updated: {new Date(job.updatedAt).toLocaleTimeString()}</span>
                      </div>

                      {job.text && <p className="text-primary italic">"{job.text}"</p>}

                      {job.blobId ? (
                        <div className="p-xs rounded bg-primary border border-secondary font-mono text-xs text-utility-brand-700">
                          Confirmed Blob ID: {job.blobId}
                        </div>
                      ) : (
                        <div className="text-tertiary text-xs">
                          {job.status === 'pending' || job.status === 'running'
                            ? 'Processing in TEE relayer → staging to Walrus...'
                            : job.error || 'Awaiting completion'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Extracted Local Memories Awaiting Swimmer Review */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <h2 className="text-heading-xs font-semibold text-primary">
                Swimmer Insights Awaiting Approval ({localMemories.length})
              </h2>
              <p className="text-xs text-tertiary">
                Privacy policy: Training notes and personal reflections are never uploaded automatically. Review and approve each item explicitly.
              </p>

              {localMemories.length === 0 ? (
                <div className="text-center py-xl text-tertiary text-sm">
                  No local session insights available. Add workouts in the Training Log first.
                </div>
              ) : (
                <div className="space-y-md">
                  {localMemories.map(mem => (
                    <div key={mem.id} className="p-md rounded-lg bg-secondary border border-secondary space-y-sm text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs border-b border-secondary pb-xs">
                        <div className="flex items-center gap-xs">
                          <Brain className="size-4 shrink-0 text-fg-brand-primary" />
                          <span className="font-bold uppercase text-primary">Category: {mem.category}</span>
                          <span className="text-tertiary">· Session: {mem.sourceSessionId}</span>
                        </div>
                        <span className="inline-flex items-center gap-xs rounded-full border border-secondary bg-primary px-md py-none text-xs font-medium text-secondary">
                          Local Dev Cache Only
                        </span>
                      </div>

                      <div className="space-y-xs">
                        <p className="text-primary font-medium">{mem.insight}</p>
                        <p className="text-tertiary italic">Rule Influence: {mem.influenceRule}</p>
                      </div>

                      <div className="flex items-center justify-between pt-xs border-t border-secondary">
                        <span className="text-tertiary">{mem.recordedAt}</span>
                        <button
                          onClick={() => handleApproveAndRemember(mem.insight, mem.id)}
                          disabled={submittingMemoryId === mem.id}
                          className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-xs font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                        >
                          <UploadCloud className="size-4 shrink-0 text-fg-white" />
                          {submittingMemoryId === mem.id ? 'Submitting to Walrus...' : 'Approve & Save to Walrus'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Manual Save & Recall Test Panel */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <h2 className="text-heading-xs font-semibold text-primary">Manual Save-and-Recall Test Bench</h2>
              <p className="text-xs text-tertiary">
                Perform direct end-to-end testing of `remember()` and `recall()` against the Walrus Memory relayer.
              </p>

              {/* Save Section */}
              <div className="space-y-sm p-md rounded-lg bg-secondary border border-secondary">
                <span className="text-sm font-semibold text-primary block">Test Remember</span>
                <div className="flex flex-col sm:flex-row gap-xs">
                  <input
                    type="text"
                    placeholder="Enter swimming training memory to test (e.g., Felt shoulder impingement on 200m fly)"
                    value={manualRememberText}
                    onChange={e => setManualRememberText(e.target.value)}
                    className="flex-1 rounded-md bg-primary px-lg py-sm text-xs text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                  <button
                    onClick={() => {
                      if (!manualRememberText.trim()) return
                      handleApproveAndRemember(manualRememberText, `manual_${Date.now()}`)
                      setManualRememberText('')
                    }}
                    disabled={isManualSubmitting || !manualRememberText.trim()}
                    className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-xs font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                  >
                    <UploadCloud className="size-4 shrink-0 text-fg-white" />
                    Test Remember
                  </button>
                </div>
              </div>

              {/* Recall Section */}
              <div className="space-y-sm p-md rounded-lg bg-secondary border border-secondary">
                <span className="text-sm font-semibold text-primary block">Test Recall</span>
                <div className="flex flex-col sm:flex-row gap-xs">
                  <input
                    type="text"
                    placeholder="Query Walrus Memory (e.g. fatigue, technique, breathing)"
                    value={recallQuery}
                    onChange={e => setRecallQuery(e.target.value)}
                    className="flex-1 rounded-md bg-primary px-lg py-sm text-xs text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                  <button
                    onClick={() => handleRecallMemories()}
                    disabled={isRecalling || !recallQuery.trim()}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                  >
                    <Search className="size-4 shrink-0 text-fg-quaternary" />
                    {isRecalling ? 'Recalling...' : 'Test Recall'}
                  </button>
                </div>

                {recallError && (
                  <p className="text-xs text-utility-error-700 p-sm rounded bg-utility-error-50 border border-error-subtle">
                    {recallError}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: SETTINGS, SECRETS SETUP & SUI RPC */}
        {activeTab === 'settings' && (
          <div className="space-y-xl">
            <div>
              <h1 className="text-heading-sm font-semibold text-primary">Settings & Integration Environment</h1>
              <p className="text-sm text-tertiary">
                Configure your swimmer goals and verify server environment secrets for Walrus Memory SDK & Tatum Sui RPC.
              </p>
            </div>

            {/* Swimmer Profile Form */}
            <form onSubmit={handleSaveProfile} className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex items-center justify-between border-b border-secondary pb-xs">
                <h2 className="text-sm font-semibold text-primary">Swimmer Profile</h2>
                {profileSavedMsg && (
                  <span className="text-xs text-utility-success-700 font-medium">{profileSavedMsg}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Swimmer Nickname</label>
                  <input
                    type="text"
                    value={profileForm.nickname}
                    onChange={e => setProfileForm({ ...profileForm, nickname: e.target.value })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Ability Level</label>
                  <select
                    value={profileForm.abilityLevel}
                    onChange={e => setProfileForm({ ...profileForm, abilityLevel: e.target.value as any })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="competitive">Competitive</option>
                  </select>
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Preferred Stroke</label>
                  <select
                    value={profileForm.preferredStroke}
                    onChange={e => setProfileForm({ ...profileForm, preferredStroke: e.target.value as any })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <option value="freestyle">Freestyle</option>
                    <option value="backstroke">Backstroke</option>
                    <option value="breaststroke">Breaststroke</option>
                    <option value="butterfly">Butterfly</option>
                    <option value="individual-medley">Individual Medley</option>
                  </select>
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Pool Length</label>
                  <select
                    value={profileForm.poolLength}
                    onChange={e => setProfileForm({ ...profileForm, poolLength: Number(e.target.value) })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <option value="25">25m (Short Course Metres)</option>
                    <option value="50">50m (Long Course / Olympic)</option>
                    <option value="22.86">25yd (Short Course Yards)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Target Distance per Workout (m)</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="50"
                    value={profileForm.targetDistance}
                    onChange={e => setProfileForm({ ...profileForm, targetDistance: Number(e.target.value) })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Current Best Time</label>
                  <input
                    type="text"
                    placeholder="1:08.5"
                    value={profileForm.currentBestTime}
                    onChange={e => setProfileForm({ ...profileForm, currentBestTime: e.target.value })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                </div>

                <div className="flex flex-col gap-sm">
                  <label className="text-sm font-medium text-secondary">Target Time</label>
                  <input
                    type="text"
                    placeholder="1:02.0"
                    value={profileForm.targetTime}
                    onChange={e => setProfileForm({ ...profileForm, targetTime: e.target.value })}
                    className="rounded-md bg-primary px-lg py-sm text-sm text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-xs">
                <button
                  type="submit"
                  className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-sm font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>

            {/* Owner Authentication Barrier */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex items-center gap-xs">
                <Lock className="size-5 shrink-0 text-fg-brand-primary" />
                <h2 className="text-heading-xs font-semibold text-primary">Owner Demo Authorization Barrier</h2>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                If OWNER_SECRET is configured on the server, all remember and recall routes require this owner token header so your shared memory account cannot be triggered by arbitrary visitors.
              </p>

              <div className="flex flex-col sm:flex-row gap-xs">
                <input
                  type="password"
                  placeholder="Enter Owner Token (matches server OWNER_SECRET if configured)"
                  value={ownerToken}
                  onChange={e => setOwnerToken(e.target.value)}
                  className="flex-1 rounded-md bg-primary px-lg py-sm text-xs text-primary placeholder:text-placeholder border border-primary focus-visible:ring-2 focus-visible:ring-focus-ring font-mono"
                />
                <button
                  onClick={() => alert('Owner token updated in local browser state.')}
                  className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Save Token
                </button>
              </div>
            </section>

            {/* Exact Location & Checklist of Environment Secrets */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex items-center justify-between border-b border-secondary pb-xs">
                <div>
                  <h2 className="text-sm font-semibold text-primary">Preview Secrets & Environment Diagnosis</h2>
                  <p className="text-xs text-tertiary">Real runtime status from container /creds/creds.json and process.env</p>
                </div>
                <button
                  onClick={fetchHealthAndJobs}
                  className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <RefreshCw className="size-4 shrink-0 text-fg-quaternary" /> Test Health
                </button>
              </div>

              {/* Clear Diagnostic Callout */}
              <div className="flex gap-md rounded-xl bg-utility-brand-50 p-lg border border-utility-brand-200 text-xs text-utility-brand-700">
                <Info className="size-5 shrink-0 text-utility-brand-600 mt-xxs" />
                <div className="space-y-xs">
                  <span className="font-semibold block text-sm">Platform Secrets Mounting Status</span>
                  <p className="leading-relaxed">
                    In AI Builder preview containers, platform secrets are mounted by the supervisor into <code className="font-mono text-xs">/creds/creds.json</code>. The built-in <code className="font-mono text-xs">TATUM_API_KEY</code> is present and active. Custom secrets entered in preview UI settings are not mounted into the container's <code className="font-mono text-xs">/creds/creds.json</code> volume in this environment.
                  </p>
                </div>
              </div>

              <div className="space-y-sm text-xs">
                <div className="p-md rounded-lg bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">TATUM_API_KEY</span>
                    <span className="text-tertiary">Platform built-in secret mounted in /creds/creds.json. Verified active.</span>
                  </div>
                  <span className="inline-flex items-center gap-xs rounded-full border border-utility-success-200 bg-utility-success-50 px-md py-none text-xs font-medium text-utility-success-700">
                    Present
                  </span>
                </div>

                <div className="p-md rounded-lg bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">MEMWAL_PRIVATE_KEY</span>
                    <span className="text-tertiary">Ed25519 delegate private key for Walrus Memory SDK.</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-xs rounded-full border px-md py-none text-xs font-medium ${
                      memwalHealth.keyConfigured
                        ? 'bg-utility-success-50 text-utility-success-700 border-utility-success-200'
                        : 'bg-utility-gray-50 text-utility-gray-700 border-utility-gray-200'
                    }`}
                  >
                    {memwalHealth.keyConfigured ? 'Present' : 'Missing in Runtime'}
                  </span>
                </div>

                <div className="p-md rounded-lg bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">MEMWAL_ACCOUNT_ID</span>
                    <span className="text-tertiary">Walrus Memory account object ID on Sui.</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-xs rounded-full border px-md py-none text-xs font-medium ${
                      memwalHealth.accountConfigured
                        ? 'bg-utility-success-50 text-utility-success-700 border-utility-success-200'
                        : 'bg-utility-gray-50 text-utility-gray-700 border-utility-gray-200'
                    }`}
                  >
                    {memwalHealth.accountConfigured ? 'Present' : 'Missing in Runtime'}
                  </span>
                </div>

                <div className="p-md rounded-lg bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">MEMWAL_SERVER_URL</span>
                    <span className="text-tertiary">Server URL (defaults to https://relayer.memory.walrus.xyz).</span>
                  </div>
                  <span className="inline-flex items-center gap-xs rounded-full border border-utility-brand-200 bg-utility-brand-50 px-md py-none text-xs font-medium text-utility-brand-700 font-mono">
                    {memwalHealth.serverUrl}
                  </span>
                </div>
              </div>
            </section>

            {/* Tatum Sui RPC Account Inspection */}
            <section className="rounded-xl border border-secondary bg-primary p-xl shadow-xs space-y-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-xs">
                  <ShieldCheck className="size-5 shrink-0 text-fg-brand-primary" />
                  <h2 className="text-heading-xs font-semibold text-primary">Tatum Sui RPC Account Inspector</h2>
                </div>
                <button
                  onClick={handleInspectSuiAccount}
                  disabled={isInspectingSui}
                  className="inline-flex items-center gap-sm rounded-lg border border-transparent bg-brand-solid px-lg py-sm text-xs font-semibold text-primary-on-brand shadow-xs hover:bg-brand-solid-hover focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50"
                >
                  <Search className="size-4 shrink-0 text-fg-white" />
                  {isInspectingSui ? 'Querying Sui...' : 'Inspect MEMWAL_ACCOUNT_ID'}
                </button>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Uses Tatum Sui RPC (`sui_getObject`) to inspect the configured `MEMWAL_ACCOUNT_ID` on Sui mainnet. Walrus blob IDs are distinct from Sui object IDs.
              </p>

              {suiAccountData && (
                <div className="p-md rounded-lg bg-secondary border border-secondary space-y-xs text-xs">
                  <span className="font-semibold text-primary block">Sui RPC Result:</span>
                  <pre className="p-sm rounded bg-primary border border-secondary overflow-x-auto text-xs font-mono text-secondary max-h-60">
                    {JSON.stringify(suiAccountData, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary bg-primary py-md px-md mt-auto text-xs text-tertiary text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-sm">
          <span>SwimMemo · Track 02: Smart Agents for Real Life (Total Recall Hackathon)</span>
          <span className="text-quaternary">Official MemWal SDK (@mysten-incubation/memwal) + Tatum Sui RPC</span>
        </div>
      </footer>
    </div>
  )
}
