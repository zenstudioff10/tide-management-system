import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { HELP, respond, type Memory, type Reply } from '../lib/assistant'
import { Chip } from './Chip'
import { fmtCountdown, fmtDayCell } from '../lib/time'
import type { Route } from '../types'

interface Command {
  id: string
  label: string
  run: () => void
}

interface Turn {
  id: number
  question: string
  reply: Reply
}

/** ⌘K is where you ask. It answers about the schedule and nothing else; when
 *  what you typed is a command instead, the commands offer themselves below. */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const setPalette = useUi((s) => s.setPalette)
  const dimensions = useApp((s) => s.dimensions)
  const tasks = useApp((s) => s.tasks)
  const boards = useApp((s) => s.boards)
  const options = useApp((s) => s.options)
  const settings = useApp((s) => s.settings)

  const [query, setQuery] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [memory, setMemory] = useState<Memory>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setTurns([])
    setMemory({})
    window.setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const commands = useMemo<Command[]>(() => {
    const go = (route: Route, label: string): Command => ({
      id: `go-${route}`,
      label,
      run: () => useUi.getState().go(route),
    })
    const list: Command[] = [
      go('surface', 'Surface'),
      go('depths', 'Depths'),
      go('focus', 'Focus'),
      go('timer', 'Timer'),
      go('reminders', 'Reminders'),
      go('settings', 'Settings'),
    ]
    for (const d of dimensions) {
      list.push({
        id: `group-${d.id}`,
        label: `Kelompokkan per ${d.name}`,
        run: () => {
          useUi.getState().setGroupBy(d.id)
          useUi.getState().go('depths')
        },
      })
    }
    return list
  }, [dimensions])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 4)
  }, [commands, query])

  if (!open) return null

  const send = () => {
    const question = query.trim()
    if (!question) return
    const reply = respond(
      question,
      { tasks, boards, options, dimensions, settings },
      Date.now(),
      memory,
    )
    setTurns((t) => [...t, { id: Date.now(), question, reply }])
    setMemory(reply.memory)
    setQuery('')
  }

  return (
    <div className="palette-scrim" onMouseDown={() => setPalette(false)}>
      <div className="palette chat" onMouseDown={(e) => e.stopPropagation()}>
        <div className="chat-scroll" ref={scroller}>
          {turns.length === 0 && <p className="chat-greeting">{HELP}</p>}

          {turns.map((turn) => (
            <div key={turn.id} className="chat-turn">
              <p className="chat-question">{turn.question}</p>
              <p className="chat-answer">{turn.reply.text}</p>

              {turn.reply.tasks.length > 0 && (
                <ul className="chat-list">
                  {turn.reply.tasks.slice(0, 6).map((t) => {
                    const labels = options
                      .filter((o) => t.optionIds.includes(o.id))
                      .sort((a, b) => a.order - b.order)
                      .slice(0, 3)
                    return (
                      <li key={t.id}>
                        <button
                          className="chat-row"
                          onClick={() => {
                            useUi.getState().openTask(t.id)
                            setPalette(false)
                          }}
                        >
                          <span className="chat-when mono">
                            {t.dueAt ? fmtDayCell(t.dueAt).top : '—'}
                          </span>
                          <span className="chat-title">{t.title}</span>
                          <span className="chat-labels">
                            {labels.map((o) => (
                              <Chip key={o.id} option={o} loud />
                            ))}
                          </span>
                          <span className="gauge-label chat-away">
                            {t.dueAt ? fmtCountdown(t.dueAt) : ''}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {turn.reply.tasks.length > 6 && (
                    <li className="gauge-label chat-more">
                      dan {turn.reply.tasks.length - 6} lagi
                    </li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="chat-compose">
          <span className="chat-mark" aria-hidden />
          <input
            ref={inputRef}
            className="chat-input"
            value={query}
            spellCheck={false}
            placeholder="tanya soal jadwalmu…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
              if (e.key === 'Escape') setPalette(false)
              e.stopPropagation()
            }}
          />
        </div>

        {matches.length > 0 && (
          <div className="chat-commands">
            <span className="gauge-label">atau buka:</span>
            {matches.map((c) => (
              <button
                key={c.id}
                className="quiet-button subtle"
                onClick={() => {
                  c.run()
                  setPalette(false)
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
