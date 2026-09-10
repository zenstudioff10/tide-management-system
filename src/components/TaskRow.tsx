import { useMemo } from 'react'
import type { DimOption, Dimension, Task } from '../types'
import { Chip } from './Chip'
import { IconCheck } from '../design/icons'
import { fmtDayCell, fmtDayLong, sameDay, startOfDay } from '../lib/time'
import { useUi } from '../store/useUi'

interface Props {
  task: Task
  dimensions: Dimension[]
  options: DimOption[]
  selected?: boolean
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
  draggable = true,
  onToggle,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
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
    useUi.getState().askConfirm(task.id, r.left + r.width + 10, r.top - 6)
  }

  return (
    <div
      className="task-row"
      data-done={done ? '' : undefined}
      data-clearing={clearing ? '' : undefined}
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
