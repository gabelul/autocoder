import { Wifi, WifiOff } from 'lucide-react'
import type { AgentStatus } from '../lib/types'

interface ProgressDashboardProps {
  passing: number
  total: number
  percentage: number
  isConnected: boolean
  agentStatus?: AgentStatus
  featureCounts?: {
    staged: number
    pending: number
    in_progress: number
    done: number
    blocked: number
  }
  onResolveBlockers?: () => void
}

export function ProgressDashboard({
  passing,
  total,
  percentage,
  isConnected,
  agentStatus,
  featureCounts,
  onResolveBlockers,
}: ProgressDashboardProps) {
  const pct = total > 0 ? Math.max(0, Math.min(100, percentage)) : 0

  const statusText = (() => {
    const s = String(agentStatus || '').toLowerCase()
    if (s === 'running') return 'Running'
    if (s === 'paused') return 'Paused'
    if (s === 'crashed') return 'Crashed'
    if (s === 'stopped') return 'Stopped'
    return ''
  })()

  const statusClass = (() => {
    const s = String(agentStatus || '').toLowerCase()
    if (s === 'running') return 'bg-[var(--color-neo-progress)] text-[var(--color-neo-text-on-bright)]'
    if (s === 'paused') return 'bg-yellow-500 text-[var(--color-neo-text)]'
    if (s === 'crashed') return 'bg-[var(--color-neo-danger)] text-white'
    if (s === 'stopped') return 'bg-[var(--color-neo-neutral-200)] text-[var(--color-neo-text)]'
    return 'bg-[var(--color-neo-bg)] text-[var(--color-neo-text-secondary)]'
  })()

  return (
    <div className="neo-card px-4 py-3">
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
                  className="neo-badge bg-[var(--color-neo-danger)] text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-neo-danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-neo-bg)]"
                  onClick={onResolveBlockers}
                  title="Resolve blocked features"
                >
                  Blocked {featureCounts.blocked}
                </button>
              ) : (
                <span className="neo-badge bg-[var(--color-neo-danger)] text-white">
                  Blocked {featureCounts.blocked}
                </span>
              )
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {statusText ? (
            <span className={`neo-badge ${statusClass}`}>{statusText}</span>
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
