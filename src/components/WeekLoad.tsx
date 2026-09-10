import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { boardTasks, loadByDay, weekLoad } from '../store/selectors'
import { fmtDayCell } from '../lib/time'

/** The fortnight ahead as a row of bars, with the two numbers that matter.
 *  Sits where the dive gauge used to — it answers a more useful question. */
export function WeekLoad({ now }: { now: number }) {
  const allTasks = useApp((s) => s.tasks)
  const settings = useApp((s) => s.settings)
  const tasks = boardTasks({ tasks: allTasks, settings })

  const load = weekLoad({ tasks, settings }, now)
  const days = loadByDay({ tasks }, 10, now)
  const peak = Math.max(1, ...days.map((d) => d.count))

  return (
    <button className="week-load" onClick={() => useUi.getState().go('focus')}>
      <span className="week-figures">
        <span className="week-number">{load.thisWeek}</span>
        <span className="gauge-label">7 hari ke depan</span>
        {load.important > 0 && (
          <span className="gauge-label week-important">{load.important} penting</span>
        )}
      </span>

      <span className="week-days">
        {days.map((d) => (
          <span className="week-day" key={d.day}>
            <span
              className="week-bar"
              data-empty={d.count === 0 ? '' : undefined}
              style={{ height: `${Math.max(2, (d.count / peak) * 26)}px` }}
            />
            <span className="week-name mono">{fmtDayCell(d.day).top.slice(0, 3)}</span>
          </span>
        ))}
      </span>
    </button>
  )
}
