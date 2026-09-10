import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { useOcean } from '../ocean/useOcean'
import { boardTasks, buildLanes, DATE_GROUP } from '../store/selectors'
import { TaskRow } from '../components/TaskRow'
import { QuickAdd } from '../components/QuickAdd'
import { FilterBar, GroupBySelect } from '../components/Controls'
import { BoardTabs } from '../components/BoardTabs'
import { ChatButton } from '../components/ChatButton'
import { completeTask } from '../components/ConfirmHold'
import { IconSurface } from '../design/icons'

/** The water column. Lanes are the options of whichever dimension is chosen,
 *  so a new grouping invented in Settings appears here with no code at all. */
export function Depths() {
  const allTasks = useApp((s) => s.tasks)
  const settings = useApp((s) => s.settings)
  const tasks = boardTasks({ tasks: allTasks, settings })
  const options = useApp((s) => s.options)
  const dimensions = useApp((s) => s.dimensions)
  const activeBoard = useApp((s) => s.boards.find((b) => b.id === s.settings.activeBoardId))

  const groupBy = useUi((s) => s.groupBy)
  const filters = useUi((s) => s.filters)
  const query = useUi((s) => s.query)
  const showDone = useUi((s) => s.showDone)
  const setGroupBy = useUi((s) => s.setGroupBy)

  const scroller = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ lane: string; beforeId?: string } | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)

  // arriving on a list restores the way you last looked at it
  useEffect(() => {
    if (groupBy !== null) return
    setGroupBy(activeBoard?.groupBy ?? DATE_GROUP)
  }, [groupBy, activeBoard, setGroupBy])

  // and every change to the view is remembered on that list
  useEffect(() => {
    if (!activeBoard) return
    if (activeBoard.groupBy === groupBy && activeBoard.filters === filters) return
    useApp.getState().updateBoard(activeBoard.id, { groupBy, filters })
  }, [activeBoard, groupBy, filters])

  const lanes = useMemo(
    () => buildLanes({ tasks, options, groupBy, filters, query, showDone }),
    [tasks, options, groupBy, filters, query, showDone],
  )

  const flat = useMemo(() => lanes.flatMap((l) => l.tasks.map((t) => t.id)), [lanes])

  // scrolling deeper takes the camera with it
  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const max = Math.max(1, el.scrollHeight - el.clientHeight)
    // already below the meniscus on arrival, then deeper as the list runs out
    useOcean.getState().setDepth(Math.min(1, 0.34 + (el.scrollTop / max) * 0.58))
  }

  useEffect(() => {
    useOcean.getState().setDepth(0.34)
    return () => useOcean.getState().setDepth(0)
  }, [])

  // ── keyboard ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      const app = useApp.getState()
      const index = cursor ? flat.indexOf(cursor) : -1

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor(flat[Math.min(flat.length - 1, index + 1)] ?? flat[0] ?? null)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor(flat[Math.max(0, index - 1)] ?? null)
      } else if (cursor && e.key === 'x') {
        const task = app.tasks.find((t) => t.id === cursor)
        if (task?.status === 'done') app.toggleDone(cursor)
        else completeTask(cursor)
      } else if (cursor && e.key === 'e') {
        useUi.getState().openTask(cursor)
      } else if (cursor && groupBy && groupBy !== DATE_GROUP && /^[1-9]$/.test(e.key)) {
        const own = options
          .filter((o) => o.dimensionId === groupBy)
          .sort((a, b) => a.order - b.order)
        const option = own[Number(e.key) - 1]
        if (option) app.toggleOption(cursor, option.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, flat, groupBy, options])

  // ── dragging ─────────────────────────────────────────────────────────
  const byDate = groupBy === DATE_GROUP

  const drop = (laneOptionId: string | null, beforeId?: string) => {
    if (!dragId || byDate) return
    const lane = lanes.find((l) => l.optionId === laneOptionId) ?? lanes.find((l) => l.key === 'drifting')
    const list = lane?.tasks.filter((t) => t.id !== dragId) ?? []
    const at = beforeId ? list.findIndex((t) => t.id === beforeId) : list.length
    const before = at > 0 ? list[at - 1]?.id : undefined
    const after = at >= 0 && at < list.length ? list[at]?.id : undefined

    useApp.getState().moveTask(dragId, {
      optionId: laneOptionId,
      dimensionId: groupBy ?? '',
      beforeId: before,
      afterId: after,
    })
    setDragId(null)
    setDropAt(null)
  }

  return (
    <div className="depths">
      <header className="depths-head stacked">
        <div className="head-row">
          <button className="icon-button" onClick={() => useUi.getState().go('surface')} title="Surface">
            <IconSurface size={18} />
          </button>
          <BoardTabs />
          <span className="head-spacer" />
          <ChatButton />
        </div>
        <div className="head-row">
          <GroupBySelect />
          <FilterBar />
        </div>
      </header>

      <div className="depths-scroll" ref={scroller} onScroll={onScroll}>
        <div className="depths-sheet">
        {lanes.map((lane, i) => (
          <section
            key={lane.key}
            className="lane"
            style={{ ['--lane-depth' as string]: lanes.length > 1 ? i / (lanes.length - 1) : 0 }}
            onDragOver={(e) => {
              e.preventDefault()
              setDropAt({ lane: lane.key })
            }}
            onDrop={(e) => {
              e.preventDefault()
              drop(lane.optionId)
            }}
          >
            <div className="lane-head">
              <span className="lane-dot" style={{ background: lane.color }} />
              <h2 className="lane-name heading">{lane.label}</h2>
              <span className="lane-count mono">{lane.tasks.length}</span>
              <span className="lane-rule" />
            </div>

            <div className="lane-body">
              {lane.tasks.map((task) => (
                <div
                  key={task.id}
                  className="lane-slot"
                  data-drop={
                    dropAt?.lane === lane.key && dropAt.beforeId === task.id ? '' : undefined
                  }
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDropAt({ lane: lane.key, beforeId: task.id })
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    drop(lane.optionId, task.id)
                  }}
                >
                  <TaskRow
                    task={task}
                    dimensions={dimensions}
                    options={options}
                    selected={cursor === task.id}
                    dragging={dragId === task.id}
                    draggable={!byDate}
                    onToggle={() => useApp.getState().toggleDone(task.id)}
                    onOpen={() => useUi.getState().openTask(task.id)}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setDropAt(null)
                    }}
                  />
                </div>
              ))}
              {!lane.tasks.length && <p className="lane-empty gauge-label">still water</p>}
            </div>
          </section>
        ))}

        </div>

        <div className="depths-floor">
          <span className="gauge-label">floor</span>
        </div>
      </div>

      {/* the only add button in the column — the date and labels you type
          decide which lane it lands in */}
      <div className="depths-capture">
        <QuickAdd placeholder="add — e.g. UH Kimia jumat #hard #hafalan" />
      </div>
    </div>
  )
}
