import { useEffect } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { useExit, useLast } from '../lib/useExit'

const LIFE_MS = 5000

/** One line, five seconds, and a way back. A second completion replaces it
 *  rather than stacking, so the corner never fills up. */
export function Toast() {
  const live = useUi((s) => s.toast)
  // it says what it said on the way out, rather than blinking off mid-sentence
  const { render, leaving } = useExit(!!live, 260)
  const toast = useLast(live)

  useEffect(() => {
    if (!live) return
    const timer = window.setTimeout(() => useUi.getState().hideToast(), LIFE_MS)
    return () => window.clearTimeout(timer)
  }, [live])

  if (!render || !toast) return null

  return (
    <div className="toast" role="status" data-leaving={leaving ? '' : undefined}>
      <span className="toast-mark" aria-hidden />
      <span className="toast-text">
        {toast.taskId !== 'save-error' && <span className="gauge-label">selesai</span>}{' '}
        {toast.title}
      </span>
      {toast.taskId === 'save-error' ? (
        <button className="quiet-button" onClick={() => useUi.getState().hideToast()}>
          tutup
        </button>
      ) : (
        <button
          className="quiet-button"
          onClick={() => {
            useApp.getState().toggleDone(toast.taskId)
            useUi.getState().hideToast()
          }}
        >
          urungkan
        </button>
      )}
    </div>
  )
}
