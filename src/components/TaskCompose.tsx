import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { Chip } from './Chip'
import { IconClose, IconPlus } from '../design/icons'
import { quickParse } from '../lib/quickparse'
import { addDays, fmtDayLong, startOfDay } from '../lib/time'
import { OPTION_COLORS } from '../ocean/palette'

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const nine = (t: number) => startOfDay(t) + 9 * 3_600_000

/** Making a task without knowing any syntax: type it, tap the labels, pick a
 *  day. The typed shorthand still works — whatever it understood arrives here
 *  already filled in. */
export function TaskCompose() {
  const seed = useUi((s) => s.composing)
  const dimensions = useApp((s) => s.dimensions)
  const options = useApp((s) => s.options)
  const boards = useApp((s) => s.boards)
  const activeBoardId = useApp((s) => s.settings.activeBoardId)
  const autoWeekOptionId = useApp((s) => s.settings.autoWeekOptionId)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [chosen, setChosen] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [boardId, setBoardId] = useState<string | undefined>(undefined)
  const [newOptionIn, setNewOptionIn] = useState<string | null>(null)
  const [newOptionName, setNewOptionName] = useState('')

  // seed from whatever was typed in the capture bar
  useEffect(() => {
    if (seed === null) return
    const parsed = quickParse(seed, options)
    setTitle(parsed.title || seed)
    setChosen(parsed.optionIds)
    setNotes('')
    if (parsed.dueAt) {
      setDate(toDateInput(parsed.dueAt))
      const d = new Date(parsed.dueAt)
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
    } else {
      setDate('')
      setTime('09:00')
    }
    setNewOptionIn(null)
    setNewOptionName('')
    setBoardId(
      activeBoardId && activeBoardId !== 'all'
        ? activeBoardId
        : [...boards].sort((a, b) => a.order - b.order)[0]?.id,
    )
  }, [seed, options, activeBoardId, boards])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useUi.getState().confirm) return
      if (e.key === 'Escape') useUi.getState().endCompose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
    }
    if (seed !== null) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const dueAt = useMemo(() => {
    if (!date) return undefined
    return new Date(`${date}T${time || '09:00'}`).getTime()
  }, [date, time])

  if (seed === null) return null

  const toggle = (optionId: string) => {
    const option = options.find((o) => o.id === optionId)
    if (!option) return
    const dimension = dimensions.find((d) => d.id === option.dimensionId)
    const siblings = options
      .filter((o) => o.dimensionId === option.dimensionId)
      .map((o) => o.id)

    setChosen((current) => {
      if (current.includes(optionId)) return current.filter((x) => x !== optionId)
      const kept = dimension?.kind === 'single' ? current.filter((x) => !siblings.includes(x)) : current
      return [...kept, optionId]
    })
  }

  const save = () => {
    const name = title.trim()
    if (!name) return
    useApp.getState().addTask({
      title: name,
      notes: notes.trim(),
      optionIds: chosen,
      dueAt,
      boardId,
    })
    useUi.getState().endCompose()
  }

  const quickDay = (label: string, when: number | null) => (
    <button
      key={label}
      className="quiet-button subtle"
      data-on={
        (when === null && !date) || (when !== null && date === toDateInput(when)) ? '' : undefined
      }
      onClick={() => setDate(when === null ? '' : toDateInput(when))}
    >
      {label}
    </button>
  )

  const today = Date.now()

  return (
    <>
      <div className="drawer-scrim" onClick={() => useUi.getState().endCompose()} />
      <aside className="drawer compose">
        <div className="drawer-head">
          <span className="gauge-label">tugas baru</span>
          <button className="icon-button" onClick={() => useUi.getState().endCompose()} aria-label="Close">
            <IconClose size={16} />
          </button>
        </div>

        <input
          className="drawer-title display"
          value={title}
          autoFocus
          spellCheck={false}
          placeholder="apa yang harus dikerjakan"
          onChange={(e) => setTitle(e.target.value)}
        />

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
                    data-active={boardId === b.id ? '' : undefined}
                    onClick={() => setBoardId(b.id)}
                  >
                    <span
                      className="chip-dot"
                      style={{ background: boardId === b.id ? 'var(--tod-light)' : 'var(--ink-4)' }}
                    />
                    {b.name}
                  </button>
                ))}
            </div>
          </section>
        )}

        <section className="drawer-block">
          <span className="gauge-label">kapan</span>
          <div className="drawer-fields">
            {quickDay('hari ini', nine(today))}
            {quickDay('besok', nine(addDays(today, 1)))}
            {quickDay('lusa', nine(addDays(today, 2)))}
            {quickDay('minggu depan', nine(addDays(today, 7)))}
            {quickDay('tanpa tanggal', null)}
          </div>
          <div className="drawer-fields">
            <input
              type="date"
              className="field mono"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              type="time"
              className="field mono"
              value={time}
              disabled={!date}
              onChange={(e) => setTime(e.target.value)}
            />
            {dueAt && <span className="gauge-label">{fmtDayLong(dueAt)}</span>}
          </div>
        </section>

        {dimensions.map((dimension) => {
          const own = options
            .filter((o) => o.dimensionId === dimension.id)
            .sort((a, b) => a.order - b.order)
          return (
            <section key={dimension.id} className="drawer-block">
              <span className="gauge-label">
                {dimension.name}
                {dimension.kind === 'multi' ? ' · boleh banyak' : ''}
              </span>
              <div className="chip-row">
                {own.map((o) =>
                  o.id === autoWeekOptionId ? (
                    <span key={o.id} className="chip-auto">
                      <Chip option={o} dim />
                      <span className="gauge-label">otomatis</span>
                    </span>
                  ) : (
                    <Chip
                      key={o.id}
                      option={o}
                      active={chosen.includes(o.id)}
                      onClick={() => toggle(o.id)}
                    />
                  ),
                )}
                {newOptionIn === dimension.id ? (
                  <input
                    className="field option-inline"
                    autoFocus
                    value={newOptionName}
                    placeholder="nama label"
                    onChange={(e) => setNewOptionName(e.target.value)}
                    onBlur={() => setNewOptionIn(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setNewOptionIn(null)
                      if (e.key !== 'Enter' || !newOptionName.trim()) return
                      const created = useApp
                        .getState()
                        .addOption(
                          dimension.id,
                          newOptionName.trim(),
                          OPTION_COLORS[own.length % OPTION_COLORS.length],
                        )
                      toggle(created.id)
                      setNewOptionName('')
                      setNewOptionIn(null)
                    }}
                  />
                ) : (
                  <button
                    className="icon-button chip-add"
                    title={`New value in ${dimension.name}`}
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

        <section className="drawer-block">
          <span className="gauge-label">catatan</span>
          <textarea
            className="drawer-notes"
            rows={2}
            value={notes}
            placeholder="opsional"
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        <div className="drawer-foot">
          <button className="quiet-button" onClick={save} disabled={!title.trim()}>
            simpan · ⌘⏎
          </button>
          <button className="quiet-button subtle" onClick={() => useUi.getState().endCompose()}>
            batal
          </button>
        </div>
      </aside>
    </>
  )
}
