import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { IconCheck } from '../design/icons'

/** How long the row takes to rise and dissolve before it actually completes. */
export const CLEAR_MS = 850
/** How long you hold the button before it lets go. */
const HOLD_MS = 620

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Finish a task: hold it open while it animates away, then mark it done and
 *  leave an undo behind. */
export function completeTask(taskId: string) {
  const app = useApp.getState()
  const ui = useUi.getState()
  const task = app.tasks.find((t) => t.id === taskId)
  if (!task) return

  const finish = () => {
    app.toggleDone(taskId)
    useUi.getState().endClearing(taskId)
    useUi.getState().showToast(taskId, task.title)
  }

  if (reducedMotion()) {
    ui.cancelConfirm()
    finish()
    return
  }

  ui.beginClearing(taskId)
  window.setTimeout(finish, CLEAR_MS)
}

/** A small panel anchored where the circle was clicked. Nothing completes on a
 *  single click — you hold the ring until it fills, and it bursts on release. */
export function ConfirmDone() {
  const confirming = useUi((s) => s.confirming)
  const task = useApp((s) => s.tasks.find((t) => t.id === confirming?.taskId))
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const button = useRef<HTMLButtonElement>(null)

  const stopHold = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        stopHold()
        useUi.getState().cancelConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  if (!confirming || !task) return null

  const startHold = () => {
    if (reducedMotion()) return release(true)
    setHolding(true)
    timer.current = window.setTimeout(() => release(true), HOLD_MS)
  }

  /** `full` is true only when the ring actually finished filling */
  const release = (full: boolean) => {
    stopHold()
    if (!full) return
    const r = button.current?.getBoundingClientRect()
    if (r) useUi.getState().fireBurst(r.left + r.width / 2, r.top + r.height / 2)
    completeTask(task.id)
  }

  // keep the panel on screen when the row sits near an edge
  const left = Math.min(confirming.x, window.innerWidth - 260)
  const top = Math.min(confirming.y, window.innerHeight - 170)

  return (
    <>
      <div
        className="confirm-catcher"
        onMouseDown={() => {
          stopHold()
          useUi.getState().cancelConfirm()
        }}
      />
      <div className="popover-panel confirm-panel" style={{ left, top }}>
        <span className="gauge-label">tandai selesai?</span>
        <p className="confirm-title">{task.title}</p>

        <div className="confirm-hold">
          <button
            ref={button}
            className="hold-button"
            data-holding={holding ? '' : undefined}
            onPointerDown={startHold}
            onPointerUp={() => release(false)}
            onPointerLeave={() => release(false)}
            aria-label="Tahan untuk menyelesaikan"
          >
            <svg viewBox="0 0 48 48" className="hold-ring" aria-hidden>
              <circle className="hold-track" cx="24" cy="24" r="21" />
              <circle className="hold-fill" cx="24" cy="24" r="21" />
            </svg>
            <IconCheck size={18} className="hold-check" />
          </button>
          <span className="gauge-label hold-hint">
            {holding ? 'terus tahan…' : 'tahan untuk selesai'}
          </span>
        </div>

        <button
          className="quiet-button subtle confirm-cancel"
          onClick={() => useUi.getState().cancelConfirm()}
        >
          batal
        </button>
      </div>
    </>
  )
}
