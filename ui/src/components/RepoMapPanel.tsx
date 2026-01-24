import { useMemo, useState } from 'react'
import { Info, Loader2, Map, RefreshCw } from 'lucide-react'
import { useSetupStatus } from '../hooks/useProjects'
import { useRepoMapStatus, useRepoMapToKnowledge } from '../hooks/useRepoMap'
import { HelpModal } from './HelpModal'

type HelpTopic = 'all' | 'overview' | 'status' | 'overwrite' | 'timeout' | 'model' | 'output'

export function RepoMapPanel({ projectName }: { projectName: string }) {
  const statusQuery = useRepoMapStatus(projectName)
  const run = useRepoMapToKnowledge(projectName)
  const { data: setup } = useSetupStatus()

  const [overwrite, setOverwrite] = useState(true)
  const [timeoutS, setTimeoutS] = useState(900)
  const [model, setModel] = useState('')

  const [showHelp, setShowHelp] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic>('all')

  const hasAuth = useMemo(() => {
    if (!setup) return true // allow attempt; backend will return a helpful error
    return Boolean(setup.credentials || setup.env_auth || setup.custom_api)
  }, [setup])

  const canRun = hasAuth && !run.isPending

  const helpContent: Record<Exclude<HelpTopic, 'all'>, { title: string; body: string }> = {
    overview: {
      title: 'What Map repo → knowledge/ does',
      body:
        'Generates a codebase map (stack, architecture, structure, conventions, testing, concerns, integrations) as Markdown files under `knowledge/`. AutoCoder injects these into prompts automatically so agents can work on existing repos without guessing.',
    },
    status: {
      title: 'Status check',
      body:
        'Shows which generated `knowledge/codebase_*.md` files already exist. You can regenerate to refresh them after major refactors.',
    },
    overwrite: {
      title: 'Overwrite',
      body:
        'When enabled (recommended), generation overwrites the `knowledge/codebase_*.md` files. Keep custom notes in separate `knowledge/*.md` files so they’re not overwritten.',
    },
    timeout: {
      title: 'Timeout',
      body:
        'Hard cap for the mapping call (seconds). If the repo is large or the model is slow, increase this.',
    },
    model: {
      title: 'Model override',
      body:
        'Optional. Leave blank to use the project’s best available Claude model. Set a full model id if you want to force a specific one.',
    },
    output: {
      title: 'Output',
      body:
        'Writes files under `knowledge/` and saves raw artifacts under `.autocoder/generate/repo_map/` for debugging.',
    },
  }

  const openHelp = (topic: HelpTopic) => {
    setHelpTopic(topic)
    setShowHelp(true)
  }

  return (
    <div className="neo-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Map className="text-[var(--color-neo-accent)]" size={22} />
          <div>
            <div className="font-display font-bold uppercase">Map repo → knowledge/</div>
            <div className="text-sm text-[var(--color-neo-text-secondary)]">
              Generate <code>knowledge/codebase_*.md</code> to onboard existing projects.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="neo-btn neo-btn-secondary text-sm" onClick={() => openHelp('all')} title="Explain mapping">
            <Info size={18} />
            Help
          </button>
          <button
            className="neo-btn neo-btn-secondary text-sm"
            onClick={() => statusQuery.refetch()}
            disabled={statusQuery.isFetching}
            title="Refresh"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      <HelpModal isOpen={showHelp} title="Map repo → knowledge/ — what this does" onClose={() => setShowHelp(false)}>
        <div className="space-y-4 text-sm">
          {helpTopic !== 'all' && (
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">
                Tip: click other ⓘ icons for section-specific help.
              </div>
              <button className="neo-btn neo-btn-secondary text-sm" onClick={() => setHelpTopic('all')}>
                Show all
              </button>
            </div>
          )}

          {helpTopic === 'all' ? (
            <div className="space-y-5">
              {(Object.keys(helpContent) as Array<Exclude<HelpTopic, 'all'>>).map((key) => (
                <div key={key} className="neo-card p-3 bg-[var(--color-neo-bg)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display font-bold uppercase">{helpContent[key].title}</div>
                    <button className="neo-btn neo-btn-secondary text-sm" onClick={() => setHelpTopic(key)}>
                      Details
                    </button>
                  </div>
                  <div className="text-[var(--color-neo-text-secondary)] mt-1">{helpContent[key].body}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="neo-card p-4 bg-[var(--color-neo-bg)]">
              <div className="font-display font-bold uppercase">{helpContent[helpTopic].title}</div>
              <div className="text-[var(--color-neo-text-secondary)] mt-2">{helpContent[helpTopic].body}</div>
            </div>
          )}
        </div>
      </HelpModal>

      <div className="mt-4 neo-card p-3">
        {statusQuery.isLoading ? (
          <div className="text-sm text-[var(--color-neo-text-secondary)]">Checking mapping status…</div>
        ) : statusQuery.data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">
                Knowledge dir: {statusQuery.data.knowledge_dir}
              </div>
              <button
                className="neo-btn neo-btn-ghost p-1"
                onClick={() => openHelp('status')}
                title="About status"
                aria-label="About status"
              >
                <Info size={16} />
              </button>
            </div>
            {statusQuery.data.missing.length > 0 ? (
              <div className="text-sm">
                <div className="font-bold text-[var(--color-neo-text-secondary)]">Missing generated files</div>
                <div className="text-xs font-mono mt-1">{statusQuery.data.missing.join(', ')}</div>
              </div>
            ) : (
              <div className="text-sm">
                <div className="font-bold text-[var(--color-neo-progress)]">Ready</div>
                <div className="text-xs font-mono mt-1">
                  Found: {statusQuery.data.present.length ? statusQuery.data.present.join(', ') : '(none)'}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-[var(--color-neo-danger)]">Failed to check mapping status.</div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="neo-card p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Overwrite</div>
            <button
              className="neo-btn neo-btn-ghost p-1"
              onClick={() => openHelp('overwrite')}
              title="About overwrite"
              aria-label="About overwrite"
            >
              <Info size={16} />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
            Overwrite <code>knowledge/codebase_*.md</code>
          </label>
        </div>

        <div className="neo-card p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Timeout (s)</div>
            <button
              className="neo-btn neo-btn-ghost p-1"
              onClick={() => openHelp('timeout')}
              title="About timeout"
              aria-label="About timeout"
            >
              <Info size={16} />
            </button>
          </div>
          <input
            type="number"
            min={30}
            max={36000}
            value={timeoutS}
            onChange={(e) => setTimeoutS(Number(e.target.value))}
            className="neo-input"
          />
        </div>

        <div className="neo-card p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Model</div>
            <button className="neo-btn neo-btn-ghost p-1" onClick={() => openHelp('model')} title="About model" aria-label="About model">
              <Info size={16} />
            </button>
          </div>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="(auto)"
            className="neo-input"
          />
        </div>
      </div>

      {!hasAuth && (
        <div className="mt-3 text-sm text-[var(--color-neo-danger)]">
          Claude credentials not detected. Run <code>claude login</code> or set API env vars, then refresh.
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          className="neo-btn neo-btn-primary text-sm flex items-center gap-2"
          onClick={() =>
            run.mutate({
              overwrite,
              timeout_s: timeoutS,
              model: model.trim(),
            })
          }
          disabled={!canRun}
          title={canRun ? 'Generate knowledge/codebase_*.md' : 'Claude auth required'}
        >
          {run.isPending ? <Loader2 className="animate-spin" size={18} /> : null}
          Generate repo map
        </button>

        <button className="neo-btn neo-btn-secondary text-sm" onClick={() => openHelp('output')} title="What gets written">
          Output
        </button>
      </div>

      {run.isError && (
        <div className="mt-3 neo-card p-3 bg-[var(--color-neo-bg)]">
          <div className="text-sm font-bold text-[var(--color-neo-danger)]">Generation failed</div>
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)] mt-1">{String(run.error)}</div>
        </div>
      )}

      {run.data && (
        <div className="mt-3 neo-card p-3 bg-[var(--color-neo-bg)]">
          <div className="text-sm font-bold text-[var(--color-neo-progress)]">Generated</div>
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)] mt-1">
            Model: {run.data.model || '(unknown)'}
          </div>
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)] mt-1">
            Artifacts: {run.data.artifacts_dir || '(unknown)'}
          </div>
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)] mt-1">
            Files: {run.data.files?.length ? run.data.files.length : 0}
          </div>
        </div>
      )}
    </div>
  )
}

