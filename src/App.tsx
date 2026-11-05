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
  Compass,
  Award,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Meh,
  ExternalLink,
  UploadCloud,
  Check,
  X,
  Database,
  Search,
  Filter,
  Activity
} from 'lucide-react'

// Profile Types
export interface SwimmerProfile {
  nickname: string
  abilityLevel: 'beginner' | 'intermediate' | 'advanced' | 'competitive'
  preferredStroke: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'individual-medley'
  poolLength: number // 25m, 50m, 25yd
  targetDistance: number // in metres
  currentBestTime: string // e.g., "1:02.4"
  targetTime: string // e.g., "0:58.0"
}

// Training Session Types
export interface TrainingSession {
  id: string
  date: string
  stroke: 'freestyle' | 'backstroke' | 'breaststroke' | 'butterfly' | 'individual-medley'
  distance: number // metres
  durationMinutes: number
  effortRating: number // 1 to 10
  techniqueNotes: string
  swimmerFeedback: string
  isDemo?: boolean
}

// Memory Record Types
export interface MemoryEcho {
  id: string
  sourceSessionId: string
  category: 'fatigue' | 'technique' | 'pacing' | 'preference'
  insight: string
  influenceRule: string
  recordedAt: string
  syncedToWalrus: boolean
  walrusBlobId?: string
  walrusJobId?: string
  suiObjectId?: string
  status: 'LOCAL_DEV_CACHE' | 'PENDING_WALRUS' | 'CONFIRMED_MAINNET'
}

// Next Suggestion Type
export interface SuggestedTraining {
  title: string
  recommendedDistance: number
  mainSet: string
  targetEffort: string
  drillFocus: string
  explanation: {
    ruleName: string
    reason: string
    referencedSessions: string[]
    influencedByFeedback?: string
  }
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

  // Feedback received on suggestions: 'too-hard' | 'too-easy' | 'helpful'
  const [suggestionFeedbackHistory, setSuggestionFeedbackHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('swimmemo_suggestion_feedback')
    if (saved) {
      try { return JSON.parse(saved) } catch (_) {}
    }
    return []
  })

  // Walrus and Sui status from backend
  const [nodeStatus, setNodeStatus] = useState<{
    tatumApi: 'checking' | 'connected' | 'no-api-key' | 'egress-failed'
    walrusUploads: any[]
    latestSuiCheckpoint: string | null
    lastError: string | null
  }>({
    tatumApi: 'checking',
    walrusUploads: [],
    latestSuiCheckpoint: null,
    lastError: null
  })

  // Syncing and verification state
  const [isSyncingToWalrus, setIsSyncingToWalrus] = useState<boolean>(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null)
  const [suiVerificationResult, setSuiVerificationResult] = useState<any | null>(null)
  const [verifyingObjectId, setVerifyingObjectId] = useState<string>('')
  const [isVerifyingSui, setIsVerifyingSui] = useState<boolean>(false)

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

  // Save changes to localStorage (Local dev cache)
  useEffect(() => {
    localStorage.setItem('swimmemo_profile', JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    localStorage.setItem('swimmemo_sessions', JSON.stringify(realSessions))
  }, [realSessions])

  useEffect(() => {
    localStorage.setItem('swimmemo_suggestion_feedback', JSON.stringify(suggestionFeedbackHistory))
  }, [suggestionFeedbackHistory])

  // Check backend Tatum & Sui connectivity
  const checkBackendState = async () => {
    setNodeStatus(prev => ({ ...prev, tatumApi: 'checking' }))
    try {
      const statusRes = await fetch('/api/tatum/status')
      const statusData = await statusRes.json()

      const suiRes = await fetch('/api/tatum/sui/state')
      const suiData = await suiRes.json()

      const uploadsRes = await fetch('/api/tatum/storage/uploads')
      const uploadsData = await uploadsRes.json()

      setNodeStatus({
        tatumApi: statusData.status || 'no-api-key',
        walrusUploads: uploadsData.uploads || [],
        latestSuiCheckpoint: suiData.latestCheckpoint ? String(suiData.latestCheckpoint) : null,
        lastError: statusData.error || suiData.error || null
      })
    } catch (e: any) {
      setNodeStatus(prev => ({
        ...prev,
        tatumApi: 'egress-failed',
        lastError: e.message
      }))
    }
  }

  useEffect(() => {
    checkBackendState()
  }, [])

  // Generate Memory Echoes from current session history
  const memories: MemoryEcho[] = useMemo(() => {
    return activeSessions.map((session, idx) => {
      let category: MemoryEcho['category'] = 'technique'
      let insight = ''
      let influenceRule = ''

      if (session.effortRating >= 8) {
        category = 'fatigue'
        insight = `High fatigue reported (RPE ${session.effortRating}/10). Notes: "${session.techniqueNotes || 'Heavy exertion'}"`
        influenceRule = 'Triggers aerobic recovery intervals or lower stroke rate on the next session.'
      } else if (session.techniqueNotes.toLowerCase().includes('elbow') || session.techniqueNotes.toLowerCase().includes('catch')) {
        category = 'technique'
        insight = `Catch mechanics flagged: ${session.techniqueNotes}`
        influenceRule = 'Prescribes fingertip drag and fist drills before main sets.'
      } else if (session.effortRating <= 5) {
        category = 'pacing'
        insight = `Aerobic baseline comfort observed: ${session.distance}m at RPE ${session.effortRating}/10.`
        influenceRule = 'Allows progressive distance overload (+10%) in subsequent sessions.'
      } else {
        category = 'preference'
        insight = `Maintained steady pace across ${session.distance}m ${session.stroke}.`
        influenceRule = 'Calculates split consistency based on target distance.'
      }

      // Check if this memory is confirmed in Walrus uploads
      const matchUpload = nodeStatus.walrusUploads.find(u => u.filename && u.filename.includes(session.id))
      const isConfirmed = matchUpload && matchUpload.status === 'CERTIFIED'

      return {
        id: `mem-${session.id}`,
        sourceSessionId: session.id,
        category,
        insight,
        influenceRule,
        recordedAt: session.date,
        syncedToWalrus: !!matchUpload,
        walrusBlobId: matchUpload?.blobId,
        walrusJobId: matchUpload?.jobId,
        suiObjectId: matchUpload?.suiObjectId,
        status: isConfirmed ? 'CONFIRMED_MAINNET' : matchUpload ? 'PENDING_WALRUS' : 'LOCAL_DEV_CACHE'
      }
    })
  }, [activeSessions, nodeStatus.walrusUploads])

  // Count confirmed Walrus mainnet memories
  const confirmedWalrusCount = useMemo(() => {
    return memories.filter(m => m.status === 'CONFIRMED_MAINNET').length
  }, [memories])

  // Explainable Rule-Based Next Training Suggestion
  const suggestion: SuggestedTraining = useMemo(() => {
    const recent = activeSessions[activeSessions.length - 1]
    const lastFeedback = suggestionFeedbackHistory[suggestionFeedbackHistory.length - 1]

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

    // Feedback influenced adjustments
    let distanceAdjustment = 0
    let intensityModifier = ''
    if (lastFeedback === 'too-hard') {
      distanceAdjustment = -200
      intensityModifier = 'Reduced volume by 200m due to recent swimmer feedback ("Too Hard").'
    } else if (lastFeedback === 'too-easy') {
      distanceAdjustment = 200
      intensityModifier = 'Scaled up main set volume by 200m based on swimmer feedback ("Too Easy").'
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
          reason: `Previous session on ${recent.date} reached RPE ${recent.effortRating}/10 (${recent.techniqueNotes || 'High exertion'}). Pacing is dialled down to prevent shoulder strain and restore stroke mechanics.`,
          referencedSessions: [recent.id],
          influencedByFeedback: intensityModifier || undefined
        }
      }
    }

    if (recent.techniqueNotes.toLowerCase().includes('breath') || recent.techniqueNotes.toLowerCase().includes('sprint')) {
      const recDist = recent.distance + distanceAdjustment
      return {
        title: 'Hypoxic Pacing & Stroke Rhythm Set',
        recommendedDistance: recDist,
        mainSet: '8 x 50m descend 1–4, 5–8 (hold stroke count constant at 16 strokes/lap) with 20s rest.',
        targetEffort: 'RPE 6–7 / 10',
        drillFocus: 'Bilateral breathing (3-stroke cadence) and dolphin kick off every wall',
        explanation: {
          ruleName: 'Breathing Cadence Stabilization Rule',
          reason: `Addressing technique log from ${recent.date} noting breathlessness or breathing instability. Suggesting descent sets with strict stroke counts.`,
          referencedSessions: [recent.id],
          influencedByFeedback: intensityModifier || undefined
        }
      }
    }

    // Progressive overload toward target
    const targetDist = profile.targetDistance || 1500
    const recDist = Math.min(targetDist, recent.distance + 200 + distanceAdjustment)
    return {
      title: 'Progressive Endurance & Goal Pace Build',
      recommendedDistance: recDist,
      mainSet: `5 x 200m negative split (second 100m faster than first) with 30s rest; 4 x 50m choice stroke easy.`,
      targetEffort: 'RPE 7 / 10',
      drillFocus: 'DPS (Distance Per Stroke) & rotational core engagement',
      explanation: {
        ruleName: 'Progressive Overload Toward Target Goal',
        reason: `Previous session on ${recent.date} was completed smoothly at RPE ${recent.effortRating}/10. Increasing distance toward your goal of ${profile.targetDistance}m.`,
        referencedSessions: [recent.id],
        influencedByFeedback: intensityModifier || undefined
      }
    }
  }, [activeSessions, profile.targetDistance, suggestionFeedbackHistory])

  // Handle Suggestion Feedback
  const handleFeedback = (feedbackType: 'helpful' | 'too-easy' | 'too-hard') => {
    setSuggestionFeedbackHistory(prev => [...prev, feedbackType])
  }

  // Handle adding or editing a training session
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

  // Handle Profile Update
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    setProfile(profileForm)
    setProfileSavedMsg('Profile updated successfully.')
    setTimeout(() => setProfileSavedMsg(null), 3000)
  }

  // Sync Memory Snapshot to Walrus Mainnet via Tatum API
  const handleSyncToWalrus = async (memory: MemoryEcho) => {
    setIsSyncingToWalrus(true)
    setSyncStatusMsg(`Staging memory ${memory.id} to Walrus Decentralized Storage...`)

    const payload = {
      app: 'SwimMemo',
      track: 'Track 02: Smart Agents for Real Life (Total Recall)',
      version: '1.0.0',
      memoryEcho: memory,
      swimmerProfileNickname: profile.nickname,
      targetGoal: `${profile.targetDistance}m @ ${profile.targetTime}`,
      timestamp: new Date().toISOString()
    }

    try {
      const res = await fetch('/api/tatum/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `swimmemo-${memory.sourceSessionId}.json`,
          memoryPayload: payload
        })
      })

      const result = await res.json()
      if (res.ok && result.success) {
        setSyncStatusMsg(`Uploaded to Walrus worker! Pre-computed Blob ID: ${result.data?.blobId || 'staged'}. Job ID: ${result.data?.jobId}`)
        await checkBackendState()
      } else {
        setSyncStatusMsg(`Walrus sync failed: ${result.message || 'API error'}`)
      }
    } catch (err: any) {
      setSyncStatusMsg(`Network error during Walrus upload: ${err.message}`)
    } finally {
      setIsSyncingToWalrus(false)
    }
  }

  // Verify Sui Onchain Object via Tatum Sui Gateway
  const handleVerifySuiObject = async (objectId: string) => {
    if (!objectId) return
    setIsVerifyingSui(true)
    setSuiVerificationResult(null)
    try {
      const res = await fetch('/api/tatum/sui/verify-object', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectId: objectId.trim(), network: 'mainnet' })
      })
      const data = await res.json()
      setSuiVerificationResult(data)
    } catch (err: any) {
      setSuiVerificationResult({ status: 'error', message: err.message })
    } finally {
      setIsVerifyingSui(false)
    }
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
                  Total Recall · Track 02
                </span>
              </div>
              <p className="text-xs text-tertiary">Smart Training Agent for Real Life</p>
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
                  nodeStatus.tatumApi === 'connected'
                    ? 'bg-success-primary'
                    : nodeStatus.tatumApi === 'checking'
                    ? 'bg-warning-primary'
                    : 'bg-disabled-subtle'
                }`}
              />
              <span>
                {nodeStatus.tatumApi === 'connected'
                  ? 'Tatum Sui & Walrus: Connected'
                  : nodeStatus.tatumApi === 'checking'
                  ? 'Connecting...'
                  : nodeStatus.tatumApi === 'no-api-key'
                  ? 'Local Dev Fallback (No Key)'
                  : 'Connection Error'}
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
            Memory Vault ({confirmedWalrusCount} Walrus Mainnet)
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
            Profile & Integrations
          </button>
        </div>
      </header>

      {/* Main Content */}
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
                    Sample Data
                  </span>
                )}
              </div>
              <p className="text-sm text-tertiary mt-xxs">
                Target: {profile.targetDistance}m ({profile.preferredStroke}) · Best: {profile.currentBestTime} · Goal: {profile.targetTime}.
                Memories are private and never uploaded automatically.
              </p>
            </div>
            <div className="flex items-center gap-xs shrink-0 text-xs">
              <span className="inline-flex items-center gap-xs rounded-full border border-utility-brand-200 bg-utility-brand-50 px-md py-none text-xs font-medium text-utility-brand-700">
                Walrus: {confirmedWalrusCount}
              </span>
              <span className="inline-flex items-center gap-xs rounded-full border border-secondary bg-primary px-md py-none text-xs font-medium text-secondary">
                Cache: {memories.length}
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
                <p className="text-sm text-tertiary">Memory Echoes</p>
                <p className="mt-md text-heading-xs font-semibold text-brand-primary">
                  {memories.length}
                </p>
                <span className="text-xs text-tertiary mt-xs block">
                  Cross-visit training clues
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
                  Transparent Rule-Based Reasoner
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

                {/* The "Why this suggestion?" transparent explanation box */}
                <div className="flex gap-md rounded-xl bg-utility-brand-50 p-lg border border-utility-brand-200">
                  <Brain className="size-5 shrink-0 text-utility-brand-600 mt-xxs" />
                  <div className="space-y-xs">
                    <span className="text-xs font-bold text-utility-brand-700 uppercase tracking-wide block">
                      Why this suggestion? ({suggestion.explanation.ruleName})
                    </span>
                    <p className="text-sm text-secondary leading-relaxed">
                      {suggestion.explanation.reason}
                    </p>
                    {suggestion.explanation.referencedSessions.length > 0 && (
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
                    onClick={() => handleFeedback('helpful')}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <ThumbsUp className="size-4 shrink-0 text-fg-quaternary" /> Helpful
                  </button>
                  <button
                    onClick={() => handleFeedback('too-easy')}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <Meh className="size-4 shrink-0 text-fg-quaternary" /> Too Easy
                  </button>
                  <button
                    onClick={() => handleFeedback('too-hard')}
                    className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-xs font-semibold text-secondary border border-primary shadow-xs hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
                  >
                    <ThumbsDown className="size-4 shrink-0 text-fg-quaternary" /> Too Hard
                  </button>
                </div>
              </div>
            </section>

            {/* Recent Sessions Overview */}
            <div className="p-xl rounded-xl bg-primary border border-secondary shadow-xs space-y-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-heading-xs font-semibold text-primary">Recent Sessions</h2>
                  <p className="text-xs text-tertiary">Workouts recorded in your current view</p>
                </div>
                <button
                  onClick={() => setActiveTab('log')}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-xs font-medium"
                >
                  View full training log <ArrowRight className="w-3.5 h-3.5 text-fg-brand-primary" />
                </button>
              </div>

              {activeSessions.length === 0 ? (
                <div className="text-center py-xl text-tertiary text-sm">
                  No sessions recorded yet. Switch to demo mode or record your first workout in the Training Log.
                </div>
              ) : (
                <div className="space-y-sm">
                  {activeSessions.slice(0, 3).map(session => (
                    <div
                      key={session.id}
                      className="p-md rounded-lg bg-secondary border border-secondary flex flex-col md:flex-row md:items-center justify-between gap-sm"
                    >
                      <div className="space-y-xxs">
                        <div className="flex items-center gap-xs">
                          <span className="text-sm font-bold text-primary capitalize">{session.stroke}</span>
                          <span className="text-xs text-tertiary">· {session.date}</span>
                          <span className="text-xs px-xs rounded bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 font-medium">
                            {session.distance}m
                          </span>
                        </div>
                        <p className="text-xs text-secondary line-clamp-1">
                          Technique: {session.techniqueNotes || 'No notes'}
                        </p>
                      </div>
                      <div className="flex items-center gap-md shrink-0">
                        <span className="text-xs text-tertiary">
                          Effort: <strong className="text-primary">{session.effortRating}/10</strong>
                        </span>
                        <span className="text-xs text-tertiary">
                          Duration: <strong className="text-primary">{session.durationMinutes} min</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TRAINING LOG */}
        {activeTab === 'log' && (
          <div className="space-y-xl">
            {/* Header + Add button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
              <div>
                <h1 className="text-heading-sm font-bold text-primary">Training Log</h1>
                <p className="text-xs text-tertiary">Record workouts with effort, technique feedback, and duration</p>
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
                className="px-md py-sm rounded-md bg-brand-solid text-primary-on-brand font-medium text-sm flex items-center justify-center gap-xs hover:bg-brand-solid-hover transition-colors"
              >
                {isAddingSession ? <X className="w-4 h-4 text-fg-white" /> : <Plus className="w-4 h-4 text-fg-white" />}
                {isAddingSession ? 'Cancel' : 'Log New Session'}
              </button>
            </div>

            {/* Session Form (Add / Edit) */}
            {isAddingSession && (
              <form onSubmit={handleSubmitSession} className="p-xl rounded-xl bg-primary border border-secondary shadow-xs space-y-md">
                <h2 className="text-sm font-bold text-primary border-b border-secondary pb-xs">
                  {editingSessionId ? 'Edit Training Session' : 'Record Training Session'}
                </h2>

                {formErrors.length > 0 && (
                  <div className="p-sm rounded bg-utility-error-50 border border-error-subtle text-utility-error-700 text-xs space-y-xxs">
                    {formErrors.map((err, i) => (
                      <p key={i}>• {err}</p>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-xs">Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-xs">Stroke</label>
                    <select
                      value={formStroke}
                      onChange={e => setFormStroke(e.target.value as any)}
                      className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                    >
                      <option value="freestyle">Freestyle</option>
                      <option value="backstroke">Backstroke</option>
                      <option value="breaststroke">Breaststroke</option>
                      <option value="butterfly">Butterfly</option>
                      <option value="individual-medley">Individual Medley</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-xs">Distance (metres)</label>
                    <input
                      type="number"
                      min="25"
                      max="20000"
                      step="25"
                      value={formDistance}
                      onChange={e => setFormDistance(Number(e.target.value))}
                      className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-xs">Duration (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="600"
                      value={formDuration}
                      onChange={e => setFormDuration(Number(e.target.value))}
                      className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-secondary mb-xs">
                      Effort Rating: {formEffort} / 10 (RPE)
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={formEffort}
                      onChange={e => setFormEffort(Number(e.target.value))}
                      className="w-full mt-xs"
                    />
                    <div className="flex justify-between text-xs text-tertiary">
                      <span>1 (Very Easy)</span>
                      <span>5 (Moderate)</span>
                      <span>10 (Max Effort)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-xs">Technique Notes</label>
                  <input
                    type="text"
                    placeholder="e.g., Kept elbow high on recovery, bilateral breathing every 3 strokes"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-secondary mb-xs">Swimmer Feedback & Physical Sensation</label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Legs felt heavy during final 200m; shoulders felt fluid and pain-free"
                    value={formFeedback}
                    onChange={e => setFormFeedback(e.target.value)}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  />
                </div>

                <div className="flex justify-end gap-sm pt-xs">
                  <button
                    type="button"
                    onClick={() => setIsAddingSession(false)}
                    className="px-md py-xs rounded border border-secondary bg-primary text-secondary text-sm hover:text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-md py-xs rounded bg-brand-solid text-primary-on-brand font-medium text-sm hover:bg-brand-solid-hover"
                  >
                    {editingSessionId ? 'Save Changes' : 'Record Workout'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Sessions */}
            <div className="space-y-sm">
              {activeSessions.length === 0 ? (
                <div className="p-xl rounded-xl bg-primary border border-secondary text-center space-y-sm">
                  <p className="text-secondary text-sm">No training sessions recorded in this mode.</p>
                  <p className="text-xs text-tertiary">Click "Log New Session" above or switch to Demo Data to inspect sample history.</p>
                </div>
              ) : (
                activeSessions.map(session => (
                  <div
                    key={session.id}
                    className="p-md md:p-lg rounded-xl bg-primary border border-secondary shadow-xs space-y-sm transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs border-b border-secondary pb-xs">
                      <div className="flex items-center gap-xs">
                        <span className="font-bold text-md text-primary capitalize">{session.stroke}</span>
                        <span className="text-xs px-xs rounded bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700 font-medium">
                          {session.distance}m
                        </span>
                        {session.isDemo && (
                          <span className="text-xs px-xs rounded bg-utility-warning-50 border border-utility-warning-200 text-utility-warning-700 font-medium">
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
                      <div className="p-sm rounded bg-secondary border border-secondary">
                        <span className="font-semibold text-tertiary block mb-xxs">Technique Notes:</span>
                        <p className="text-primary">{session.techniqueNotes || 'No notes specified.'}</p>
                      </div>
                      <div className="p-sm rounded bg-secondary border border-secondary">
                        <span className="font-semibold text-tertiary block mb-xxs">Swimmer Feedback:</span>
                        <p className="text-primary">{session.swimmerFeedback || 'No feedback logged.'}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-xs text-xs">
                      <div className="flex items-center gap-xs text-tertiary">
                        <span className="font-mono text-xs">ID: {session.id}</span>
                      </div>
                      <div className="flex items-center gap-sm">
                        <button
                          onClick={() => handleEditSession(session)}
                          className="px-sm py-xxs rounded border border-secondary text-secondary hover:text-primary flex items-center gap-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-fg-quaternary" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="px-sm py-xxs rounded border border-error-subtle text-utility-error-700 bg-utility-error-50 hover:bg-error-secondary flex items-center gap-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-fg-error-primary" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MEMORY VAULT & WALRUS SYNC */}
        {activeTab === 'memory' && (
          <div className="space-y-xl">
            <div>
              <h1 className="text-heading-sm font-bold text-primary">Swimmer Memory Vault</h1>
              <p className="text-xs text-tertiary">
                Total Recall Agent Memory: inspect what the app remembers, how each memory influences training recommendations, and synchronize to Walrus Decentralized Storage.
              </p>
            </div>

            {/* Walrus Connection Summary Banner */}
            <div className="p-md rounded-xl bg-primary border border-secondary shadow-xs space-y-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
                <div className="flex items-center gap-xs">
                  <HardDrive className="w-5 h-5 text-fg-brand-primary" />
                  <h3 className="text-sm font-bold text-primary">Walrus Decentralized Memory Protocol</h3>
                </div>
                <div className="flex items-center gap-xs">
                  <span
                    className={`text-xs px-sm py-xs rounded font-medium border ${
                      nodeStatus.tatumApi === 'connected'
                        ? 'bg-utility-success-50 text-utility-success-700 border-utility-success-200'
                        : 'bg-utility-gray-50 text-utility-gray-700 border-utility-gray-200'
                    }`}
                  >
                    {nodeStatus.tatumApi === 'connected' ? 'Walrus Gateway Ready' : 'Local Development Fallback'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Swimmer memories are stored in your browser's private local state by default. Never uploaded automatically.
                When you choose to publish an anonymized memory snapshot to Walrus mainnet, it receives an immutable content Blob ID certified on-chain.
              </p>
              {syncStatusMsg && (
                <div className="p-sm rounded bg-utility-brand-50 border border-utility-brand-200 text-xs text-utility-brand-700 mt-xs">
                  {syncStatusMsg}
                </div>
              )}
            </div>

            {/* List of Extracted Memories */}
            <div className="space-y-md">
              <h2 className="text-sm font-bold text-primary">Extracted Training Memories ({memories.length})</h2>

              {memories.length === 0 ? (
                <div className="p-xl rounded-xl bg-primary border border-secondary text-center text-secondary text-sm">
                  No memories generated yet. Log swimming sessions to allow SwimMemo to form training memories.
                </div>
              ) : (
                memories.map(mem => (
                  <div key={mem.id} className="p-md md:p-lg rounded-xl bg-primary border border-secondary shadow-xs space-y-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-xs border-b border-secondary pb-xs">
                      <div className="flex items-center gap-xs">
                        <Brain className="w-4 h-4 text-fg-brand-primary" />
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">
                          Memory: {mem.category}
                        </span>
                        <span className="text-xs px-xs rounded bg-secondary border border-secondary text-secondary">
                          Session: {mem.sourceSessionId}
                        </span>
                      </div>
                      <div className="flex items-center gap-xs">
                        <span
                          className={`text-xs px-sm py-xxs rounded font-medium border ${
                            mem.status === 'CONFIRMED_MAINNET'
                              ? 'bg-utility-success-50 text-utility-success-700 border-utility-success-200'
                              : mem.status === 'PENDING_WALRUS'
                              ? 'bg-utility-warning-50 text-utility-warning-700 border-utility-warning-200'
                              : 'bg-utility-gray-50 text-utility-gray-700 border-utility-gray-200'
                          }`}
                        >
                          {mem.status === 'CONFIRMED_MAINNET'
                            ? 'Confirmed Walrus Mainnet'
                            : mem.status === 'PENDING_WALRUS'
                            ? 'Staged in Walrus Queue'
                            : 'Local Browser Cache'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-xs text-xs">
                      <div className="p-sm rounded bg-secondary border border-secondary">
                        <span className="font-semibold text-tertiary block mb-xxs">Extracted Insight:</span>
                        <p className="text-primary">{mem.insight}</p>
                      </div>

                      <div className="p-sm rounded bg-utility-brand-50 border border-utility-brand-200 text-utility-brand-700">
                        <span className="font-semibold block mb-xxs">Influence on Future Suggestions:</span>
                        <p>{mem.influenceRule}</p>
                      </div>
                    </div>

                    {/* Walrus details if exists */}
                    {mem.walrusBlobId && (
                      <div className="p-xs rounded bg-secondary border border-secondary text-xs font-mono text-secondary space-y-xxs">
                        <div>Blob ID: {mem.walrusBlobId}</div>
                        {mem.suiObjectId && <div>Sui Object ID: {mem.suiObjectId}</div>}
                      </div>
                    )}

                    {/* Review and Sync button */}
                    <div className="flex items-center justify-between pt-xs border-t border-secondary">
                      <span className="text-xs text-tertiary">Recorded: {mem.recordedAt}</span>
                      <button
                        onClick={() => handleSyncToWalrus(mem)}
                        disabled={isSyncingToWalrus}
                        className="px-sm py-xs rounded bg-brand-solid text-primary-on-brand hover:bg-brand-solid-hover text-xs font-medium flex items-center gap-xs transition-colors disabled:opacity-50"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-fg-white" />
                        {isSyncingToWalrus ? 'Staging...' : 'Review & Publish to Walrus'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sui Verification Tool */}
            <div className="p-xl rounded-xl bg-primary border border-secondary shadow-xs space-y-md">
              <div className="flex items-center gap-xs">
                <ShieldCheck className="w-5 h-5 text-fg-brand-primary" />
                <h3 className="text-heading-xs font-semibold text-primary">Tatum Sui RPC Onchain Object Verifier</h3>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Verify any on-chain Walrus Blob or metadata object registered on Sui network using the server-side Tatum Sui RPC Gateway.
              </p>

              <div className="flex flex-col sm:flex-row gap-xs">
                <input
                  type="text"
                  placeholder="Enter Sui Object ID (e.g. 0x1b520353e191083dccad671db585525365e6f5bf70fcf63c7dd8e088ec5c57b6)"
                  value={verifyingObjectId}
                  onChange={e => setVerifyingObjectId(e.target.value)}
                  className="flex-1 px-sm py-xs rounded border border-secondary bg-primary text-primary text-xs font-mono focus:ring-focus-ring"
                />
                <button
                  onClick={() => handleVerifySuiObject(verifyingObjectId)}
                  disabled={isVerifyingSui || !verifyingObjectId.trim()}
                  className="px-md py-xs rounded bg-brand-solid text-primary-on-brand hover:bg-brand-solid-hover text-xs font-medium flex items-center justify-center gap-xs disabled:opacity-50"
                >
                  {isVerifyingSui ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-fg-white" /> : <Search className="w-3.5 h-3.5 text-fg-white" />}
                  Verify on Sui
                </button>
              </div>

              {suiVerificationResult && (
                <div className="p-md rounded-lg bg-secondary border border-secondary space-y-xs text-xs">
                  <div className="flex items-center justify-between border-b border-secondary pb-xs">
                    <span className="font-semibold text-primary">Sui Gateway Verification Result:</span>
                    <span className="text-xs px-xs rounded bg-primary border border-secondary font-mono">
                      Status: {suiVerificationResult.status}
                    </span>
                  </div>
                  <pre className="p-sm rounded bg-primary border border-secondary overflow-x-auto text-xs font-mono text-secondary max-h-48">
                    {JSON.stringify(suiVerificationResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS & SWIMMER PROFILE */}
        {activeTab === 'settings' && (
          <div className="space-y-xl">
            <div>
              <h1 className="text-heading-sm font-bold text-primary">Swimmer Profile & Node Connectivity</h1>
              <p className="text-xs text-tertiary">Configure target goals, pool dimensions, and review integration health</p>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile} className="p-xl rounded-xl bg-primary border border-secondary shadow-xs space-y-md">
              <div className="flex items-center justify-between border-b border-secondary pb-xs">
                <h2 className="text-sm font-bold text-primary">Swimmer Profile</h2>
                {profileSavedMsg && (
                  <span className="text-xs text-utility-success-700 font-medium">{profileSavedMsg}</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-md text-xs">
                <div>
                  <label className="block font-medium text-secondary mb-xs">Swimmer Nickname</label>
                  <input
                    type="text"
                    value={profileForm.nickname}
                    onChange={e => setProfileForm({ ...profileForm, nickname: e.target.value })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  />
                </div>

                <div>
                  <label className="block font-medium text-secondary mb-xs">Ability Level</label>
                  <select
                    value={profileForm.abilityLevel}
                    onChange={e => setProfileForm({ ...profileForm, abilityLevel: e.target.value as any })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  >
                    <option value="beginner">Beginner (learning fundamentals)</option>
                    <option value="intermediate">Intermediate (consistent lap swimmer)</option>
                    <option value="advanced">Advanced (masters/club training)</option>
                    <option value="competitive">Competitive (sprint / distance racer)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-secondary mb-xs">Preferred Stroke</label>
                  <select
                    value={profileForm.preferredStroke}
                    onChange={e => setProfileForm({ ...profileForm, preferredStroke: e.target.value as any })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  >
                    <option value="freestyle">Freestyle</option>
                    <option value="backstroke">Backstroke</option>
                    <option value="breaststroke">Breaststroke</option>
                    <option value="butterfly">Butterfly</option>
                    <option value="individual-medley">Individual Medley</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-secondary mb-xs">Pool Length (metres / yards)</label>
                  <select
                    value={profileForm.poolLength}
                    onChange={e => setProfileForm({ ...profileForm, poolLength: Number(e.target.value) })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  >
                    <option value="25">25m (Short Course Metres)</option>
                    <option value="50">50m (Long Course / Olympic)</option>
                    <option value="22.86">25yd (Short Course Yards)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-secondary mb-xs">Target Distance per Workout (m)</label>
                  <input
                    type="number"
                    min="100"
                    max="10000"
                    step="50"
                    value={profileForm.targetDistance}
                    onChange={e => setProfileForm({ ...profileForm, targetDistance: Number(e.target.value) })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  />
                </div>

                <div>
                  <label className="block font-medium text-secondary mb-xs">Current Best Time (e.g., 100m split)</label>
                  <input
                    type="text"
                    placeholder="1:08.5"
                    value={profileForm.currentBestTime}
                    onChange={e => setProfileForm({ ...profileForm, currentBestTime: e.target.value })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  />
                </div>

                <div>
                  <label className="block font-medium text-secondary mb-xs">Target Time (Goal split)</label>
                  <input
                    type="text"
                    placeholder="1:02.0"
                    value={profileForm.targetTime}
                    onChange={e => setProfileForm({ ...profileForm, targetTime: e.target.value })}
                    className="w-full px-sm py-xs rounded border border-secondary bg-primary text-primary text-sm focus:ring-focus-ring"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-xs">
                <button
                  type="submit"
                  className="px-lg py-xs rounded bg-brand-solid text-primary-on-brand font-medium text-sm hover:bg-brand-solid-hover"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>

            {/* Infrastructure & Node Details */}
            <div className="p-xl rounded-xl bg-primary border border-secondary shadow-xs space-y-md">
              <div className="flex items-center justify-between border-b border-secondary pb-xs">
                <div>
                  <h2 className="text-sm font-bold text-primary">Integration Architecture Status</h2>
                  <p className="text-xs text-tertiary">Server-side credentials & connectivity checklist</p>
                </div>
                <button
                  onClick={checkBackendState}
                  className="px-sm py-xs rounded border border-secondary bg-primary text-secondary hover:text-primary text-xs flex items-center gap-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-fg-quaternary" /> Refresh Status
                </button>
              </div>

              <div className="space-y-sm text-xs">
                <div className="p-sm rounded bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">Tatum API Key (Server Environment)</span>
                    <span className="text-tertiary">Injected securely on server via TATUM_API_KEY. Never exposed to browser.</span>
                  </div>
                  <span
                    className={`px-sm py-xxs rounded font-medium ${
                      nodeStatus.tatumApi === 'connected'
                        ? 'bg-utility-success-50 text-utility-success-700'
                        : 'bg-utility-warning-50 text-utility-warning-700'
                    }`}
                  >
                    {nodeStatus.tatumApi === 'connected' ? 'Configured & Active' : 'Not Set in Env'}
                  </span>
                </div>

                <div className="p-sm rounded bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">Walrus Storage API (/v4/data/storage)</span>
                    <span className="text-tertiary">Mainnet decentralized blob storage with asynchronous worker certification.</span>
                  </div>
                  <span className="px-sm py-xxs rounded bg-utility-brand-50 text-utility-brand-700 font-medium">
                    {nodeStatus.walrusUploads.length} Active Records
                  </span>
                </div>

                <div className="p-sm rounded bg-secondary border border-secondary flex items-start justify-between">
                  <div>
                    <span className="font-semibold text-primary block">Tatum Sui RPC Gateway</span>
                    <span className="text-tertiary">Sui JSON-RPC gateway for on-chain state & checkpoint verification.</span>
                  </div>
                  <span className="px-sm py-xxs rounded bg-utility-gray-50 text-utility-gray-700 font-mono text-xs">
                    {nodeStatus.latestSuiCheckpoint ? `Checkpoint: ${nodeStatus.latestSuiCheckpoint}` : 'Standby / RPC Ready'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-secondary bg-primary py-md px-md mt-auto text-xs text-tertiary text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-sm">
          <span>SwimMemo · Track 02: Smart Agents for Real Life (Total Recall Hackathon)</span>
          <span className="text-quaternary">Walrus Decentralized Storage + Tatum Sui RPC Integration</span>
        </div>
      </footer>
    </div>
  )
}
