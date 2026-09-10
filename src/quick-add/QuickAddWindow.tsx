import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { quickParse } from '../lib/quickparse'
import type { AppData, DimOption } from '../types'

/** The bar the global hotkey summons. It never writes to tide.json — it hands
 *  the line to the main window, which owns every write. */
export function QuickAddWindow() {
  const [value, setValue] = useState('')
  const [options, setOptions] = useState<DimOption[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // read-only peek at the labels, so the echo line can name what matched
  useEffect(() => {
    void invoke<string | null>('load_data')
      .then((raw) => {
        if (raw) setOptions((JSON.parse(raw) as AppData).options ?? [])
      })
      .catch(() => setOptions([]))
  }, [])

  useEffect(() => {
    const win = getCurrentWindow()
    const focus = () => {
      setValue('')
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
    focus()
    const unlistenFocus = win.onFocusChanged(({ payload }) => {
      if (payload) focus()
      else void invoke('hide_capture')
    })
    return () => {
      void unlistenFocus.then((off) => off())
    }
  }, [])

  const parsed = useMemo(() => quickParse(value, options), [value, options])

  const send = async () => {
    const text = value.trim()
    setValue('')
    if (text) await invoke('submit_capture', { text })
    else await invoke('hide_capture')
  }

  return (
    <div className="capture">
      <span className="capture-mark" aria-hidden />
      <input
        ref={inputRef}
        value={value}
        spellCheck={false}
        placeholder="what needs to exist…"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void send()
          if (e.key === 'Escape') void invoke('hide_capture')
        }}
      />
      <span className="capture-hints gauge-label">
        {value.trim() && parsed.hints.length ? parsed.hints.join(' · ') : '#label · tmr 3pm · ~2p'}
      </span>
    </div>
  )
}
