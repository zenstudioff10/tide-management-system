import { useEffect, useMemo, useRef } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { useNow } from '../lib/useNow'
import { fmtClock, fmtDateLine, fmtDayCell, meridiem, sameDay, startOfDay } from '../lib/time'
import { WeekLoad } from '../components/WeekLoad'
import { boardTasks } from '../store/selectors'
import { TideLine } from '../components/TideLine'
import { QuickAdd } from '../components/QuickAdd'
import { IconBuoy, IconDepths, IconFocus, IconSettings, IconTimer } from '../design/icons'
import { Chip } from '../components/Chip'
import { useIntro } from '../intro/useIntro'
import type { Route } from '../types'

function Stone({
  label,
  route,
  index,
  children,
}: {
  label: string
  route: Route
  index: number
  children: React.ReactNode
}) {
  const go = useUi((s) => s.go)
  return (
    <button className="stone" style={{ ['--i' as string]: index }} onClick={() => go(route)}>
      <span className="stone-face">{children}</span>
      <span className="gauge-label">{label}</span>
    </button>
  )
}

/** The Surface. The hour is written in the water before it is written in type. */
export function Surface() {
  const now = useNow(1000)
  const wordmark = useRef<HTMLSpanElement>(null)

  // FLIP: measure where the wordmark rests, then let the keyframe start it
  // centred and large and travel back to exactly here
  useEffect(() => {
    if (useIntro.getState().done) return
    const el = wordmark.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const scale = 3.1
    const dx = window.innerWidth / 2 - r.left - (r.width * scale) / 2
    const dy = window.innerHeight / 2 - (r.top + r.height / 2)
    el.style.setProperty('--wm-dx', `${Math.round(dx)}px`)
    el.style.setProperty('--wm-dy', `${Math.round(dy)}px`)
  }, [])

  const settings = useApp((s) => s.settings)
  const reminders = useApp((s) => s.reminders)
  const allTasks = useApp((s) => s.tasks)
  const options = useApp((s) => s.options)
  const tasks = boardTasks({ tasks: allTasks, settings })

  // what you actually have, on the screen the app opens to
  const agenda = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'open')
    const dated = open
      .filter((t) => t.dueAt)
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
    const undated = open.filter((t) => !t.dueAt)
    return [...dated, ...undated].slice(0, 9)
  }, [tasks])

  const nextBuoy = useMemo(() => {
    const live = reminders
      .filter((r) => !r.done && (r.snoozedUntil ?? r.at) > now)
      .sort((a, b) => (a.snoozedUntil ?? a.at) - (b.snoozedUntil ?? b.at))
    return live[0] ?? null
  }, [reminders, now])

  const openCount = tasks.filter((t) => t.status === 'open').length
  const overdue = tasks.filter(
    (t) => t.status === 'open' && t.dueAt && startOfDay(t.dueAt) < startOfDay(now),
  ).length
  const dueToday = tasks.filter(
    (t) => t.status === 'open' && t.dueAt && sameDay(t.dueAt, now),
  ).length

  return (
    <div className="surface">
      <header className="surface-head">
        <span className="wordmark display" ref={wordmark}>
          tide
        </span>
        <div className="surface-head-right">
          <span className="gauge-label surface-count">
            {overdue > 0 && <span className="surface-count-late">{overdue} terlewat · </span>}
            {dueToday} hari ini · {openCount} total
          </span>
          <button
            className="icon-button"
            onClick={() => useUi.getState().go('settings')}
            title="Settings"
          >
            <IconSettings size={17} />
          </button>
        </div>
      </header>

      <div className="surface-clock">
        <h1 className="clock display">
          {fmtClock(now, settings.clock24h, settings.showSeconds)}
          {!settings.clock24h && <span className="clock-meridiem">{meridiem(now)}</span>}
        </h1>
        <p className="surface-date">{fmtDateLine(now)}</p>
      </div>

      <aside className="surface-next">
        <button className="agenda-head" onClick={() => useUi.getState().go('depths')}>
          <span className="gauge-label">yang kamu punya</span>
          <span className="gauge-label agenda-more">semua →</span>
        </button>

        {agenda.length === 0 ? (
          <p className="surface-next-empty">still water — nothing waiting</p>
        ) : (
          <ul className="agenda">
            {agenda.map((t, index) => {
              const day = t.dueAt ? fmtDayCell(t.dueAt) : null
              const late = t.dueAt !== undefined && startOfDay(t.dueAt) < startOfDay(now)
              const isToday = t.dueAt !== undefined && sameDay(t.dueAt, now)
              const labels = options
                .filter((o) => t.optionIds.includes(o.id))
                .sort((a, b) => a.order - b.order)
                .slice(0, 2)
              return (
                <li key={t.id} style={{ ['--i' as string]: index }}>
                  <button className="agenda-row" onClick={() => useUi.getState().openTask(t.id)}>
                    <span
                      className="agenda-day mono"
                      data-late={late ? '' : undefined}
                      data-today={isToday ? '' : undefined}
                    >
                      {day ? day.top : '—'}
                    </span>
                    <span className="agenda-title">{t.title}</span>
                    <span className="agenda-labels">
                      {labels.map((o) => (
                        <Chip key={o.id} option={o} loud />
                      ))}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {nextBuoy && (
          <p className="gauge-label agenda-buoy">
            buoy · {nextBuoy.title}
          </p>
        )}
      </aside>

      <div className="surface-tide">
        <TideLine now={now} />
      </div>

      <footer className="surface-foot">
        <WeekLoad now={now} />
        <nav className="stones">
          <Stone label="depths" route="depths" index={0}>
            <IconDepths size={22} />
          </Stone>
          <Stone label="focus" route="focus" index={1}>
            <IconFocus size={22} />
          </Stone>
          <Stone label="timer" route="timer" index={2}>
            <IconTimer size={22} />
          </Stone>
          <Stone label="reminders" route="reminders" index={3}>
            <IconBuoy size={22} />
          </Stone>
        </nav>
      </footer>

      <div className="surface-capture">
        <QuickAdd placeholder="drop something into the water…" />
      </div>
    </div>
  )
}
