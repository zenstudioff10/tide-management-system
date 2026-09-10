import { useMemo } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { useOcean } from '../ocean/useOcean'
import { useNow } from '../lib/useNow'
import { boardTasks, byDueDate, importantTasks, loadByDay, weekLoad } from '../store/selectors'
import { Chip } from '../components/Chip'
import { IconSurface } from '../design/icons'
import { daysUntil, fmtCountdown, fmtDayCell, fmtDayLong } from '../lib/time'
import { useEffect } from 'react'
import type { Task } from '../types'

function Line({ task, now }: { task: Task; now: number }) {
  const options = useApp((s) => s.options)
  const dimensions = useApp((s) => s.dimensions)

  const chips = useMemo(() => {
    const shown = new Map(dimensions.filter((d) => d.showOnCard).map((d) => [d.id, d.order]))
    return options
      .filter((o) => task.optionIds.includes(o.id) && shown.has(o.dimensionId))
      .sort((a, b) => shown.get(a.dimensionId)! - shown.get(b.dimensionId)! || a.order - b.order)
  }, [dimensions, options, task.optionIds])

  const day = task.dueAt ? fmtDayCell(task.dueAt) : null
  const away = task.dueAt !== undefined ? daysUntil(task.dueAt, now) : null
  const late = away !== null && away < 0

  return (
    <button className="brief-row" onClick={() => useUi.getState().openTask(task.id)}>
      <span className="brief-when mono" data-late={late ? '' : undefined} data-soon={away !== null && away <= 1 ? '' : undefined}>
        {task.dueAt ? fmtCountdown(task.dueAt, now) : 'tanpa tanggal'}
      </span>
      <span className="brief-title">{task.title}</span>
      <span className="brief-labels">
        {chips.slice(0, 3).map((o) => (
          <Chip key={o.id} option={o} loud />
        ))}
      </span>
      <span className="brief-date mono" title={task.dueAt ? fmtDayLong(task.dueAt) : undefined}>
        {day ? day.top : '—'}
      </span>
    </button>
  )
}

/** What you have, and how heavy it is. No sessions, no timers — this screen
 *  only answers "apa saja yang saya punya, dan mana yang mendesak". */
export function Focus() {
  const now = useNow(30_000)
  const allTasks = useApp((s) => s.tasks)
  const settings = useApp((s) => s.settings)
  const options = useApp((s) => s.options)
  const tasks = boardTasks({ tasks: allTasks, settings })

  useEffect(() => {
    useOcean.getState().setDepth(0.22)
    return () => useOcean.getState().setDepth(0)
  }, [])

  const data = { tasks, settings }
  const load = useMemo(() => weekLoad(data, now), [tasks, settings, now])
  const days = useMemo(() => loadByDay({ tasks }, 14, now), [tasks, now])
  const soon = useMemo(() => byDueDate({ tasks }, 14, now).slice(0, 8), [tasks, now])
  const important = useMemo(
    () => importantTasks(data).filter((t) => !soon.includes(t)).slice(0, 6),
    [tasks, settings, soon],
  )

  const peak = Math.max(1, ...days.map((d) => d.count))
  const importantNames = (settings.importantOptionIds ?? [])
    .map((id) => options.find((o) => o.id === id)?.name)
    .filter(Boolean)

  return (
    <div className="brief">
      <header className="depths-head">
        <button className="icon-button" onClick={() => useUi.getState().go('surface')} title="Surface">
          <IconSurface size={18} />
        </button>
        <span className="gauge-label">yang kamu punya</span>
      </header>

      <div className="brief-scroll">
        <div className="depths-sheet">
          {/* beban minggu ini */}
          <section className="brief-block">
            <h2 className="heading">Beban</h2>
            <div className="load-figures">
              <div className="load-figure">
                <span className="load-number">{load.thisWeek}</span>
                <span className="gauge-label">7 hari ke depan</span>
              </div>
              <div className="load-figure">
                <span className="load-number" data-warn={load.today > 0 ? '' : undefined}>
                  {load.today}
                </span>
                <span className="gauge-label">hari ini</span>
              </div>
              <div className="load-figure">
                <span className="load-number" data-late={load.overdue > 0 ? '' : undefined}>
                  {load.overdue}
                </span>
                <span className="gauge-label">terlewat</span>
              </div>
              <div className="load-figure">
                <span className="load-number">{load.important}</span>
                <span className="gauge-label">penting</span>
              </div>
              <div className="load-figure">
                <span className="load-number">{load.total}</span>
                <span className="gauge-label">total</span>
              </div>
            </div>

            <div className="load-days">
              {days.map((d) => {
                const cell = fmtDayCell(d.day)
                const heaviest = load.heaviest?.day === d.day && d.count > 1
                return (
                  <div className="load-day" key={d.day} data-peak={heaviest ? '' : undefined}>
                    <span
                      className="load-bar"
                      style={{ height: `${Math.max(2, (d.count / peak) * 46)}px` }}
                      data-empty={d.count === 0 ? '' : undefined}
                    />
                    <span className="load-count mono">{d.count || ''}</span>
                    <span className="load-name mono">{cell.top}</span>
                  </div>
                )
              })}
            </div>

            {load.heaviest && load.heaviest.count > 1 && (
              <p className="brief-note">
                Hari terpadat: <strong>{fmtDayLong(load.heaviest.day)}</strong> — {load.heaviest.count} agenda.
              </p>
            )}
          </section>

          {/* yang terdekat */}
          <section className="brief-block">
            <h2 className="heading">Terdekat</h2>
            {soon.length ? (
              soon.map((t) => <Line key={t.id} task={t} now={now} />)
            ) : (
              <p className="lane-empty gauge-label">tidak ada yang jatuh tempo</p>
            )}
          </section>

          {/* yang penting, walau tanggalnya masih jauh */}
          <section className="brief-block">
            <h2 className="heading">
              Penting
              {importantNames.length ? (
                <span className="gauge-label heading-note">{importantNames.join(' · ')}</span>
              ) : null}
            </h2>
            {important.length ? (
              important.map((t) => <Line key={t.id} task={t} now={now} />)
            ) : (
              <p className="lane-empty gauge-label">
                {importantNames.length
                  ? 'semua yang penting sudah ada di daftar terdekat'
                  : 'pilih label mana yang berarti penting di Settings'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
