import { useEffect, useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { Chip } from './Chip'
import { IconClose, IconPlus } from '../design/icons'
import { id } from '../lib/id'
import { OPTION_COLORS } from '../ocean/palette'

const toDateInput = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : '')
const toTimeInput = (t?: number) => {
  if (!t) return ''
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TaskDrawer() {
  const taskId = useUi((s) => s.openTaskId)
  const close = () => useUi.getState().openTask(null)

  const task = useApp((s) => s.tasks.find((t) => t.id === taskId))
  const dimensions = useApp((s) => s.dimensions)
  const options = useApp((s) => s.options)
  const { updateTask, deleteTask, toggleOption } = useApp.getState()

  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [newOptionIn, setNewOptionIn] = useState<string | null>(null)
  const [newOptionName, setNewOptionName] = useState('')
  const boards = useApp((s) => s.boards)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    if (taskId) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [taskId])

  if (!task) return null

  const setDatePart = (datePart: string, timePart: string) => {
    if (!datePart && !timePart) return updateTask(task.id, { dueAt: undefined })
    const date = datePart || toDateInput(Date.now())
    const time = timePart || '09:00'
    updateTask(task.id, { dueAt: new Date(`${date}T${time}`).getTime() })
  }

  return (
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className="drawer">
        <div className="drawer-head">
          <span className="gauge-label">task</span>
          <button className="icon-button" onClick={close} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        <input
          className="drawer-title display"
          value={task.title}
          spellCheck={false}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
        />

        <textarea
          className="drawer-notes"
          value={task.notes}
          rows={3}
          placeholder="notes"
          onChange={(e) => updateTask(task.id, { notes: e.target.value })}
        />

        {dimensions.map((dimension) => {
          const own = options
            .filter((o) => o.dimensionId === dimension.id)
            .sort((a, b) => a.order - b.order)
          if (!own.length) return null
          return (
            <section key={dimension.id} className="drawer-block">
              <span className="gauge-label">
                {dimension.name}
                {dimension.kind === 'multi' ? ' · any' : ''}
              </span>
              <div className="chip-row">
                {own.map((o) => (
                  <Chip
                    key={o.id}
                    option={o}
                    active={task.optionIds.includes(o.id)}
                    onClick={() => toggleOption(task.id, o.id)}
                  />
                ))}
                {newOptionIn === dimension.id ? (
                  <input
                    className="field option-inline"
                    autoFocus
                    value={newOptionName}
                    placeholder="label baru"
                    onChange={(e) => setNewOptionName(e.target.value)}
                    onBlur={() => setNewOptionIn(null)}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Escape') return setNewOptionIn(null)
                      if (e.key !== 'Enter' || !newOptionName.trim()) return
                      const created = useApp
                        .getState()
                        .addOption(
                          dimension.id,
                          newOptionName.trim(),
                          OPTION_COLORS[own.length % OPTION_COLORS.length],
                        )
                      toggleOption(task.id, created.id)
                      setNewOptionName('')
                      setNewOptionIn(null)
                    }}
                  />
                ) : (
                  <button
                    className="icon-button chip-add"
                    title={`Label baru di ${dimension.name}`}
                    onClick={() => {
                      setNewOptionName('')
                      setNewOptionIn(dimension.id)
                    }}
                  >
                    <IconPlus size={13} />
                  </button>
                )}
              </div>
            </section>
          )
        })}

        {boards.length > 1 && (
          <section className="drawer-block">
            <span className="gauge-label">daftar</span>
            <div className="chip-row">
              {[...boards]
                .sort((a, b) => a.order - b.order)
                .map((b) => (
                  <button
                    key={b.id}
                    className="chip chip-button"
                    data-active={task.boardId === b.id ? '' : undefined}
                    onClick={() => updateTask(task.id, { boardId: b.id })}
                  >
                    <span
                      className="chip-dot"
                      style={{ background: task.boardId === b.id ? 'var(--tod-light)' : 'var(--ink-4)' }}
                    />
                    {b.name}
                  </button>
                ))}
            </div>
          </section>
        )}

        <section className="drawer-block">
          <span className="gauge-label">due</span>
          <div className="drawer-fields">
            <input
              type="date"
              className="field mono"
              value={toDateInput(task.dueAt)}
              onChange={(e) => setDatePart(e.target.value, toTimeInput(task.dueAt))}
            />
            <input
              type="time"
              className="field mono"
              value={toTimeInput(task.dueAt)}
              onChange={(e) => setDatePart(toDateInput(task.dueAt), e.target.value)}
            />
            {task.dueAt && (
              <button className="quiet-button" onClick={() => updateTask(task.id, { dueAt: undefined })}>
                clear
              </button>
            )}
          </div>
        </section>

        <section className="drawer-block">
          <span className="gauge-label">steps</span>
          <ul className="subtasks">
            {task.subtasks.map((s) => (
              <li key={s.id}>
                <button
                  className="subtask-check"
                  data-done={s.done ? '' : undefined}
                  onClick={() =>
                    updateTask(task.id, {
                      subtasks: task.subtasks.map((x) =>
                        x.id === s.id ? { ...x, done: !x.done } : x,
                      ),
                    })
                  }
                />
                <span data-done={s.done ? '' : undefined}>{s.title}</span>
                <button
                  className="icon-button subtask-remove"
                  onClick={() =>
                    updateTask(task.id, { subtasks: task.subtasks.filter((x) => x.id !== s.id) })
                  }
                >
                  <IconClose size={13} />
                </button>
              </li>
            ))}
          </ul>
          <div className="subtask-add">
            <IconPlus size={14} />
            <input
              value={subtaskDraft}
              placeholder="another step"
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !subtaskDraft.trim()) return
                updateTask(task.id, {
                  subtasks: [...task.subtasks, { id: id(), title: subtaskDraft.trim(), done: false }],
                })
                setSubtaskDraft('')
              }}
            />
          </div>
        </section>

        <div className="drawer-foot">
          <button
            className="quiet-button danger"
            onClick={() => {
              deleteTask(task.id)
              close()
            }}
          >
            delete
          </button>
        </div>
      </aside>
    </>
  )
}
