/**
 * New Project Modal Component
 *
 * Multi-step modal for creating new projects:
 * 1. Enter project name
 * 2. Select project folder
 * 3. Choose spec method (Claude or manual)
 * 4a. If Claude: Show SpecCreationChat
 * 4b. If manual: Create project and close
 */

import { useState } from 'react'
import { X, Bot, FileEdit, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Folder, Settings2 } from 'lucide-react'
import { useCreateProject, useProjects } from '../hooks/useProjects'
import { SpecCreationChat } from './SpecCreationChat'
import { FolderBrowser } from './FolderBrowser'
import {
  getAutocoderYaml,
  startAgent,
  updateAutocoderYaml,
  updateEngineSettings,
  updateProjectRunDefaults,
  updateProjectRuntimeSettings,
} from '../lib/api'
import { InlineNotice, type InlineNoticeType } from './InlineNotice'
import type { EngineId, EngineSettings } from '../lib/types'

type InitializerStatus = 'idle' | 'starting' | 'error'

type Step = 'name' | 'folder' | 'setup' | 'method' | 'chat' | 'complete'
type SpecMethod = 'claude' | 'manual'
type SetupLevel = 'fast' | 'advanced'
type RunMode = 'standard' | 'parallel'
type ParallelPreset = 'quality' | 'balanced' | 'economy' | 'cheap' | 'experimental' | 'custom'
type EnginePreset = 'claude_only' | 'hybrid'

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (projectName: string) => void
  onStepChange?: (step: Step) => void
}

export function NewProjectModal({
  isOpen,
  onClose,
  onProjectCreated,
  onStepChange,
}: NewProjectModalProps) {
  const [step, setStep] = useState<Step>('name')
  const [setupLevel, setSetupLevel] = useState<SetupLevel>('fast')
  const [projectName, setProjectName] = useState('')
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [_specMethod, setSpecMethod] = useState<SpecMethod | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [resultNotice, setResultNotice] = useState<{ type: InlineNoticeType; message: string } | null>(null)
  const [initializerStatus, setInitializerStatus] = useState<InitializerStatus>('idle')
  const [initializerError, setInitializerError] = useState<string | null>(null)
  const [yoloModeSelected, setYoloModeSelected] = useState(false)
  const [initAutocoderYaml, setInitAutocoderYaml] = useState(true)
  const [configSource, setConfigSource] = useState<'template' | 'copy'>('template')
  const [copyFromProject, setCopyFromProject] = useState('')
  const [runMode, setRunMode] = useState<RunMode>('standard')
  const [parallelCount, setParallelCount] = useState(3)
  const [parallelPreset, setParallelPreset] = useState<ParallelPreset>('balanced')
  const [enginePreset, setEnginePreset] = useState<EnginePreset>('claude_only')
  const [plannerRequired, setPlannerRequired] = useState(true)
  const [stopWhenDone, setStopWhenDone] = useState(true)
  const [requireGatekeeper, setRequireGatekeeper] = useState(true)

  // Suppress unused variable warning - specMethod may be used in future
  void _specMethod

  const createProject = useCreateProject()
  const projectsQ = useProjects()

  if (!isOpen) return null

  const setStepAndNotify = (next: Step) => {
    setStep(next)
    onStepChange?.(next)
  }

  const normalizeProjectName = (name: string): string => {
    const trimmed = name.trim().toLowerCase()
    const replaced = trimmed.replace(/[^a-z0-9_-]+/gi, '-')
    const collapsed = replaced.replace(/[-_]{2,}/g, '-')
    const stripped = collapsed.replace(/^[-_]+|[-_]+$/g, '')
    return stripped.slice(0, 50)
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = normalizeProjectName(projectName)

    if (!normalized) {
      setError('Please enter a project name')
      return
    }

    setError(null)
    if (normalized !== projectName.trim()) {
      setNotice(`Normalized to "${normalized}" for filesystem-safe naming.`)
    } else {
      setNotice(null)
    }
    setProjectName(normalized)
    setStepAndNotify('folder')
  }

  const handleFolderSelect = (path: string) => {
    // Append project name to the selected path
    const fullPath = path.endsWith('/') ? `${path}${projectName.trim()}` : `${path}/${projectName.trim()}`
    setProjectPath(fullPath)
    setStepAndNotify('setup')
  }

  const handleFolderCancel = () => {
    setStepAndNotify('name')
  }

  const buildAutocoderYamlTemplate = (): string =>
    [
      '# autocoder.yaml',
      '# Project-level AutoCoder defaults.',
      '#',
      '# If preset/commands are omitted, Gatekeeper will infer a preset and synthesize',
      '# deterministic verification commands.',
      '#',
      '# Engines for workers/QA/review/spec are configured per project in Settings → Engines.',
      '',
      '# preset: node-npm',
      '# commands:',
      '#   test:',
      '#     command: "npm test"',
      '#',
      '# review:',
      '#   enabled: true',
      '#   mode: gate',
      '#   consensus: majority',
      '#   engines: [claude_review, codex_cli, gemini_cli]',
      '#',
      '# security:',
      '#   strict: false  # true = ignore project overrides',
      '#   allow_commands:',
      '#     - "pnpm"',
      '#     - "poetry"',
      '',
    ].join('\n')

  const buildEngineSettingsPreset = (preset: EnginePreset): EngineSettings => {
    const claudeOnly: EngineSettings = {
      version: 2,
      chains: {
        implement: { enabled: true, max_iterations: 2, engines: ['claude_patch'] },
        qa_fix: { enabled: true, max_iterations: 2, engines: ['claude_patch'] },
        review: { enabled: true, max_iterations: 1, engines: ['claude_review'] },
        spec_draft: { enabled: true, max_iterations: 1, engines: ['claude_spec'] },
        spec_synthesize: { enabled: true, max_iterations: 1, engines: ['claude_spec'] },
        initializer: { enabled: true, max_iterations: 1, engines: ['claude_spec'] },
      },
    }
    if (preset === 'claude_only') return claudeOnly

    const append = (engines: EngineId[], extra: EngineId[]) => {
      const next: EngineId[] = []
      for (const e of [...engines, ...extra]) {
        if (!next.includes(e)) next.push(e)
      }
      return next
    }

    const extras: EngineId[] = ['codex_cli', 'gemini_cli']
    return {
      ...claudeOnly,
      chains: {
        ...claudeOnly.chains,
        implement: { ...claudeOnly.chains.implement, engines: append(claudeOnly.chains.implement.engines, extras) },
        qa_fix: { ...claudeOnly.chains.qa_fix, engines: append(claudeOnly.chains.qa_fix.engines, extras) },
        review: { ...claudeOnly.chains.review, engines: append(claudeOnly.chains.review.engines, extras) },
        spec_draft: { ...claudeOnly.chains.spec_draft, engines: append(claudeOnly.chains.spec_draft.engines, extras) },
        initializer: { ...claudeOnly.chains.initializer, engines: append(claudeOnly.chains.initializer.engines, extras) },
      },
    }
  }

  const maybeApplyWizardSettings = async (name: string) => {
    // Always apply per-project run defaults + runtime settings so the project starts "ready".
    try {
      await updateProjectRunDefaults(name, {
        yolo_mode: false,
        mode: runMode,
        parallel_count: parallelCount,
        model_preset: parallelPreset,
      })
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to save project run defaults')
    }

    try {
      await updateProjectRuntimeSettings(name, {
        planner_enabled: plannerRequired,
        planner_required: plannerRequired,
        require_gatekeeper: requireGatekeeper,
        allow_no_tests: false,
        stop_when_done: stopWhenDone,
        locks_enabled: true,
        worker_verify: true,
      })
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Failed to save project runtime settings')
    }

    if (setupLevel !== 'advanced') return

    // Per-project engine chains
    try {
      await updateEngineSettings(name, buildEngineSettingsPreset(enginePreset))
    } catch (e: any) {
      // Non-fatal: user can still change it later in Settings → Engines.
      setError(e instanceof Error ? e.message : 'Failed to apply engine settings')
    }
  }

  const maybeInitProjectConfig = async (name: string) => {
    if (!initAutocoderYaml) return

    try {
      if (configSource === 'copy' && copyFromProject) {
        const other = await getAutocoderYaml(copyFromProject)
        const content = (other.content || '').trim()
        if (content) {
          await updateAutocoderYaml(name, content.endsWith('\n') ? content : content + '\n')
          return
        }
      }
      await updateAutocoderYaml(name, buildAutocoderYamlTemplate())
    } catch (e: unknown) {
      // Non-fatal: project can still run without autocoder.yaml.
      setError(e instanceof Error ? e.message : 'Failed to initialize autocoder.yaml')
    }
  }

  const handleMethodSelect = async (method: SpecMethod) => {
    setSpecMethod(method)

    if (!projectPath) {
      setError('Please select a project folder first')
      setStep('folder')
      return
    }

    if (method === 'manual') {
      // Create project immediately with manual method
      try {
        const project = await createProject.mutateAsync({
          name: projectName.trim(),
          path: projectPath,
          specMethod: 'manual',
        })
        await maybeInitProjectConfig(project.name)
        await maybeApplyWizardSettings(project.name)
        setResultNotice({
          type: 'success',
          message: `Project created as "${project.name}".`,
        })
        setStepAndNotify('complete')
        setTimeout(() => {
          onProjectCreated(project.name)
          handleClose()
        }, 1500)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create project')
      }
    } else {
      // Create project then show chat
      try {
        const project = await createProject.mutateAsync({
          name: projectName.trim(),
          path: projectPath,
          specMethod: 'claude',
        })
        await maybeInitProjectConfig(project.name)
        await maybeApplyWizardSettings(project.name)
        setResultNotice({
          type: 'success',
          message: `Project created as "${project.name}".`,
        })
        setStepAndNotify('chat')
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create project')
      }
    }
  }

  const handleSpecComplete = async (_specPath: string, yoloMode: boolean = false) => {
    // Save yoloMode for retry
    setYoloModeSelected(yoloMode)
    // Auto-start the initializer agent
    setInitializerStatus('starting')
    try {
      const name = projectName.trim()
      if (setupLevel === 'advanced' && runMode === 'parallel') {
        // Parallel + YOLO are mutually exclusive; force YOLO off.
        await startAgent(name, {
          yolo_mode: false,
          parallel_mode: true,
          parallel_count: parallelCount,
          model_preset: parallelPreset,
        })
      } else {
        await startAgent(name, { yolo_mode: yoloMode })
      }
      // Success - navigate to project
      setStepAndNotify('complete')
      setTimeout(() => {
        onProjectCreated(name)
        handleClose()
      }, 1500)
    } catch (err) {
      setInitializerStatus('error')
      setInitializerError(err instanceof Error ? err.message : 'Failed to start agent')
    }
  }

  const handleRetryInitializer = () => {
    setInitializerError(null)
    setInitializerStatus('idle')
    handleSpecComplete('', yoloModeSelected)
  }

  const handleChatCancel = () => {
    // Go back to method selection but keep the project
    setStepAndNotify('method')
    setSpecMethod(null)
  }

  const handleExitToProject = () => {
    // Exit chat and go directly to project - user can start agent manually
    onProjectCreated(projectName.trim())
    handleClose()
  }

  const handleClose = () => {
    setStepAndNotify('name')
    setSetupLevel('fast')
    setProjectName('')
    setProjectPath(null)
    setSpecMethod(null)
    setError(null)
    setNotice(null)
    setResultNotice(null)
    setInitializerStatus('idle')
    setInitializerError(null)
    setYoloModeSelected(false)
    setInitAutocoderYaml(true)
    setConfigSource('template')
    setCopyFromProject('')
    setRunMode('standard')
    setParallelCount(3)
    setParallelPreset('balanced')
    setEnginePreset('claude_only')
    setPlannerRequired(true)
    setStopWhenDone(true)
    setRequireGatekeeper(true)
    onClose()
  }

  const handleBack = () => {
    if (step === 'method') {
      setStep('setup')
      setSpecMethod(null)
    } else if (step === 'setup') {
      setStep('folder')
    } else if (step === 'folder') {
      setStep('name')
      setProjectPath(null)
    }
  }

  // Full-screen chat view
  if (step === 'chat') {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-neo-bg)]">
        <SpecCreationChat
          projectName={projectName.trim()}
          onComplete={handleSpecComplete}
          onCancel={handleChatCancel}
          onExitToProject={handleExitToProject}
          initializerStatus={initializerStatus}
          initializerError={initializerError}
          onRetryInitializer={handleRetryInitializer}
        />
      </div>
    )
  }

  // Folder step uses larger modal
  if (step === 'folder') {
    return (
      <div className="neo-modal-backdrop" onClick={handleClose}>
        <div
          className="neo-modal w-full max-w-3xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b-3 border-[var(--color-neo-border)]">
            <div className="flex items-center gap-3">
              <Folder size={24} className="text-[var(--color-neo-progress)]" />
              <div>
                <h2 className="font-display font-bold text-xl text-[var(--color-neo-text)]">
                  Select Project Location
                </h2>
                <p className="text-sm text-[var(--color-neo-text-secondary)]">
                  Select the folder to use for project <span className="font-bold font-mono">{projectName}</span>. Create a new folder or choose an existing one.
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="neo-btn neo-btn-ghost p-2"
            >
              <X size={20} />
            </button>
          </div>

          {/* Folder Browser */}
          <div className="flex-1 overflow-hidden">
            <FolderBrowser
              onSelect={handleFolderSelect}
              onCancel={handleFolderCancel}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="neo-modal-backdrop" onClick={handleClose}>
      <div
        className="neo-modal w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-3 border-[var(--color-neo-border)]">
          <h2 className="font-display font-bold text-xl text-[var(--color-neo-text)]">
            {step === 'name' && 'Create New Project'}
            {step === 'setup' && 'Project Setup'}
            {step === 'method' && 'Choose Setup Method'}
            {step === 'complete' && 'Project Created!'}
          </h2>
          <button
            onClick={handleClose}
            className="neo-btn neo-btn-ghost p-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Project Name */}
          {step === 'name' && (
            <form onSubmit={handleNameSubmit}>
              <div className="mb-6">
                <label className="block font-bold mb-2 text-[var(--color-neo-text)]">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => {
                    setProjectName(e.target.value)
                    setError(null)
                    setNotice(null)
                  }}
                  placeholder="task-management-system"
                  className="neo-input"
                  autoFocus
                />
                <p className="text-sm text-[var(--color-neo-text-secondary)] mt-2">
                  We’ll normalize it for you (letters, numbers, hyphens, underscores).
                </p>
                {projectName.trim() && normalizeProjectName(projectName) !== projectName.trim() && (
                  <div className="mt-2 text-sm">
                    <span className="text-[var(--color-neo-text-secondary)]">Will be saved as:</span>{' '}
                    <span className="font-mono font-bold">{normalizeProjectName(projectName)}</span>
                  </div>
                )}
              </div>

              {notice && (
                <div className="mb-4 p-3 bg-[var(--color-neo-card)] text-[var(--color-neo-text)] text-sm border-3 border-[var(--color-neo-border)]">
                  {notice}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-[var(--color-neo-error-bg)] text-[var(--color-neo-error-text)] text-sm border-3 border-[var(--color-neo-error-border)]">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="neo-btn neo-btn-primary"
                  disabled={!projectName.trim()}
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* Step 2: Spec Method */}
          {step === 'setup' && (
            <div>
              <p className="text-[var(--color-neo-text-secondary)] mb-6">
                Configure project defaults (you can edit later).
              </p>

              <div className="neo-card p-4 mb-6">
                <div className="text-xs font-display font-bold uppercase mb-3">Setup Mode</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSetupLevel('fast')}
                    className={`neo-card p-4 text-left ${setupLevel === 'fast' ? 'bg-[var(--color-neo-neutral-100)]' : ''}`}
                    title="Fast defaults: simplest and most reliable"
                  >
                    <div className="font-display font-bold uppercase">Fast</div>
                    <div className="text-sm text-[var(--color-neo-text-secondary)]">
                      Claude-only engines, Standard mode. Minimal moving parts.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetupLevel('advanced')}
                    className={`neo-card p-4 text-left ${setupLevel === 'advanced' ? 'bg-[var(--color-neo-neutral-100)]' : ''}`}
                    title="Advanced: configure engines + run mode"
                  >
                    <div className="font-display font-bold uppercase">Advanced</div>
                    <div className="text-sm text-[var(--color-neo-text-secondary)]">
                      Configure parallel defaults, engine chains, and planner options.
                    </div>
                  </button>
                </div>
              </div>

              <div className="neo-card p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[var(--color-neo-accent)] border-2 border-[var(--color-neo-border)] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                    <Settings2 size={20} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-bold uppercase">Setup Wizard</div>
                    <div className="text-sm text-[var(--color-neo-text-secondary)]">
                      Creates <span className="font-mono">autocoder.yaml</span> with per-project defaults (recommended for parallel runs).
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <label className="neo-card p-3 flex items-center justify-between cursor-pointer">
                    <span className="font-display font-bold text-sm">Create autocoder.yaml</span>
                    <input
                      type="checkbox"
                      checked={initAutocoderYaml}
                      onChange={(e) => setInitAutocoderYaml(e.target.checked)}
                      className="w-5 h-5"
                    />
                  </label>

                  {initAutocoderYaml && (
                    <>
                      <div className="neo-card p-3">
                        <div className="text-xs font-display font-bold uppercase mb-2">Source</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={`neo-btn text-sm ${configSource === 'template' ? 'bg-[var(--color-neo-accent)] text-white' : 'neo-btn-secondary'}`}
                            onClick={() => setConfigSource('template')}
                            type="button"
                          >
                            Template
                          </button>
                          <button
                            className={`neo-btn text-sm ${configSource === 'copy' ? 'bg-[var(--color-neo-accent)] text-white' : 'neo-btn-secondary'}`}
                            onClick={() => setConfigSource('copy')}
                            type="button"
                          >
                            Copy from project
                          </button>
                        </div>
                      </div>

                      {configSource === 'copy' ? (
                        <div className="neo-card p-3">
                          <div className="text-xs font-display font-bold uppercase mb-2">Copy From</div>
                          <select
                            value={copyFromProject}
                            onChange={(e) => setCopyFromProject(e.target.value)}
                            className="neo-btn text-sm py-2 px-3 bg-white border-3 border-[var(--color-neo-border)] font-display w-full"
                            disabled={projectsQ.isLoading || projectsQ.isFetching}
                          >
                            <option value="">Select a project…</option>
                            {(projectsQ.data || [])
                              .map((p) => p.name)
                              .filter((n) => n)
                              .sort()
                              .map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                          </select>
                          <div className="text-xs text-[var(--color-neo-text-secondary)] mt-2">
                            Copies the entire <span className="font-mono">autocoder.yaml</span> (commands + review).
                          </div>
                        </div>
                      ) : (
                        <div className="neo-card p-3">
                          <div className="text-xs font-display font-bold uppercase mb-2">Template Preview</div>
                          <div className="text-xs text-[var(--color-neo-text-secondary)] space-y-2">
                            <div>
                              Creates a minimal <span className="font-mono">autocoder.yaml</span> with examples for
                              <span className="font-mono"> preset</span>, <span className="font-mono">commands</span>, and
                              optional <span className="font-mono">review</span>.
                            </div>
                            <div>
                              Engine chains (workers/QA/review/spec) are configured separately in{' '}
                              <span className="font-display font-semibold">Settings → Engines</span>.
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {setupLevel === 'advanced' && (
                <>
                  <div className="neo-card p-4 mb-6">
                    <div className="font-display font-bold uppercase mb-2">Run Defaults</div>
                    <div className="text-sm text-[var(--color-neo-text-secondary)] mb-3">
                      Choose how the first run starts after spec creation. Parallel uses git worktrees; AutoCoder will initialize git automatically if needed.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRunMode('standard')}
                        className={`neo-btn text-sm ${runMode === 'standard' ? 'bg-[var(--color-neo-accent)] text-white' : 'neo-btn-secondary'}`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => setRunMode('parallel')}
                        className={`neo-btn text-sm ${runMode === 'parallel' ? 'bg-[var(--color-neo-accent)] text-white' : 'neo-btn-secondary'}`}
                      >
                        Parallel
                      </button>
                    </div>

                    {runMode === 'parallel' && (
                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <label className="neo-card p-3">
                          <div className="text-xs font-display font-bold uppercase mb-2">Parallel agents</div>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={parallelCount}
                            onChange={(e) => setParallelCount(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                            className="neo-input"
                          />
                        </label>
                        <label className="neo-card p-3">
                          <div className="text-xs font-display font-bold uppercase mb-2">Preset</div>
                          <select
                            value={parallelPreset}
                            onChange={(e) => setParallelPreset(e.target.value as ParallelPreset)}
                            className="neo-btn text-sm py-2 px-3 bg-white border-3 border-[var(--color-neo-border)] font-display w-full"
                          >
                            <option value="quality">quality</option>
                            <option value="balanced">balanced</option>
                            <option value="economy">economy</option>
                            <option value="cheap">cheap</option>
                            <option value="experimental">experimental</option>
                            <option value="custom">custom</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="neo-card p-4 mb-6">
                    <div className="font-display font-bold uppercase mb-2">Engines</div>
                    <div className="text-sm text-[var(--color-neo-text-secondary)] mb-3">
                      Sets per-project engine chains (Settings → Engines).
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <label className="neo-card p-3 flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="font-display font-bold text-sm">Claude only</div>
                          <div className="text-xs text-[var(--color-neo-text-secondary)]">Most stable defaults.</div>
                        </div>
                        <input
                          type="radio"
                          name="enginePreset"
                          checked={enginePreset === 'claude_only'}
                          onChange={() => setEnginePreset('claude_only')}
                          className="w-5 h-5"
                        />
                      </label>
                      <label className="neo-card p-3 flex items-center justify-between cursor-pointer">
                        <div>
                          <div className="font-display font-bold text-sm">Hybrid (Claude + Codex + Gemini)</div>
                          <div className="text-xs text-[var(--color-neo-text-secondary)]">
                            Adds Codex/Gemini after Claude for more coverage (requires CLIs installed).
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="enginePreset"
                          checked={enginePreset === 'hybrid'}
                          onChange={() => setEnginePreset('hybrid')}
                          className="w-5 h-5"
                        />
                      </label>
                    </div>
                  </div>

                  <label className="neo-card p-4 mb-6 flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                      <div className="font-display font-bold uppercase">Planner required (smart)</div>
                      <div className="text-sm text-[var(--color-neo-text-secondary)]">
                        Ensures risky features get a plan artifact first (per-project; fail-open).
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={plannerRequired}
                      onChange={(e) => setPlannerRequired(e.target.checked)}
                      className="w-5 h-5 mt-1"
                    />
                  </label>

                  <label className="neo-card p-4 mb-6 flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                      <div className="font-display font-bold uppercase">Stop when done</div>
                      <div className="text-sm text-[var(--color-neo-text-secondary)]">
                        Stops the agent when the queue is empty (per-project).
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={stopWhenDone}
                      onChange={(e) => setStopWhenDone(e.target.checked)}
                      className="w-5 h-5 mt-1"
                    />
                  </label>

                  <label className="neo-card p-4 mb-6 flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                      <div className="font-display font-bold uppercase">Require Gatekeeper</div>
                      <div className="text-sm text-[var(--color-neo-text-secondary)]">
                        Requires deterministic verification before merge (per-project).
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireGatekeeper}
                      onChange={(e) => setRequireGatekeeper(e.target.checked)}
                      className="w-5 h-5 mt-1"
                    />
                  </label>
                </>
              )}

              <div className="flex justify-between mt-6">
                <button onClick={handleBack} className="neo-btn neo-btn-ghost">
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={() => setStep('method')}
                  className="neo-btn neo-btn-primary"
                  type="button"
                  disabled={!projectPath}
                >
                  Next
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 'complete' && resultNotice && (
            <div className="mb-4">
              <InlineNotice type={resultNotice.type} message={resultNotice.message} onClose={() => setResultNotice(null)} />
            </div>
          )}

          {/* Step 3: Spec Method */}
          {step === 'method' && (
            <div>
              <p className="text-[var(--color-neo-text-secondary)] mb-6">
                How would you like to define your project?
              </p>

              <div className="space-y-4">
                {/* Claude option */}
                <button
                  onClick={() => handleMethodSelect('claude')}
                  disabled={createProject.isPending}
                  className="
                    w-full text-left p-4
                    border-3 border-[var(--color-neo-border)]
                    bg-[var(--color-neo-card)]
                    hover:shadow-neo-lg
                    transition-all duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed
                    neo-card
                  "
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="p-2 bg-[var(--color-neo-progress)] border-2 border-[var(--color-neo-border)]"
                      style={{ boxShadow: 'var(--shadow-neo-sm)' }}
                    >
                      <Bot size={24} className="text-[var(--color-neo-text-on-bright)]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg text-[var(--color-neo-text)]">Create with Claude</span>
                        <span className="neo-badge bg-[var(--color-neo-done)] text-[var(--color-neo-text-on-bright)] text-xs">
                          Recommended
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-neo-text-secondary)] mt-1">
                        Interactive conversation to define features and generate your app specification automatically.
                      </p>
                    </div>
                  </div>
                </button>

                {/* Manual option */}
                <button
                  onClick={() => handleMethodSelect('manual')}
                  disabled={createProject.isPending}
                  className="
                    w-full text-left p-4
                    border-3 border-[var(--color-neo-border)]
                    bg-[var(--color-neo-card)]
                    hover:shadow-neo-lg
                    transition-all duration-150
                    disabled:opacity-50 disabled:cursor-not-allowed
                    neo-card
                  "
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="p-2 bg-[var(--color-neo-pending)] border-2 border-[var(--color-neo-border)]"
                      style={{ boxShadow: 'var(--shadow-neo-sm)' }}
                    >
                      <FileEdit size={24} className="text-[var(--color-neo-text-on-bright)]" />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-lg text-[var(--color-neo-text)]">Edit Templates Manually</span>
                      <p className="text-sm text-[var(--color-neo-text-secondary)] mt-1">
                        Edit the template files directly. Best for developers who want full control.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-[var(--color-neo-error-bg)] text-[var(--color-neo-error-text)] text-sm border-3 border-[var(--color-neo-error-border)]">
                  {error}
                </div>
              )}

              {createProject.isPending && (
                <div className="mt-4 flex items-center justify-center gap-2 text-[var(--color-neo-text-secondary)]">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating project...</span>
                </div>
              )}

              <div className="flex justify-start mt-6">
                <button
                  onClick={handleBack}
                  className="neo-btn neo-btn-ghost"
                  disabled={createProject.isPending}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <div
                className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-neo-done)] border-3 border-[var(--color-neo-border)] mb-4"
                style={{ boxShadow: 'var(--shadow-neo-md)' }}
              >
                <CheckCircle2 size={32} className="text-[var(--color-neo-text-on-bright)]" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">
                {projectName}
              </h3>
              <p className="text-[var(--color-neo-text-secondary)]">
                Your project has been created successfully!
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Redirecting...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
