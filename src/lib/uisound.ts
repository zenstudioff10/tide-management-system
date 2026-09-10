/** The interface's sounds, wired once at the document instead of in forty
 *  components. Two listeners, both passive, both in the capture phase so a
 *  handler that stops propagation still gets its sound. */

import { graze, tap } from './chime'
import { useApp } from '../store/useApp'

/** Everything that answers a press. Most of it is already a <button>; the rows
 *  are divs that behave like one. */
const PRESSABLE = [
  'button',
  'a[href]',
  '[role="button"]',
  '.task-row',
  '.agenda-row',
  '.brief-row',
  '.chat-row',
  '.menu-item',
].join(',')

/** How loud, and whether at all — read at the moment of the sound, so the
 *  Settings toggle takes effect on the very next press. */
function level(): number {
  const { settings } = useApp.getState()
  if (settings.uiSounds === false) return 0
  return settings.chimeVolume
}

function target(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const el = node.closest<HTMLElement>(PRESSABLE)
  if (!el) return null
  if (el.hasAttribute('data-silent')) return null
  if (el instanceof HTMLButtonElement && el.disabled) return null
  return el
}

/** Fine pointers only. A hover sound on a touch screen fires on the tap that
 *  precedes the press, which is one sound too many for one gesture. */
const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

const GRAZE_GAP_MS = 45

export function installUiSounds(): () => void {
  let hovered: HTMLElement | null = null
  let lastGraze = 0

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    if (!target(e.target)) return
    tap(level())
  }

  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !canHover()) return
    const el = target(e.target)
    if (el === hovered) return
    hovered = el
    if (!el) return
    const now = performance.now()
    if (now - lastGraze < GRAZE_GAP_MS) return
    lastGraze = now
    graze(level())
  }

  document.addEventListener('pointerdown', onDown, { capture: true, passive: true })
  document.addEventListener('pointerover', onOver, { capture: true, passive: true })

  return () => {
    document.removeEventListener('pointerdown', onDown, { capture: true })
    document.removeEventListener('pointerover', onOver, { capture: true })
  }
}
