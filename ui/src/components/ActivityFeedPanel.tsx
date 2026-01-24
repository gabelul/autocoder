/**
 * Mission Control Activity Feed (DB-backed)
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useActivityEvents, useClearActivityEvents } from '../hooks/useActivityEvents'
import type { ActivityEvent } from '../lib/types'

type ActivityFilter = 'all' | 'agents' | 'gatekeeper' | 'qa' | 'regression' | 'errors'

function _parseTimestamp(ts: string): Date | null {
  const raw = typeof ts === 'string' ? ts.trim() : ''
  if (!raw) return null
  // SQLite CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS" (UTC). Convert to ISO.
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

function _formatTime(ts: string): string {
  const d = _parseTimestamp(ts)
  if (!d) return ''
  try {
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function _levelColor(levelRaw: string): string {
  const level = String(levelRaw || '').toUpperCase()
  if (level === 'ERROR') return 'text-red-300'
  if (level === 'WARN' || level === 'WARNING') return 'text-yellow-300'
  if (level === 'DEBUG') return 'text-gray-400'
  return 'text-blue-200'
}

function _eventGroup(ev: ActivityEvent): Exclude<ActivityFilter, 'all' | 'errors'> {
  const t = String(ev.event_type || '').toLowerCase()
  if (t.startsWith('qa.')) return 'qa'
  if (t.startsWith('gatekeeper.') || t.startsWith('preflight.')) return 'gatekeeper'
  if (t.startsWith('regression.')) return 'regression'
  return 'agents'
}

export function ActivityFeedPanel({
  projectName,
  isActive,
  onOpenFull,
  dense,
}: {
  projectName: string
  isActive?: boolean
  onOpenFull?: () => void
  dense?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const { data, isLoading, error } = useActivityEvents(projectName, {
    enabled: isActive ?? true,
    limit: 400,
    refetchInterval: 2500,
  })
  const clearMutation = useClearActivityEvents(projectName)

  const events = useMemo(() => {
    const items = (data ?? []) as ActivityEvent[]
    if (filter === 'all') return items

    if (filter === 'errors') {
      return items.filter((e) => ['ERROR', 'WARN', 'WARNING'].includes(String(e.level || '').toUpperCase()))
    }

    return items.filter((e) => _eventGroup(e) === filter)
  }, [data, filter])

  useEffect(() => {
    if (!autoScroll) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [events, autoScroll])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 60
    setAutoScroll(isAtBottom)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Mission Control</span>
          <select
            className="neo-input !w-auto !py-1 !px-2 !text-xs !font-mono"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ActivityFilter)}
            aria-label="Filter activity"
          >
            <option value="all">All</option>
            <option value="agents">Agents</option>
            <option value="gatekeeper">Gatekeeper</option>
            <option value="qa">QA</option>
            <option value="regression">Regression</option>
            <option value="errors">Errors</option>
          </select>
          {!autoScroll && (
            <span className="neo-badge bg-yellow-600 text-white">
              Paused
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onOpenFull ? (
            <button
              onClick={onOpenFull}
              className="neo-btn neo-btn-sm bg-[var(--color-neo-bg)]"
              title="Open full Mission Control"
            >
              Open
              <ExternalLink size={14} />
            </button>
          ) : null}
          <button
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
            className="neo-btn neo-btn-sm bg-[var(--color-neo-bg)]"
            title="Clear activity events"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-2 pb-2 font-mono ${dense ? 'text-xs' : 'text-sm'}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[var(--color-neo-text-secondary)]">
            Loading activity…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-[var(--color-neo-danger)]">
            {error instanceof Error ? error.message : 'Failed to load activity'}
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-neo-text-secondary)]">
            No activity yet.
          </div>
        ) : (
          <div className="space-y-0.5">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="flex gap-2 hover:bg-black/10 px-1 py-0.5 rounded"
              >
                <span className="text-[var(--color-neo-text-muted)] select-none shrink-0">
                  {_formatTime(ev.created_at)}
                </span>
                <span className={`${_levelColor(ev.level)} shrink-0`}>{String(ev.level || 'INFO').toUpperCase()}</span>
                <span className="text-[var(--color-neo-text)] whitespace-pre-wrap break-words flex-1">
                  {ev.message}
                </span>
                {ev.feature_id ? (
                  <span className="text-xs text-[var(--color-neo-text-muted)] shrink-0">#{ev.feature_id}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

