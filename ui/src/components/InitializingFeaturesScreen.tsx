import { Loader2, Terminal, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'

export function InitializingFeaturesScreen({
  logs,
  isConnected,
  onOpenLogs,
  status = 'running',
  onRestart,
  error,
}: {
  logs: Array<{ line: string; timestamp: string }>
  isConnected: boolean
  onOpenLogs: () => void
  status?: 'running' | 'crashed'
  onRestart?: () => void
  error?: string | null
}) {
  const tail = logs.slice(-25)

  return (
    <div className="neo-card p-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {status === 'crashed' ? (
              <AlertTriangle size={22} className="text-[var(--color-neo-danger)]" />
            ) : (
              <Loader2 size={22} className="animate-spin text-[var(--color-neo-progress)]" />
            )}
            <h3 className="font-display font-bold text-xl">
              {status === 'crashed' ? 'Initialization crashed' : 'Initializing Features…'}
            </h3>
            <span
              className={`neo-badge ${
                status === 'crashed'
                  ? 'bg-[var(--color-neo-danger)] text-white'
                  : isConnected
                    ? 'bg-[var(--color-neo-done)] text-black'
                    : 'bg-[var(--color-neo-pending)] text-black'
              }`}
              title={status === 'crashed' ? 'The run crashed before any features were created' : (isConnected ? 'WebSocket connected' : 'Reconnecting…')}
            >
              {status === 'crashed' ? 'Crashed' : isConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
          <p className="text-[var(--color-neo-text-secondary)]">
            {status === 'crashed'
              ? 'The run crashed before creating any features. Check the log tail, then restart the run.'
              : 'Reading your spec and generating the initial backlog. You can watch the live log, or open the full logs drawer.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status === 'crashed' && (
            <button
              type="button"
              onClick={onRestart}
              disabled={!onRestart}
              className="neo-btn neo-btn-success text-sm flex items-center gap-2"
              title="Restart run"
            >
              <RefreshCw size={16} />
              Restart
            </button>
          )}
          <button
            type="button"
            onClick={onOpenLogs}
            className="neo-btn neo-btn-secondary text-sm flex items-center gap-2"
            title="Open logs drawer"
          >
            <Terminal size={16} />
            Open logs
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 p-3 border-3 border-[var(--color-neo-error-border)] bg-[var(--color-neo-error-bg)] text-[var(--color-neo-error-text)]">
          <div className="font-display font-bold text-sm uppercase mb-1">Start failed</div>
          <div className="text-sm whitespace-pre-wrap break-words">{error}</div>
        </div>
      ) : null}

      <div className="mt-6 border-3 border-[var(--color-neo-border)] bg-white">
        <div className="px-4 py-3 border-b-3 border-[var(--color-neo-border)] bg-[var(--color-neo-neutral-100)]">
          <div className="font-display font-bold text-sm uppercase">Live log (tail)</div>
        </div>
        <div className="p-4 max-h-[380px] overflow-auto">
          {tail.length === 0 ? (
            <div className="text-sm text-[var(--color-neo-text-secondary)]">Waiting for log output…</div>
          ) : (
            <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
              {tail
                .map((l) => {
                  const ts = (l.timestamp || '').replace('T', ' ').replace('Z', '')
                  return ts ? `[${ts}] ${l.line}` : l.line
                })
                .join('\n')}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
