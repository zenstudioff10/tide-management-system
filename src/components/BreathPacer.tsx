import { useEffect, useState } from 'react'

// 4 in, 7 held, 8 out — the pattern that actually slows a heart rate
const PHASES = [
  { label: 'in', seconds: 4 },
  { label: 'hold', seconds: 7 },
  { label: 'out', seconds: 8 },
] as const

const CYCLE = PHASES.reduce((s, p) => s + p.seconds, 0)

/** Shown while you are at the surface on a break. Scale is driven by the same
 *  clock as the label, so the ring can never drift out of step with the word. */
export function BreathPacer() {
  const [t, setT] = useState(0)

  useEffect(() => {
    const started = performance.now()
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      setT(((now - started) / 1000) % CYCLE)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  let acc = 0
  let phase: (typeof PHASES)[number] = PHASES[0]
  let local = 0
  for (const p of PHASES) {
    if (t < acc + p.seconds) {
      phase = p
      local = (t - acc) / p.seconds
      break
    }
    acc += p.seconds
  }

  const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2
  const scale =
    phase.label === 'in' ? 0.55 + ease(local) * 0.45
    : phase.label === 'hold' ? 1
    : 1 - ease(local) * 0.45

  return (
    <div className="breath">
      <div className="breath-ring" style={{ transform: `scale(${scale.toFixed(3)})` }} />
      <div className="breath-core" style={{ opacity: 0.25 + scale * 0.4 }} />
      <span className="gauge-label breath-word">{phase.label}</span>
    </div>
  )
}
