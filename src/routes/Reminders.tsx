import { useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { useNow } from '../lib/useNow'
import { fmtDateLine, fmtRelative, fmtTimeShort, sameDay } from '../lib/time'
import { IconBuoy, IconClose, IconSurface } from '../design/icons'
import type { RepeatKind } from '../types'

const REPEATS: { value: RepeatKind | 'none'; label: string }[] = [
  { value: 'none', label: 'once' },
  { value: 'daily', label: 'daily' },
  { value: 'weekdays', label: 'weekdays' },
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' },
]

const todayInput = () => new Date().toISOString().slice(0, 10)

export function Reminders() {
  const now = useNow(1000)
  const reminders = useApp((s) => s.reminders)
  const clock24h = useApp((s) => s.settings.clock24h)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayInput())
  const [time, setTime] = useState('09:00')
  const [repeat, setRepeat] = useState<RepeatKind | 'none'>('none')

  const add = () => {
    if (!title.trim()) return
    useApp.getState().addReminder({
      title: title.trim(),
      at: new Date(`${date}T${time}`).getTime(),
      repeat: repeat === 'none' ? undefined : { kind: repeat, interval: 1 },
    })
    setTitle('')
  }

  const sorted = [...reminders].sort((a, b) => (a.snoozedUntil ?? a.at) - (b.snoozedUntil ?? b.at))
  const live = sorted.filter((r) => !r.done)
  const past = sorted.filter((r) => r.done).slice(-8).reverse()

  return (
    <div className="reminders">
      <header className="depths-head">
        <button className="icon-button" onClick={() => useUi.getState().go('surface')} title="Surface">
          <IconSurface size={18} />
        </button>
        <span className="gauge-label">buoys</span>
      </header>

      <section className="reminder-compose">
        <IconBuoy size={18} className="reminder-compose-mark" />
        <input
          className="reminder-title"
          value={title}
          spellCheck={false}
          placeholder="moor something to a time…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
            e.stopPropagation()
          }}
        />
        <input type="date" className="field mono" value={date} onChange={(e) => setDate(e.target.value)} />
        <input type="time" className="field mono" value={time} onChange={(e) => setTime(e.target.value)} />
        <select
          className="field"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatKind | 'none')}
        >
          {REPEATS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button className="quiet-button" onClick={add}>
          moor
        </button>
      </section>

      <div className="reminder-list">
        {live.map((r) => {
          const at = r.snoozedUntil ?? r.at
          const ringing = at <= now
          return (
            <article key={r.id} className="reminder" data-ringing={ringing ? '' : undefined}>
              <span className="mono reminder-time">{fmtTimeShort(at, clock24h)}</span>
              <div className="reminder-main">
                <p className="reminder-label">{r.title}</p>
                <span className="gauge-label">
                  {sameDay(at, now) ? 'today' : fmtDateLine(at)} · {fmtRelative(at, now)}
                  {r.repeat ? ` · ${r.repeat.kind}` : ''}
                  {r.snoozedUntil ? ' · snoozed' : ''}
                </span>
              </div>
              {ringing && (
                <div className="reminder-snoozes">
                  {[5, 15, 60].map((m) => (
                    <button
                      key={m}
                      className="quiet-button subtle"
                      onClick={() => useApp.getState().snooze(r.id, m)}
                    >
                      +{m}m
                    </button>
                  ))}
                </div>
              )}
              <button
                className="quiet-button subtle"
                onClick={() => useApp.getState().updateReminder(r.id, { done: true })}
              >
                done
              </button>
              <button
                className="icon-button"
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect()
                  useUi.getState().askConfirm({
                    kind: 'delete',
                    title: r.title,
                    x: box.left - 220,
                    y: box.top + 24,
                    onConfirm: () => useApp.getState().deleteReminder(r.id),
                  })
                }}
              >
                <IconClose size={14} />
              </button>
            </article>
          )
        })}
        {!live.length && <p className="lane-empty gauge-label">nothing moored</p>}

        {past.length > 0 && (
          <>
            <span className="gauge-label reminder-past-head">passed</span>
            {past.map((r) => (
              <article key={r.id} className="reminder reminder-past">
                <span className="mono reminder-time">{fmtTimeShort(r.at, clock24h)}</span>
                <p className="reminder-label">{r.title}</p>
                <button
                  className="icon-button"
                  onClick={(e) => {
                    const box = e.currentTarget.getBoundingClientRect()
                    useUi.getState().askConfirm({
                      kind: 'delete',
                      title: r.title,
                      x: box.left - 220,
                      y: box.top + 24,
                      onConfirm: () => useApp.getState().deleteReminder(r.id),
                    })
                  }}
                >
                  <IconClose size={14} />
                </button>
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
