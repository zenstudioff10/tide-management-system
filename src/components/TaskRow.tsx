import { useMemo } from 'react'
import type { DimOption, Dimension, Task } from '../types'
import { Chip } from './Chip'
import { IconCheck } from '../design/icons'
import { fmtDayCell, fmtDayLong, sameDay, startOfDay } from '../lib/time'
import { useUi } from '../store/useUi'
import { useApp } from '../store/useApp'
import { completeTask } from './ConfirmHold'

interface Props {
  task: Task
  dimensions: Dimension[]
  options: DimOption[]
  selected?: boolean
  dragging?: boolean
  draggable?: boolean
  onToggle: () => void
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

export function TaskRow({
  task,
  dimensions,
  options,
  selected,
  dragging,
  draggable = true,
  onToggle,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
  // the row asks its own list, because the "semua" tab puts rows from several
  // lists in one column and a prop from the route could not tell them apart
  const tracksProgress = useApp(
    (s) => s.boards.find((b) => b.id === task.boardId)?.tracksProgress,
  )
  const progress = task.progress ?? 0

  const chips = useMemo(() => {
    const shown = new Map(
      dimensions.filter((d) => d.showOnCard).map((d) => [d.id, d.order]),
    )
    // dimension order first, so difficulty always leads and timing always trails
    return options
      .filter((o) => task.optionIds.includes(o.id) && shown.has(o.dimensionId))
      .sort(
        (a, b) =>
          shown.get(a.dimensionId)! - shown.get(b.dimensionId)! || a.order - b.order,
      )
  }, [dimensions, options, task.optionIds])

  const done = task.status === 'done'
  const now = Date.now()
  const day = task.dueAt ? fmtDayCell(task.dueAt) : null
  const overdue = task.dueAt !== undefined && startOfDay(task.dueAt) < startOfDay(now) && !done
  const today = task.dueAt !== undefined && sameDay(task.dueAt, now)

  const clearing = useUi((s) => s.clearing.includes(task.id))

  /** ticking asks first; un-ticking is instant — there is nothing to protect */
  const complete = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (done) return onToggle()
    const r = e.currentTarget.getBoundingClientRect()
    useUi.getState().askConfirm({
      kind: 'done',
      title: task.title,
      x: r.left + r.width + 10,
      y: r.top - 6,
      onConfirm: () => completeTask(task.id),
    })
  }

  return (
    <div
      className="task-row"
      data-done={done ? '' : undefined}
      data-clearing={clearing ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      data-selected={selected ? '' : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
    >
      {/* the date leaves the sentence and becomes a column you can scan down */}
      <div
        className="task-day mono"
        data-overdue={overdue ? '' : undefined}
        data-today={today ? '' : undefined}
        title={task.dueAt ? fmtDayLong(task.dueAt) : 'no date'}
      >
        {day ? (
          <>
            <span className="task-day-top">{day.top}</span>
            <span className="task-day-bottom">{day.bottom}</span>
          </>
        ) : (
          <span className="task-day-none">—</span>
        )}
      </div>

      <button
        className="task-check"
        onClick={(e) => {
          e.stopPropagation()
          complete(e)
        }}
        aria-label={done ? 'Reopen' : 'Complete'}
      >
        <span className="task-check-ring" />
        {clearing && <span className="task-check-ripple" />}
        {done && <IconCheck size={13} className="task-check-mark" />}
      </button>

      <div className="task-body">
        <span className="task-title">{task.title || 'Untitled'}</span>
        {clearing && (
          <span className="foam" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="foam-speck" style={{ ['--i' as string]: i }} />
            ))}
          </span>
        )}

        {tracksProgress && progress > 0 && (
          <div className="task-progress" data-dim={done ? '' : undefined}>
            <span className="task-progress-track">
              <span className="task-progress-fill" style={{ width: `${progress}%` }} />
            </span>
            <span className="task-progress-value mono">{progress}%</span>
          </div>
        )}

        {chips.length > 0 && (
          <div className="task-labels">
            {chips.map((o) => (
              <Chip key={o.id} option={o} loud dim={done} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
