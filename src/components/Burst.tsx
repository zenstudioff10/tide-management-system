import { useEffect, useMemo } from 'react'
import { useUi } from '../store/useUi'

const COUNT = 18
export const BURST_MS = 900

/** Foam breaking: specks fly out, then curve upward and fade as they rise.
 *  Offsets are computed here rather than in CSS, so no trigonometry function
 *  is needed at paint time and it renders the same everywhere. */
export function Burst() {
  const burst = useUi((s) => s.burst)

  useEffect(() => {
    if (!burst) return
    const timer = window.setTimeout(() => useUi.getState().clearBurst(), BURST_MS)
    return () => window.clearTimeout(timer)
  }, [burst])

  const specks = useMemo(() => {
    if (!burst) return []
    return Array.from({ length: COUNT }, (_, i) => {
      // a ring with jitter, so it never looks mechanically even
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
      const distance = 26 + Math.random() * 34
      return {
        i,
        dx: Math.cos(angle) * distance,
        // the upward curve: everything ends higher than it started
        dy: Math.sin(angle) * distance * 0.6 - (30 + Math.random() * 26),
        size: 3 + Math.random() * 3,
        delay: Math.random() * 90,
      }
    })
  }, [burst])

  if (!burst) return null

  return (
    <div className="burst" style={{ left: burst.x, top: burst.y }} aria-hidden>
      {specks.map((s) => (
        <span
          key={s.i}
          className="burst-speck"
          style={{
            ['--dx' as string]: `${s.dx.toFixed(1)}px`,
            ['--dy' as string]: `${s.dy.toFixed(1)}px`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay.toFixed(0)}ms`,
          }}
        />
      ))}
    </div>
  )
}
