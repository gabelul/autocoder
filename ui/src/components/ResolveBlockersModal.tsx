import { useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, RefreshCw, X } from 'lucide-react'
import type { BlockerGroup, RetryBlockedRequest, RetryBlockedResponse } from '../lib/types'
import { useBlockersSummary, useRetryBlockedBulk } from '../hooks/useBlockers'

interface ResolveBlockersModalProps {
  projectName: string
  isOpen: boolean
  isAgentRunning: boolean
  maxImmediate: number
  onClose: () => void
  onPause?: () => Promise<void>
  onResume?: () => Promise<void>
  onOpenLogs: () => void
  onOpenFeature?: (featureId: number) => void
  onAfterRetry: () => void
}

function kindBadge(kind: string): { text: string; className: string } {
  if (kind === 'dependency') return { text: 'DEP', className: 'bg-[var(--color-neo-neutral-200)]' }
  if (kind === 'cycle') return { text: 'CYCLE', className: 'bg-[var(--color-neo-danger)] text-white' }
  if (kind === 'transient') return { text: 'FIXABLE', className: 'bg-[var(--color-neo-progress)] text-[var(--color-neo-text-on-bright)]' }
  return { text: 'OTHER', className: 'bg-[var(--color-neo-bg)]' }
}

export function ResolveBlockersModal({
  projectName,
  isOpen,
  isAgentRunning,
  maxImmediate,
  onClose,
  onPause,
  onResume,
  onOpenLogs,
  onOpenFeature,
  onAfterRetry,
}: ResolveBlockersModalProps) {
  const summaryQuery = useBlockersSummary(projectName)
  const retryMutation = useRetryBlockedBulk(projectName)
  const [confirmAll, setConfirmAll] = useState(false)
  const [lastRetry, setLastRetry] = useState<RetryBlockedResponse | null>(null)

  const groups = (summaryQuery.data?.groups ?? []) as BlockerGroup[]
  const recommendedGroups = useMemo(() => groups.filter((g) => g.retry_recommended), [groups])
  const blockedTotal = summaryQuery.data?.blocked_total ?? 0

  if (!isOpen) return null

  const doRetry = async (req: RetryBlockedRequest) => {
    try {
      if (isAgentRunning && onPause) await onPause()
      const res = await retryMutation.mutateAsync({
        ...req,
        max_immediate: req.max_immediate ?? maxImmediate,
        stagger_seconds: req.stagger_seconds ?? 15,
      })
      setLastRetry(res)
      onAfterRetry()
    } finally {
      if (isAgentRunning && onResume) await onResume()
    }
  }

  const headerText = summaryQuery.isLoading
    ? 'Loading blockers…'
    : summaryQuery.data
      ? `${summaryQuery.data.blocked_total} blocked`
      : 'Blockers'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="neo-card w-full max-w-4xl max-h-[90vh] overflow-hidden border-4 border-[var(--color-neo-border)] shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-[var(--color-neo-card)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 p-4 border-b-3 border-[var(--color-neo-border)]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-neo-danger)] border-3 border-[var(--color-neo-border)] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div>
                <div className="font-display font-bold uppercase tracking-wide">Resolve blockers</div>
                <div className="text-xs text-[var(--color-neo-text-secondary)]">{headerText}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="neo-btn neo-btn-secondary text-xs" onClick={onOpenLogs} title="Open Mission Control">
                Mission Control
                <ExternalLink size={14} />
              </button>
              <button className="neo-btn neo-btn-secondary text-xs" onClick={onClose} title="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
            {summaryQuery.error ? (
              <div className="neo-card p-4 border-3 border-[var(--color-neo-danger)]">
                <div className="text-sm text-[var(--color-neo-danger)]">
                  {summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Failed to load blockers'}
                </div>
              </div>
            ) : null}

            {!isAgentRunning ? (
              <div className="neo-card p-4 border-3 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
                <div className="text-sm">
                  Agent is <span className="font-display font-bold uppercase">stopped</span>. Retried features will be
                  queued, but nothing will run until you press <span className="font-mono">Run</span>.
                </div>
              </div>
            ) : null}

            {lastRetry ? (
              <div className="neo-card p-4 border-3 border-[var(--color-neo-border)] bg-[var(--color-neo-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display font-bold uppercase tracking-wide">Retries queued</div>
                    <div className="text-sm text-[var(--color-neo-text-secondary)] mt-1">
                      Requested <span className="font-mono">{lastRetry.requested}</span> • retried{' '}
                      <span className="font-mono">{lastRetry.retried}</span> • scheduled{' '}
                      <span className="font-mono">{lastRetry.scheduled}</span>
                    </div>
                  </div>
                  <button
                    className="neo-btn neo-btn-secondary text-xs"
                    onClick={() => setLastRetry(null)}
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="neo-btn neo-btn-primary text-sm"
                disabled={recommendedGroups.length === 0 || retryMutation.isPending}
                onClick={() => doRetry({ mode: 'recommended' })}
                title={recommendedGroups.length === 0 ? 'No recommended retries' : 'Retry recommended blockers'}
              >
                <RefreshCw size={16} />
                {isAgentRunning ? 'Pause & retry recommended' : 'Retry recommended'}
              </button>
              <button
                className="neo-btn neo-btn-secondary text-sm"
                disabled={blockedTotal === 0 || retryMutation.isPending}
                onClick={() => setConfirmAll(true)}
                title={blockedTotal === 0 ? 'No blocked features right now' : 'Retry every blocked feature'}
              >
                Retry all blocked
              </button>
              <span className="text-xs text-[var(--color-neo-text-secondary)]">
                Retries are staggered to avoid a stampede.
              </span>
            </div>

            {confirmAll ? (
              <div className="neo-card p-4 border-3 border-[var(--color-neo-danger)] bg-[var(--color-neo-card)]">
                <div className="font-display font-bold uppercase">Confirm retry all</div>
                <div className="text-sm text-[var(--color-neo-text-secondary)] mt-1">
                  This will retry every blocked feature. If the underlying issue isn’t fixed, it may just re-block them.
                </div>
                <div className="mt-3 flex items-center gap-2 justify-end">
                  <button className="neo-btn neo-btn-secondary text-sm" onClick={() => setConfirmAll(false)}>
                    Cancel
                  </button>
                  <button
                    className="neo-btn neo-btn-primary text-sm"
                    disabled={retryMutation.isPending}
                    onClick={async () => {
                      setConfirmAll(false)
                      await doRetry({ mode: 'all' })
                    }}
                  >
                    Retry all
                  </button>
                </div>
              </div>
            ) : null}

            {blockedTotal === 0 && !summaryQuery.isLoading && !summaryQuery.error ? (
              <div className="neo-card p-4 border-3 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
                <div className="font-display font-bold uppercase tracking-wide">No blocked features</div>
                <div className="text-sm text-[var(--color-neo-text-secondary)] mt-1">
                  If you’re seeing failures, they may be in backoff/retry (not BLOCKED). Check the Pending column and
                  Mission Control for the latest errors.
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groups.map((g) => {
                const badge = kindBadge(g.kind)
                const depIds = (g.depends_on ?? []).map((d) => d.id)
                return (
                  <div key={g.key} className="neo-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`neo-badge ${badge.className}`}>{badge.text}</span>
                          <span className="font-display font-bold line-clamp-1">{g.title}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-neo-text-secondary)] font-mono">
                          {g.count} feature(s)
                          {g.blocks_count ? ` • blocks ${g.blocks_count}` : ''}
                        </div>
                        {g.kind === 'dependency' && depIds.length > 0 ? (
                          <div className="mt-2 text-xs text-[var(--color-neo-text-secondary)]">
                            Depends on:{' '}
                            <span className="font-mono">
                              {g.depends_on
                                .slice(0, 3)
                                .map((d) => `#${d.id}${d.name ? ` ${d.name}` : ''}`)
                                .join(', ')}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        {g.retry_recommended ? (
                          <button
                            className="neo-btn neo-btn-secondary text-xs"
                            disabled={retryMutation.isPending}
                            onClick={() => doRetry({ mode: 'group', group_key: g.key })}
                            title="Retry this group"
                          >
                            Retry
                          </button>
                        ) : null}
                        {g.kind === 'dependency' && depIds.length > 0 && onOpenFeature ? (
                          <button
                            className="neo-btn neo-btn-secondary text-xs"
                            onClick={() => onOpenFeature(depIds[0])}
                            title="Open blocking feature"
                          >
                            Open blocker
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

