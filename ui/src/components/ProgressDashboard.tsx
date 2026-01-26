import { AlertTriangle, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import type { AgentStatus } from '../lib/types'
import { useState } from 'react'
import { useGitStatus } from '../hooks/useGit'
import { GitDirtyModal } from './GitDirtyModal'

interface ProgressDashboardProps {
  projectName?: string
  passing: number
  total: number
  percentage: number
  isConnected: boolean
  agentStatus?: AgentStatus
  agentActivity?: { active: number; total: number } | null
  idleDetail?: string | null
  featureCounts?: {
    staged: number
    pending: number
    in_progress: number
    done: number
    blocked: number
  }
  onResolveBlockers?: () => void
  agentBadge?: { text: string; title?: string } | null
  onAgentBadgeClick?: () => void
}

export function ProgressDashboard({
  projectName,
  passing,
  total,
  percentage,
  isConnected,
  agentStatus,
  agentActivity,
  idleDetail,
  featureCounts,
  onResolveBlockers,
  agentBadge,
  onAgentBadgeClick,
}: ProgressDashboardProps) {
  const pct = total > 0 ? Math.max(0, Math.min(100, percentage)) : 0
  const [showGitDirty, setShowGitDirty] = useState(false)
  const gitStatusQuery = useGitStatus(projectName || '')
  const gitDirty = Boolean(projectName && gitStatusQuery.data && !gitStatusQuery.data.is_clean)

  const isIdle =
    String(agentStatus || '').toLowerCase() === 'running' &&
    Boolean(agentActivity && agentActivity.total > 0 && agentActivity.active === 0)

  const statusText = (() => {
    const s = String(agentStatus || '').toLowerCase()
    if (isIdle) return 'Idle'
    if (s === 'running') return 'Running'
    if (s === 'paused') return 'Paused'
    if (s === 'crashed') return 'Crashed'
    if (s === 'stopped') return 'Stopped'
    return ''
  })()

  const statusClass = (() => {
    const s = String(agentStatus || '').toLowerCase()
    if (isIdle) return 'bg-[var(--color-neo-neutral-200)] text-[var(--color-neo-text)]'
    if (s === 'running') return 'bg-[var(--color-neo-progress)] text-[var(--color-neo-text-on-bright)]'
    if (s === 'paused') return 'bg-yellow-500 text-[var(--color-neo-text)]'
    if (s === 'crashed') return 'bg-[var(--color-neo-danger)] text-white'
    if (s === 'stopped') return 'bg-[var(--color-neo-neutral-200)] text-[var(--color-neo-text)]'
    return 'bg-[var(--color-neo-bg)] text-[var(--color-neo-text-secondary)]'
  })()

  return (
    <div className="neo-card px-4 py-3">
      {projectName ? (
        <GitDirtyModal
          projectName={projectName}
          isOpen={showGitDirty}
          onClose={() => setShowGitDirty(false)}
        />
      ) : null}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-[260px]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display font-bold uppercase tracking-wide">Progress</span>
            <span className="font-mono text-sm text-[var(--color-neo-text-secondary)]">
              {total > 0 ? `${percentage.toFixed(1)}%` : '—'}
            </span>
            <span className="text-xs text-[var(--color-neo-text-secondary)]">
              <span className="font-mono text-[var(--color-neo-done)]">{passing}</span>{' '}
              <span className="font-mono">/ {total}</span> passing
            </span>
          </div>

          <div className="neo-progress mt-2 h-3">
            <div className="neo-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {featureCounts ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="neo-badge bg-[var(--color-neo-neutral-200)]">Staged {featureCounts.staged}</span>
            <span className="neo-badge bg-[var(--color-neo-pending)] text-[var(--color-neo-text-on-bright)]">
              Pending {featureCounts.pending}
            </span>
            <span className="neo-badge bg-[var(--color-neo-progress)] text-[var(--color-neo-text-on-bright)]">
              In Progress {featureCounts.in_progress}
            </span>
            <span className="neo-badge bg-[var(--color-neo-done)] text-[var(--color-neo-text-on-bright)]">
              Done {featureCounts.done}
            </span>
            {featureCounts.blocked > 0 ? (
              onResolveBlockers ? (
                <button
                  type="button"
                  className="neo-badge bg-[var(--color-neo-danger)] text-white cursor-pointer hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-neo-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-neo-bg)]"
                  onClick={onResolveBlockers}
                  title="Open “Resolve blockers”"
                  aria-label={`Blocked ${featureCounts.blocked}. Open Resolve blockers.`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Blocked {featureCounts.blocked}</span>
                    <span className="opacity-90 underline decoration-white/70 decoration-dotted underline-offset-2">
                      Resolve
                    </span>
                    <ChevronRight size={14} />
                  </span>
                </button>
              ) : (
                <span className="neo-badge bg-[var(--color-neo-danger)] text-white">
                  Blocked {featureCounts.blocked}
                </span>
              )
            ) : null}
            {agentBadge ? (
              onAgentBadgeClick ? (
                <button
                  type="button"
                  className="neo-badge bg-[var(--color-neo-progress)] text-[var(--color-neo-text-on-bright)] cursor-pointer hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-neo-progress)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-neo-bg)]"
                  title={agentBadge.title || 'Open worker logs'}
                  onClick={onAgentBadgeClick}
                >
                  <span className="underline decoration-white/70 decoration-dotted underline-offset-2">
                    {agentBadge.text}
                  </span>
                </button>
              ) : (
                <span
                  className="neo-badge bg-[var(--color-neo-progress)] text-[var(--color-neo-text-on-bright)]"
                  title={agentBadge.title}
                >
                  {agentBadge.text}
                </span>
              )
            ) : null}
            {gitDirty ? (
              <button
                type="button"
                className="neo-badge bg-[var(--color-neo-danger)] text-white cursor-pointer hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-neo-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-neo-bg)]"
                title="Git working tree has uncommitted changes; Gatekeeper cannot merge"
                onClick={() => setShowGitDirty(true)}
              >
                Git dirty
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {statusText ? (
            <span className={`neo-badge ${statusClass}`} title={isIdle ? idleDetail || undefined : undefined}>
              {statusText}
            </span>
          ) : null}

          {isIdle && idleDetail ? (
            <span
              className="neo-badge bg-[var(--color-neo-neutral-200)] text-[var(--color-neo-text-secondary)]"
              title={idleDetail}
            >
              {idleDetail}
            </span>
          ) : null}

          <span
            className={`neo-badge ${
              isConnected
                ? 'bg-[var(--color-neo-done)] text-[var(--color-neo-text-on-bright)]'
                : 'bg-[var(--color-neo-danger)] text-white'
            }`}
            title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
          >
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5">
                <Wifi size={14} />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <WifiOff size={14} />
                Offline
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
