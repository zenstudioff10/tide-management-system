import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { IconCheck, IconClose } from '../design/icons'
import { bloom } from '../lib/chime'
import { useExit, useLast } from '../lib/useExit'

/** How long the row takes to rise and dissolve before it actually completes. */
export const CLEAR_MS = 850
/** How long you hold the button before it lets go. */
const HOLD_MS = 620

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Finish a task: hold it open while it animates away, then mark it done and
 *  leave an undo behind. Exported for the `x` shortcut in Depths. */
export function completeTask(taskId: string) {
  const app = useApp.getState()
  const ui = useUi.getState()
  const task = app.tasks.find((t) => t.id === taskId)
  if (!task) return

  // the sound lands with the press, not after the animation
  bloom(app.settings.uiSounds === false ? 0 : app.settings.chimeVolume)

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

/** Anchored where you clicked, and never completed by a single click: the ring
 *  fills while you hold it and lets go on its own. Deleting wears the same
 *  gesture in coral, so one habit covers both and the colour carries the risk. */
export function ConfirmHold() {
  const live = useUi((s) => s.confirm)
  const { render, leaving } = useExit(!!live, 180)
  // it needs its title and its corner to close around
  const confirm = useLast(live)
  const [holding, setHolding] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const button = useRef<HTMLButtonElement>(null)

  const stopHold = () => {
    window.clearTimeout(timer.current)
    setHolding(false)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        stopHold()
        useUi.getState().cancelConfirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  if (!render || !confirm) return null

  const deleting = confirm.kind === 'delete'

  const fire = () => {
    stopHold()
    const r = button.current?.getBoundingClientRect()
    if (r) useUi.getState().fireBurst(r.left + r.width / 2, r.top + r.height / 2)
    confirm.onConfirm()
    useUi.getState().cancelConfirm()
  }

  const startHold = () => {
    if (reducedMotion()) return fire()
    setHolding(true)
    timer.current = window.setTimeout(fire, HOLD_MS)
  }

  // keep the panel on screen when whatever you clicked sits near an edge
  const left = Math.min(confirm.x, window.innerWidth - 260)
  const top = Math.min(confirm.y, window.innerHeight - 190)

  return (
    <>
      <div
        className="confirm-catcher"
        data-leaving={leaving ? '' : undefined}
        onMouseDown={() => {
          stopHold()
          useUi.getState().cancelConfirm()
        }}
      />
      <div
        className="popover-panel confirm-panel"
        data-kind={confirm.kind}
        data-leaving={leaving ? '' : undefined}
        style={{ left, top }}
      >
        <span className="gauge-label">{deleting ? 'hapus ini?' : 'tandai selesai?'}</span>
        <p className="confirm-title">{confirm.title}</p>
        {confirm.note && <p className="gauge-label confirm-note">{confirm.note}</p>}

        <div className="confirm-hold">
          <button
            ref={button}
            className="hold-button"
            data-holding={holding ? '' : undefined}
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={deleting ? 'Tahan untuk menghapus' : 'Tahan untuk menyelesaikan'}
          >
            <svg viewBox="0 0 48 48" className="hold-ring" aria-hidden>
              <circle className="hold-track" cx="24" cy="24" r="21" />
              <circle className="hold-fill" cx="24" cy="24" r="21" />
            </svg>
            {deleting ? (
              <IconClose size={18} className="hold-check" />
            ) : (
              <IconCheck size={18} className="hold-check" />
            )}
          </button>
          <span className="gauge-label hold-hint">
            {holding ? 'terus tahan…' : deleting ? 'tahan untuk hapus' : 'tahan untuk selesai'}
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
