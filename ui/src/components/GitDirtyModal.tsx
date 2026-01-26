import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useGitStatus, useGitStash } from '../hooks/useGit'

export function GitDirtyModal({
  projectName,
  isOpen,
  onClose,
  onAfterStash,
}: {
  projectName: string
  isOpen: boolean
  onClose: () => void
  onAfterStash?: () => void
}) {
  const statusQuery = useGitStatus(projectName)
  const stash = useGitStash(projectName)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLocalError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const remaining = statusQuery.data?.remaining ?? []
  const ignored = statusQuery.data?.ignored ?? []

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="neo-card w-full max-w-3xl max-h-[90vh] overflow-hidden border-4 border-[var(--color-neo-border)] shadow-[8px_8px_0px_rgba(0,0,0,1)] bg-[var(--color-neo-card)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 p-4 border-b-3 border-[var(--color-neo-border)]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--color-neo-danger)] border-3 border-[var(--color-neo-border)] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                <AlertTriangle size={18} className="text-white" />
              </div>
              <div>
                <div className="font-display font-bold uppercase tracking-wide">Git working tree dirty</div>
                <div className="text-xs text-[var(--color-neo-text-secondary)]">
                  Parallel mode uses Git worktrees; Gatekeeper refuses merges when the main tree has uncommitted changes.
                </div>
              </div>
            </div>

            <button className="neo-btn neo-btn-secondary text-xs" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-3">
            {statusQuery.isLoading ? (
              <div className="text-sm text-[var(--color-neo-text-secondary)]">Checking git status…</div>
            ) : null}

            {localError ? (
              <div className="neo-card p-3 border-3 border-[var(--color-neo-danger)]">
                <div className="text-sm text-[var(--color-neo-danger)] whitespace-pre-wrap">{localError}</div>
              </div>
            ) : null}

            {!statusQuery.isLoading && remaining.length === 0 ? (
              <div className="neo-card p-3 border-3 border-[var(--color-neo-border)] bg-[var(--color-neo-bg)]">
                <div className="font-display font-bold uppercase">Looks clean</div>
                <div className="text-sm text-[var(--color-neo-text-secondary)] mt-1">
                  No blocking changes detected. You can close this and start the agent again.
                </div>
              </div>
            ) : null}

            {remaining.length > 0 ? (
              <div className="neo-card p-3">
                <div className="font-display font-bold uppercase text-sm">Blocking changes</div>
                <div className="text-xs text-[var(--color-neo-text-secondary)] mt-1">
                  Commit, restore, or stash these changes to unblock merges.
                </div>
                <pre className="mt-2 max-h-[38vh] overflow-auto bg-[var(--color-neo-bg)] border-3 border-[var(--color-neo-border)] p-3 text-xs font-mono whitespace-pre-wrap">
                  {remaining.join('\n')}
                </pre>
              </div>
            ) : null}

            {ignored.length > 0 ? (
              <details className="neo-card p-3">
                <summary className="cursor-pointer font-display font-bold uppercase text-sm">
                  Ignored artifacts ({ignored.length})
                </summary>
                <pre className="mt-2 max-h-[22vh] overflow-auto bg-[var(--color-neo-bg)] border-3 border-[var(--color-neo-border)] p-3 text-xs font-mono whitespace-pre-wrap">
                  {ignored.join('\n')}
                </pre>
              </details>
            ) : null}
          </div>

          <div className="p-4 border-t-3 border-[var(--color-neo-border)] flex items-center justify-between gap-2">
            <button
              className="neo-btn neo-btn-secondary text-sm"
              onClick={() => statusQuery.refetch()}
              disabled={statusQuery.isFetching}
              title="Refresh git status"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <div className="flex items-center gap-2 justify-end">
              <button className="neo-btn neo-btn-secondary text-sm" onClick={onClose}>
                Close
              </button>
              <button
                className="neo-btn neo-btn-primary text-sm"
                disabled={stash.isPending || remaining.length === 0}
                onClick={async () => {
                  setLocalError(null)
                  try {
                    await stash.mutateAsync({ include_untracked: true })
                    await statusQuery.refetch()
                    onAfterStash?.()
                  } catch (e: any) {
                    setLocalError(e instanceof Error ? e.message : String(e))
                  }
                }}
                title={remaining.length === 0 ? 'No blocking changes to stash' : 'Stash changes (reversible)'}
              >
                Stash changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

