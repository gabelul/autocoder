import { Play, Pause, Square, Loader2, Zap, Users, AlertTriangle, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStartAgent, useStopAgent, usePauseAgent, useResumeAgent } from '../hooks/useProjects'
import type { AgentStatus } from '../lib/types'
import { GitDirtyModal } from './GitDirtyModal'

export type RunMode = 'standard' | 'parallel'
export type ParallelPreset = 'quality' | 'balanced' | 'economy' | 'cheap' | 'experimental' | 'custom'

interface AgentControlProps {
  projectName: string
  status: AgentStatus
  setupRequired?: boolean
  onOpenLogs?: () => void
  onForceStandardMode?: () => void

  // Current running mode (from server status)
  yoloMode?: boolean
  parallelMode?: boolean
  parallelCount?: number | null
  modelPreset?: string | null

  // Next-run settings (local UI state)
  yoloEnabled: boolean
  onToggleYolo: () => void
  runMode: RunMode
  parallelCountSetting: number
  parallelPresetSetting: ParallelPreset
}

export function AgentControl({
  projectName,
  status,
  setupRequired = false,
  onOpenLogs,
  onForceStandardMode,
  yoloMode = false,
  parallelMode = false,
  parallelCount = null,
  modelPreset = null,
  yoloEnabled,
  onToggleYolo,
  runMode,
  parallelCountSetting,
  parallelPresetSetting,
}: AgentControlProps) {
  const startAgent = useStartAgent(projectName)
  const stopAgent = useStopAgent(projectName)
  const pauseAgent = usePauseAgent(projectName)
  const resumeAgent = useResumeAgent(projectName)
  const [lastError, setLastError] = useState<string | null>(null)
  const [showGitDirty, setShowGitDirty] = useState(false)

  const isLoading = startAgent.isPending || stopAgent.isPending || pauseAgent.isPending || resumeAgent.isPending
  const startDisabled = Boolean(isLoading || setupRequired)

  const isParallelGitError = useMemo(() => {
    if (!lastError) return false
    return runMode === 'parallel' && /not a git repository/i.test(lastError)
  }, [lastError, runMode])

  const handleStart = () => {
    setLastError(null)

    const onError = (e: unknown) => {
      const anyErr: any = e as any
      const detail = anyErr?.detail
      if (detail && typeof detail === 'object' && (detail as any).error === 'git_dirty') {
        setShowGitDirty(true)
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      setLastError(msg)
    }

    if (yoloEnabled) {
      startAgent.mutate({ yolo_mode: true, parallel_mode: false }, { onError })
      return
    }

    if (runMode === 'parallel') {
      startAgent.mutate(
        {
          parallel_mode: true,
          parallel_count: parallelCountSetting,
          model_preset: parallelPresetSetting,
          yolo_mode: false,
        },
        { onError }
      )
      return
    }

    startAgent.mutate({ yolo_mode: false, parallel_mode: false }, { onError })
  }

  const handleStop = () => {
    setLastError(null)
    stopAgent.mutate(undefined, {
      onError: (e) => setLastError(e instanceof Error ? e.message : String(e)),
    })
  }
  const handlePause = () => {
    setLastError(null)
    pauseAgent.mutate(undefined, {
      onError: (e) => setLastError(e instanceof Error ? e.message : String(e)),
    })
  }
  const handleResume = () => {
    setLastError(null)
    resumeAgent.mutate(undefined, {
      onError: (e) => setLastError(e instanceof Error ? e.message : String(e)),
    })
  }

  const startTitle = yoloEnabled
    ? 'Start (YOLO)'
    : runMode === 'parallel'
      ? `Start (${parallelCountSetting} agents, ${parallelPresetSetting})`
      : 'Start'

  return (
    <div className="relative flex items-center gap-2">
      <StatusIndicator status={status} />

      <GitDirtyModal
        projectName={projectName}
        isOpen={showGitDirty}
        onClose={() => setShowGitDirty(false)}
        onAfterStash={async () => {
          // After stashing, immediately retry the start with the same settings.
          setShowGitDirty(false)
          handleStart()
        }}
      />

      {(status === 'running' || status === 'paused') && (
        <>
          {yoloMode && (
            <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-neo-pending)] border-3 border-[var(--color-neo-border)]">
              <Zap size={14} className="text-yellow-900" />
              <span className="font-display font-bold text-xs uppercase text-yellow-900">YOLO</span>
            </div>
          )}

          {parallelMode && (
            <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-neo-progress)] border-3 border-[var(--color-neo-border)]">
              <Users size={14} className="text-cyan-900" />
              <span className="font-display font-bold text-xs uppercase text-cyan-900">
                {parallelCount}x {modelPreset}
              </span>
            </div>
          )}
        </>
      )}

      <div className="flex gap-1">
        {status === 'stopped' || status === 'crashed' ? (
          <>
            {/* YOLO toggle stays in header for quick access */}
            <button
              onClick={onToggleYolo}
              disabled={isLoading}
              className={`neo-btn text-sm py-2 px-3 ${yoloEnabled ? 'neo-btn-warning' : 'neo-btn-secondary'}`}
              title="YOLO Mode: Skip testing for rapid prototyping"
            >
              <Zap size={18} className={yoloEnabled ? 'text-yellow-900' : ''} />
            </button>

            <button
              onClick={handleStart}
              disabled={startDisabled}
              className="neo-btn neo-btn-success text-sm py-2 px-3"
              title={setupRequired ? 'Project setup required: create prompts/app_spec.txt first' : startTitle}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            </button>
          </>
        ) : status === 'running' ? (
          <>
            <button
              onClick={handlePause}
              disabled={isLoading}
              className="neo-btn neo-btn-warning text-sm py-2 px-3"
              title="Pause"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Pause size={18} />}
            </button>
            <button onClick={handleStop} disabled={isLoading} className="neo-btn neo-btn-danger text-sm py-2 px-3" title="Stop">
              <Square size={18} />
            </button>
          </>
        ) : status === 'paused' ? (
          <>
            <button
              onClick={handleResume}
              disabled={isLoading}
              className="neo-btn neo-btn-success text-sm py-2 px-3"
              title="Resume"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            </button>
            <button onClick={handleStop} disabled={isLoading} className="neo-btn neo-btn-danger text-sm py-2 px-3" title="Stop">
              <Square size={18} />
            </button>
          </>
        ) : null}
      </div>

      {lastError ? (
        <div className="absolute top-full right-0 mt-2 w-[min(520px,calc(100vw-24px))] z-[var(--z-toast)]">
          <div className="neo-card p-4 border-3 border-[var(--color-neo-danger)] bg-[var(--color-neo-card)] shadow-[6px_6px_0px_rgba(0,0,0,1)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[var(--color-neo-danger)]" />
                  <div className="font-display font-bold uppercase tracking-wide text-sm">Start failed</div>
                </div>
                <div className="mt-1 text-sm text-[var(--color-neo-text-secondary)] whitespace-pre-wrap break-words">
                  {lastError}
                </div>
                {isParallelGitError ? (
                  <div className="mt-2 text-xs text-[var(--color-neo-text-secondary)]">
                    Parallel mode uses Git worktrees. Initialize Git in the project folder, or switch to Standard mode.
                  </div>
                ) : null}
              </div>

              <button className="neo-btn neo-btn-secondary text-xs" onClick={() => setLastError(null)} title="Dismiss">
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 justify-end">
              {isParallelGitError && onForceStandardMode ? (
                <button
                  className="neo-btn neo-btn-secondary text-xs"
                  onClick={() => {
                    onForceStandardMode()
                  }}
                  title="Switch to Standard mode"
                >
                  Use Standard mode
                </button>
              ) : null}
              {onOpenLogs ? (
                <button className="neo-btn neo-btn-secondary text-xs" onClick={onOpenLogs} title="Open logs">
                  Open logs
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatusIndicator({ status }: { status: AgentStatus }) {
  const statusConfig = {
    stopped: { color: 'var(--color-neo-text-secondary)', label: 'Stopped', pulse: false },
    running: { color: 'var(--color-neo-done)', label: 'Running', pulse: true },
    paused: { color: 'var(--color-neo-pending)', label: 'Paused', pulse: false },
    crashed: { color: 'var(--color-neo-danger)', label: 'Crashed', pulse: true },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-3 border-[var(--color-neo-border)]">
      <span className={`w-3 h-3 rounded-full ${config.pulse ? 'animate-pulse' : ''}`} style={{ backgroundColor: config.color }} />
      <span className="font-display font-bold text-sm uppercase" style={{ color: config.color }}>
        {config.label}
      </span>
    </div>
  )
}
