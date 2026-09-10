import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { quickParse } from '../lib/quickparse'
import { useUi } from '../store/useUi'
import { IconPlus } from '../design/icons'

interface Props {
  placeholder?: string
  /** when added from inside a lane, the task lands in that lane */
  presetOptionIds?: string[]
  /** date lanes have no option to inherit — they hand down a day instead */
  presetDueAt?: number
  autoFocus?: boolean
  onAdded?: (taskId: string) => void
}

export function QuickAdd({
  placeholder = 'add to the water…',
  presetOptionIds,
  presetDueAt,
  autoFocus,
  onAdded,
}: Props) {
  const [value, setValue] = useState('')
  const options = useApp((s) => s.options)
  const addTask = useApp((s) => s.addTask)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => quickParse(value, options), [value, options])

  const submit = () => {
    const title = parsed.title.trim()
    if (!title) return
    const merged = [...new Set([...(presetOptionIds ?? []), ...parsed.optionIds])]
    const task = addTask({
      title,
      optionIds: merged,
      dueAt: parsed.dueAt ?? presetDueAt,
    })
    setValue('')
    onAdded?.(task.id)
  }

  return (
    <div className="quick-add">
      <span className="quick-add-mark" aria-hidden />
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // ⌘⏎ hands what you typed to the full form instead of filing it
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            useUi.getState().startCompose(value)
            setValue('')
            return
          }
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setValue('')
            inputRef.current?.blur()
          }
          e.stopPropagation()
        }}
      />
      {value.trim() && (
        <span className="quick-add-hints">
          {parsed.hints.length ? parsed.hints.join(' · ') : '#label · besok · 3pm'}
        </span>
      )}
      <button
        className="icon-button quick-add-more"
        title="Full form — labels, date, time"
        onClick={() => {
          useUi.getState().startCompose(value)
          setValue('')
        }}
      >
        <IconPlus size={16} />
      </button>
    </div>
  )
}
