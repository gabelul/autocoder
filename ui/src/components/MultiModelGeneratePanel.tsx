import { useEffect, useMemo, useState } from 'react'
import { Info, Loader2, Sparkles } from 'lucide-react'
import { generateArtifact } from '../lib/api'
import { useSetupStatus } from '../hooks/useProjects'
import { HelpModal } from './HelpModal'

type Kind = 'spec' | 'plan'
type HelpTopic = 'all' | 'overview' | 'kind' | 'synth' | 'agents' | 'prompt' | 'output'

export function MultiModelGeneratePanel({
  projectName,
  defaultKind = 'spec',
  onDone,
}: {
  projectName: string
  defaultKind?: Kind
  onDone?: (outputPath: string) => void
}) {
  const [kind, setKind] = useState<Kind>(defaultKind)
  const [prompt, setPrompt] = useState('')
  const [useCodex, setUseCodex] = useState(true)
  const [useGemini, setUseGemini] = useState(true)
  const [synthesizer, setSynthesizer] = useState<'' | 'none' | 'claude' | 'codex' | 'gemini'>('claude')
  const [timeoutS, setTimeoutS] = useState(300)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ output_path: string; drafts_dir: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic>('all')

  const { data: setupStatus } = useSetupStatus()

  useEffect(() => {
    if (!setupStatus) return
    if (!setupStatus.codex_cli) setUseCodex(false)
    if (!setupStatus.gemini_cli) setUseGemini(false)
    if (!setupStatus.codex_cli && synthesizer === 'codex') setSynthesizer('claude')
    if (!setupStatus.gemini_cli && synthesizer === 'gemini') setSynthesizer('claude')
  }, [setupStatus, synthesizer])

  const agentsList = useMemo(() => {
    const agents: Array<'codex' | 'gemini'> = []
    if (useCodex) agents.push('codex')
    if (useGemini) agents.push('gemini')
    return agents
  }, [useCodex, useGemini])

  const canGenerate = prompt.trim().length > 0 && (useCodex || useGemini || synthesizer === 'claude')

  const helpContent: Record<Exclude<HelpTopic, 'all'>, { title: string; body: string }> = {
    overview: {
      title: 'What “Generate” does',
      body:
        'This drafts a spec or plan using local Codex/Gemini CLIs (optional) and can synthesize the final output with Claude (default). It writes into your project’s prompts folder.',
    },
    kind: {
      title: 'Kind',
      body:
        'Choose what to generate. “spec” writes prompts/app_spec.txt. “plan” writes prompts/plan.md. Both are meant to be readable and actionable for AutoCoder.',
    },
    synth: {
      title: 'Synthesizer',
      body:
        'After agents draft, a synthesizer can merge the drafts into one clean output. Claude is the default. Set “none” to keep only drafts.',
    },
    agents: {
      title: 'Agents',
      body:
        'These are the draft engines. Codex/Gemini require their CLIs on PATH. If a CLI isn’t detected, it will be disabled/skipped.',
    },
    prompt: {
      title: 'Prompt',
      body:
        'Tell it what to produce. For best results: include the target audience, must-have pages, monetization/SEO goals, and any tech constraints.',
    },
    output: {
      title: 'Output',
      body:
        'Output is the final file path written in your project. Drafts is the folder containing raw drafts from each agent. Useful for debugging or manual merges.',
    },
  }

  const openHelp = (topic: HelpTopic) => {
    setHelpTopic(topic)
    setShowHelp(true)
  }

  const run = async () => {
    setError(null)
    setResult(null)
    setLoading(true)
    try {
    const res = await generateArtifact(projectName, {
      kind,
      prompt: prompt.trim(),
      agents: agentsList,
      synthesizer,
      timeout_s: timeoutS,
    })
      setResult(res)
      onDone?.(res.output_path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="neo-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="text-[var(--color-neo-accent)]" size={22} />
          <div>
            <div className="font-display font-bold uppercase">Multi-Model Generate</div>
            <div className="text-sm text-[var(--color-neo-text-secondary)]">
              Draft with Codex/Gemini CLIs, optionally synthesize.
            </div>
          </div>
        </div>
        <button
          className="neo-btn neo-btn-secondary text-sm"
          onClick={() => openHelp('all')}
          title="Explain Generate"
        >
          <Info size={18} />
          Help
        </button>
      </div>

      <HelpModal isOpen={showHelp} title="Generate — what this does" onClose={() => setShowHelp(false)}>
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

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="neo-card p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Kind</div>
            <button className="neo-btn neo-btn-ghost p-1" onClick={() => openHelp('kind')} title="About Kind" aria-label="About Kind">
              <Info size={16} />
            </button>
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            className="neo-btn text-sm py-2 px-3 bg-white border-3 border-[var(--color-neo-border)] font-display w-full"
          >
            <option value="spec">spec (prompts/app_spec.txt)</option>
            <option value="plan">plan (prompts/plan.md)</option>
          </select>
        </div>

        <div className="neo-card p-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Synthesizer</div>
            <button className="neo-btn neo-btn-ghost p-1" onClick={() => openHelp('synth')} title="About Synthesizer" aria-label="About Synthesizer">
              <Info size={16} />
            </button>
          </div>
          <select
            value={synthesizer}
            onChange={(e) => setSynthesizer(e.target.value as any)}
            className="neo-btn text-sm py-2 px-3 bg-white border-3 border-[var(--color-neo-border)] font-display w-full"
          >
            <option value="claude">claude (default)</option>
            <option value="none">none</option>
            <option value="codex" disabled={setupStatus ? !setupStatus.codex_cli : false}>
              codex
            </option>
            <option value="gemini" disabled={setupStatus ? !setupStatus.gemini_cli : false}>
              gemini
            </option>
          </select>
        </div>

        <div className="neo-card p-3">
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)] mb-1">Timeout (s)</div>
          <input
            type="number"
            min={30}
            max={36000}
            value={timeoutS}
            onChange={(e) => setTimeoutS(Number(e.target.value))}
            className="neo-input"
          />
        </div>
      </div>

      <div className="mt-3 neo-card p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Agents</div>
          <button className="neo-btn neo-btn-ghost p-1" onClick={() => openHelp('agents')} title="About Agents" aria-label="About Agents">
            <Info size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useCodex}
              onChange={(e) => setUseCodex(e.target.checked)}
              disabled={setupStatus ? !setupStatus.codex_cli : false}
              title={setupStatus && !setupStatus.codex_cli ? 'Codex CLI not detected on PATH' : 'Use Codex'}
            />
            <span className="font-display font-bold text-sm">Codex</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useGemini}
              onChange={(e) => setUseGemini(e.target.checked)}
              disabled={setupStatus ? !setupStatus.gemini_cli : false}
              title={setupStatus && !setupStatus.gemini_cli ? 'Gemini CLI not detected on PATH' : 'Use Gemini'}
            />
            <span className="font-display font-bold text-sm">Gemini</span>
          </label>
          <span className="text-xs text-[var(--color-neo-text-secondary)] font-mono">
            {agentsList.length ? agentsList.join(', ') : '(none)'}
          </span>
        </div>
        {setupStatus && (!setupStatus.codex_cli || !setupStatus.gemini_cli) && (
          <div className="mt-2 text-xs text-[var(--color-neo-text-secondary)] font-mono">
            Missing: {!setupStatus.codex_cli ? 'codex' : ''}{!setupStatus.codex_cli && !setupStatus.gemini_cli ? ', ' : ''}{!setupStatus.gemini_cli ? 'gemini' : ''} (will be skipped)
          </div>
        )}
      </div>

      <div className="mt-3 neo-card p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Prompt</div>
          <button className="neo-btn neo-btn-ghost p-1" onClick={() => openHelp('prompt')} title="About Prompt" aria-label="About Prompt">
            <Info size={16} />
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={kind === 'spec' ? 'Describe the project to spec…' : 'Describe what the plan should cover…'}
          className="neo-input min-h-[120px] resize-y"
        />
      </div>

      {error && (
        <div className="mt-3 neo-card p-3 border-3 border-[var(--color-neo-danger)]">
          <div className="text-sm text-[var(--color-neo-danger)] font-bold">Error</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {result && (
        <div className="mt-3 neo-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">Generated</div>
            <button className="neo-btn neo-btn-ghost p-1" onClick={() => openHelp('output')} title="About output" aria-label="About output">
              <Info size={16} />
            </button>
          </div>
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)] mt-1">Output: {result.output_path}</div>
          <div className="text-xs font-mono text-[var(--color-neo-text-secondary)]">Drafts: {result.drafts_dir}</div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          className="neo-btn neo-btn-primary text-sm"
          onClick={run}
          disabled={loading || !canGenerate}
          title={!canGenerate ? 'Provide a prompt and at least one agent (or Claude synthesis)' : 'Generate'}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          Generate
        </button>
      </div>
    </div>
  )
}
