import { useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { IconPlus } from '../design/icons'

/** The lists, across the top of the column. Switching one switches the whole
 *  app's context — the homescreen and the briefing follow it. */
export function BoardTabs() {
  const boards = useApp((s) => s.boards)
  const active = useApp((s) => s.settings.activeBoardId ?? 'all')
  const tasks = useApp((s) => s.tasks)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const pick = (id: string | 'all') => {
    const app = useApp.getState()
    app.setActiveBoard(id)
    // each list remembers how you were looking at it
    const board = app.boards.find((b) => b.id === id)
    useUi.getState().setGroupBy(board?.groupBy ?? 'date')
    useUi.getState().setFilters(board?.filters ?? {})
  }

  const count = (boardId: string) =>
    tasks.filter((t) => t.boardId === boardId && t.status === 'open').length

  return (
    <nav className="board-tabs">
      {[...boards]
        .sort((a, b) => a.order - b.order)
        .map((b) => (
          <button
            key={b.id}
            className="board-tab heading"
            data-on={active === b.id ? '' : undefined}
            onClick={() => pick(b.id)}
          >
            {b.name}
            <span className="board-count mono">{count(b.id)}</span>
          </button>
        ))}

      <button
        className="board-tab heading"
        data-on={active === 'all' ? '' : undefined}
        onClick={() => pick('all')}
      >
        semua
      </button>

      {adding ? (
        <input
          className="field board-new"
          autoFocus
          value={draft}
          placeholder="nama daftar"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setAdding(false)
            setDraft('')
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') return setAdding(false)
            if (e.key !== 'Enter' || !draft.trim()) return
            const created = useApp.getState().addBoard(draft.trim())
            pick(created.id)
            setDraft('')
            setAdding(false)
          }}
        />
      ) : (
        <button className="icon-button board-add" onClick={() => setAdding(true)} title="Daftar baru">
          <IconPlus size={14} />
        </button>
      )}
    </nav>
  )
}
