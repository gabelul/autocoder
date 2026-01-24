import { KanbanColumn } from './KanbanColumn'
import type { Feature, FeatureListResponse } from '../lib/types'

interface KanbanBoardProps {
  features: FeatureListResponse | undefined
  onFeatureClick: (feature: Feature) => void
  className?: string
}

export function KanbanBoard({ features, onFeatureClick, className }: KanbanBoardProps) {
  if (!features) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${className ?? ''}`}>
        {['Staged', 'Pending', 'In Progress', 'Done'].map(title => (
          <div key={title} className="neo-card p-4">
            <div className="h-8 bg-[var(--color-neo-bg)] animate-pulse mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--color-neo-bg)] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const sortPending = (items: Feature[]) => {
    const score = (f: Feature) => {
      const status = String(f.status || '').toUpperCase()
      if (status === 'BLOCKED') return 3
      if ((f.attempts ?? 0) > 0 || f.last_error) return 2
      if (f.ready === false) return 1
      return 0
    }

    return [...items].sort((a, b) => {
      const sa = score(a)
      const sb = score(b)
      if (sb !== sa) return sb - sa
      const pa = a.priority ?? 0
      const pb = b.priority ?? 0
      if (pb !== pa) return pb - pa
      return (a.id ?? 0) - (b.id ?? 0)
    })
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-4 md:grid-rows-1 gap-6 items-stretch ${className ?? ''}`}>
      <KanbanColumn
        title="Staged"
        count={features.staged.length}
        features={features.staged}
        color="staged"
        onFeatureClick={onFeatureClick}
      />
      <KanbanColumn
        title="Pending"
        count={features.pending.length}
        features={sortPending(features.pending)}
        color="pending"
        onFeatureClick={onFeatureClick}
      />
      <KanbanColumn
        title="In Progress"
        count={features.in_progress.length}
        features={features.in_progress}
        color="progress"
        onFeatureClick={onFeatureClick}
      />
      <KanbanColumn
        title="Done"
        count={features.done.length}
        features={features.done}
        color="done"
        onFeatureClick={onFeatureClick}
      />
    </div>
  )
}
