import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { listen, voiceSupported } from '../lib/voice'
import { IconMic } from '../design/icons'

const SUPPORTED = voiceSupported()

/** Press, say the question, and it goes where a typed one would. It is not
 *  drawn at all where the browser has no recogniser, or where the switch in
 *  Settings is off. */
export function MicButton({
  onPartial,
  onHeard,
  label = 'Tanya dengan suara',
}: {
  onPartial?: (text: string) => void
  onHeard: (text: string) => void
  label?: string
}) {
  const on = useApp((s) => s.settings.voice !== false)
  const [state, setState] = useState<'idle' | 'listening' | 'denied'>('idle')
  const stop = useRef<(() => void) | null>(null)

  // a mic left open because a route changed is a mic nobody asked for
  useEffect(() => () => stop.current?.(), [])

  if (!SUPPORTED || !on) return null

  const toggle = () => {
    if (stop.current) {
      stop.current()
      stop.current = null
      return
    }
    setState('listening')
    stop.current = listen({
      onPartial,
      onFinal: (text) => onHeard(text),
      onError: (kind) => setState(kind === 'not-allowed' ? 'denied' : 'idle'),
      onEnd: () => {
        stop.current = null
        setState((s) => (s === 'denied' ? 'denied' : 'idle'))
      },
    })
  }

  return (
    <button
      className="icon-button mic-button"
      data-state={state}
      title={state === 'denied' ? 'Mikrofon ditolak — izinkan di browser' : label}
      aria-label={label}
      aria-pressed={state === 'listening'}
      onClick={toggle}
    >
      <IconMic size={17} />
      <span className="mic-ring" aria-hidden />
    </button>
  )
}
