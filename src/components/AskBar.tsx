import { useState } from 'react'
import { useUi } from '../store/useUi'

/** The way in. Type a question here and the chat opens already answering it —
 *  the same local assistant ⌘K reaches, just no longer hidden behind it. */
export function AskBar() {
  const [value, setValue] = useState('')

  const ask = () => {
    const question = value.trim()
    if (!question) return useUi.getState().setPalette(true)
    useUi.getState().askChat(question)
    setValue('')
  }

  return (
    <div className="ask-bar">
      <span className="ask-mark" aria-hidden />
      <input
        value={value}
        spellCheck={false}
        placeholder="tanya soal jadwalmu — minggu ini ada apa…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ask()
          if (e.key === 'Escape') setValue('')
          e.stopPropagation()
        }}
      />
      <span className="gauge-label ask-hint">⌘K</span>
    </div>
  )
}
