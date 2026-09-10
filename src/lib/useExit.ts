import { useEffect, useRef, useState } from 'react'

/** Half of every transition in this app was missing: things arrived with a
 *  fade and a rise, then vanished the instant React unmounted them. Nothing
 *  in water leaves that fast.
 *
 *  Keeps a thing mounted for `ms` after it closes and marks it `leaving`, so
 *  the stylesheet has something to hang an exit on. Under reduced motion the
 *  wait is skipped and it disappears as it always did. */
export function useExit(open: boolean, ms = 220): { render: boolean; leaving: boolean } {
  const [render, setRender] = useState(open)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<number>(0)

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (open) {
      setRender(true)
      setLeaving(false)
      return
    }
    if (reducedMotion()) {
      setRender(false)
      setLeaving(false)
      return
    }
    setLeaving(true)
    timer.current = window.setTimeout(() => {
      setRender(false)
      setLeaving(false)
    }, ms)
    return () => window.clearTimeout(timer.current)
  }, [open, ms])

  return { render: open || render, leaving: !open && leaving }
}

/** The last value a thing had, so it still has something to draw while it
 *  leaves — a drawer cannot animate out around a task that is already gone. */
export function useLast<T>(value: T | null | undefined): T | null {
  const held = useRef<T | null>(null)
  if (value != null) held.current = value
  return held.current
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
