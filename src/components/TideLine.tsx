import { useApp } from '../store/useApp'
import { dayProgress, fmtTimeShort, parseHM, sameDay, startOfDay } from '../lib/time'

interface Buoy {
  id: string
  at: number
  title: string
  x: number
}

/** The working day drawn as a waterline: what has drained, what is left,
 *  and every reminder moored along it. */
export function TideLine({ now }: { now: number }) {
  const settings = useApp((s) => s.settings)
  const reminders = useApp((s) => s.reminders)
  const tasks = useApp((s) => s.tasks)

  const progress = dayProgress(now, settings.dayStart, settings.dayEnd)
  const base = startOfDay(now)
  const from = base + parseHM(settings.dayStart) * 60_000
  const to = base + parseHM(settings.dayEnd) * 60_000
  const span = Math.max(1, to - from)

  const place = (at: number) => ((at - from) / span) * 100

  const buoys: Buoy[] = []
  for (const r of reminders) {
    const at = r.snoozedUntil ?? r.at
    if (r.done || !sameDay(at, now)) continue
    buoys.push({ id: r.id, at, title: r.title, x: place(at) })
  }
  for (const t of tasks) {
    if (t.status !== 'open' || !t.dueAt || !sameDay(t.dueAt, now)) continue
    buoys.push({ id: t.id, at: t.dueAt, title: t.title, x: place(t.dueAt) })
  }

  return (
    <div className="tide-line">
      <div className="tide-track">
        <div className="tide-drained" style={{ width: `${progress * 100}%` }} />
        <div className="tide-now" style={{ left: `${progress * 100}%` }} />
        {buoys
          .filter((b) => b.x >= -2 && b.x <= 102)
          .map((b) => (
            <span
              key={b.id}
              className="tide-buoy"
              style={{ left: `${Math.min(100, Math.max(0, b.x))}%` }}
              title={`${fmtTimeShort(b.at, settings.clock24h)} · ${b.title}`}
            />
          ))}
      </div>
      <div className="tide-scale">
        <span className="gauge-label">{settings.dayStart}</span>
        <span className="gauge-label">{Math.round(progress * 100)}% drained</span>
        <span className="gauge-label">{settings.dayEnd}</span>
      </div>
    </div>
  )
}
