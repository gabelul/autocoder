import { useEffect, useMemo, useState } from 'react'
import { Plus, X, Pencil, RefreshCw } from 'lucide-react'
import { InteractiveTerminal } from './InteractiveTerminal'
import { useCreateTerminal, useDeleteTerminal, useRenameTerminal, useTerminalTabs } from '../hooks/useTerminalTabs'

export function TerminalTabsPanel({ projectName }: { projectName: string }) {
  const tabsQuery = useTerminalTabs(projectName)
  const create = useCreateTerminal(projectName)
  const rename = useRenameTerminal(projectName)
  const del = useDeleteTerminal(projectName)

  const terminals = tabsQuery.data ?? []
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Ensure we always have an active terminal (create one if none exist).
  useEffect(() => {
    if (tabsQuery.isLoading) return
    if (terminals.length === 0 && !create.isPending) {
      create.mutate(undefined, {
        onSuccess: (t) => setActiveId(t.id),
      })
      return
    }
    if (!activeId && terminals.length > 0) {
      setActiveId(terminals[0].id)
    }
    if (activeId && terminals.length > 0 && !terminals.some((t) => t.id === activeId)) {
      setActiveId(terminals[0].id)
    }
  }, [tabsQuery.isLoading, terminals, activeId, create])

  const active = useMemo(() => terminals.find((t) => t.id === activeId) ?? null, [terminals, activeId])

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {terminals.map((t) => {
              const isActive = t.id === activeId
              const isRenaming = renamingId === t.id
              return (
                <div
                  key={t.id}
                  className={`neo-card px-2 py-1 flex items-center gap-2 ${isActive ? 'ring-4 ring-[var(--color-neo-accent)]' : ''}`}
                >
                  {isRenaming ? (
                    <input
                      className="bg-white text-black text-xs font-mono px-2 py-1 border border-black"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const name = renameValue.trim()
                          if (name) {
                            rename.mutate({ terminalId: t.id, name })
                          }
                          setRenamingId(null)
                        } else if (e.key === 'Escape') {
                          setRenamingId(null)
                        }
                      }}
                      onBlur={() => setRenamingId(null)}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="text-xs font-mono text-black"
                      onClick={() => setActiveId(t.id)}
                      title={t.id}
                    >
                      {t.name}
                    </button>
                  )}

                  <button
                    className="neo-btn neo-btn-secondary text-xs py-1 px-1.5"
                    title="Rename"
                    onClick={() => {
                      setRenamingId(t.id)
                      setRenameValue(t.name)
                    }}
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    className="neo-btn neo-btn-secondary text-xs py-1 px-1.5"
                    title="Close"
                    onClick={() => {
                      if (del.isPending) return
                      del.mutate(t.id, {
                        onSuccess: () => {
                          if (activeId === t.id) setActiveId(null)
                        },
                      })
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <button
          className="neo-btn neo-btn-primary text-xs flex items-center gap-1"
          onClick={() => {
            if (create.isPending) return
            create.mutate(undefined, { onSuccess: (t) => setActiveId(t.id) })
          }}
          title="New terminal"
        >
          <Plus size={14} />
          New
        </button>

        <button
          className="neo-btn neo-btn-secondary text-xs flex items-center gap-1"
          onClick={() => tabsQuery.refetch()}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {tabsQuery.isLoading ? (
          <div className="text-xs font-mono text-gray-500">Loading terminals…</div>
        ) : active ? (
          <InteractiveTerminal projectName={projectName} terminalId={active.id} isActive />
        ) : (
          <div className="text-xs font-mono text-gray-500">No terminal selected.</div>
        )}
      </div>
    </div>
  )
}

