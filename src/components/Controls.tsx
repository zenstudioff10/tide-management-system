import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { Chip } from './Chip'
import { IconChevron, IconSearch } from '../design/icons'
import { DATE_GROUP } from '../store/selectors'

/** Small anchored panel. Closes on outside click or Escape. */
export function Popover({
  label,
  children,
  align = 'left',
}: {
  label: ReactNode
  children: (close: () => void) => ReactNode
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="popover-anchor" ref={ref}>
      <button className="popover-trigger" data-open={open ? '' : undefined} onClick={() => setOpen((v) => !v)}>
        {label}
        <IconChevron size={14} className="popover-caret" />
      </button>
      {open && (
        <div className="popover-panel" data-align={align}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function GroupBySelect() {
  const dimensions = useApp((s) => s.dimensions)
  const groupBy = useUi((s) => s.groupBy)
  const setGroupBy = useUi((s) => s.setGroupBy)
  const current = dimensions.find((d) => d.id === groupBy)
  const label = groupBy === DATE_GROUP ? 'Tanggal' : (current?.name ?? 'nothing')

  return (
    <Popover
      label={
        <>
          <span className="gauge-label">depths by</span>
          <span className="popover-value">{label}</span>
        </>
      }
    >
      {(close) => (
        <ul className="menu">
          <li>
            <button
              className="menu-item"
              data-active={groupBy === DATE_GROUP ? '' : undefined}
              onClick={() => {
                setGroupBy(DATE_GROUP)
                close()
              }}
            >
              Tanggal
              <span className="menu-note">kapan</span>
            </button>
          </li>
          {dimensions.map((d) => (
            <li key={d.id}>
              <button
                className="menu-item"
                data-active={d.id === groupBy ? '' : undefined}
                onClick={() => {
                  setGroupBy(d.id)
                  close()
                }}
              >
                {d.name}
                <span className="menu-note">{d.kind === 'multi' ? 'any' : 'one'}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              className="menu-item"
              data-active={groupBy === null ? '' : undefined}
              onClick={() => {
                setGroupBy(null)
                close()
              }}
            >
              one open water
            </button>
          </li>
        </ul>
      )}
    </Popover>
  )
}

export function FilterBar() {
  const dimensions = useApp((s) => s.dimensions)
  const options = useApp((s) => s.options)
  const filters = useUi((s) => s.filters)
  const query = useUi((s) => s.query)
  const { toggleFilter, clearFilters, setQuery, toggleShowDone } = useUi.getState()
  const showDone = useUi((s) => s.showDone)
  const tasks = useApp((s) => s.tasks)
  const activeBoardId = useApp((s) => s.settings.activeBoardId)

  const active = Object.values(filters).flat()
  const doneCount = tasks.filter(
    (t) =>
      t.status === 'done' &&
      (!activeBoardId || activeBoardId === 'all' || t.boardId === activeBoardId),
  ).length

  return (
    <div className="filter-bar">
      <div className="search-field">
        <IconSearch size={15} />
        <input
          value={query}
          spellCheck={false}
          placeholder="cari"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* every dimension in one menu, so the row stays short */}
      <Popover
        align="right"
        label={
          <span className="popover-value" data-on={active.length ? '' : undefined}>
            filter{active.length ? ` ${active.length}` : ''}
          </span>
        }
      >
        {() => (
          <div className="filter-menu">
            {dimensions.map((dimension) => {
              const own = options
                .filter((o) => o.dimensionId === dimension.id)
                .sort((a, b) => a.order - b.order)
              if (!own.length) return null
              const chosen = filters[dimension.id] ?? []
              return (
                <section key={dimension.id} className="filter-group">
                  <span className="gauge-label">{dimension.name}</span>
                  <div className="chip-row">
                    {own.map((o) => (
                      <Chip
                        key={o.id}
                        option={o}
                        active={chosen.includes(o.id)}
                        onClick={() => toggleFilter(dimension.id, o.id)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
            {(active.length > 0 || query) && (
              <button className="quiet-button subtle" onClick={clearFilters}>
                bersihkan semua
              </button>
            )}
          </div>
        )}
      </Popover>

      <button
        className="quiet-button subtle"
        onClick={toggleShowDone}
        data-on={showDone ? '' : undefined}
      >
        {showDone ? 'sembunyikan' : `${doneCount} selesai`}
      </button>
    </div>
  )
}
