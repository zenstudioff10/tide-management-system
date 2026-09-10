import { create } from 'zustand'

/** The launch sequence: you start on the floor and rise to the surface.
 *  Runs once per cold start — a route change or a window re-show never
 *  replays it, because the webview never remounts. */

export const INTRO_MS = 2300

/** guards a second play across a React remount (dev HMR, StrictMode) */
let alreadyPlayed = false

interface IntroState {
  /** 0 at the floor, 1 once the interface has arrived */
  progress: number
  done: boolean
  setProgress: (p: number) => void
  finish: () => void
}

export const useIntro = create<IntroState>((set) => {
  const skip =
    alreadyPlayed ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  alreadyPlayed = true

  return {
    progress: skip ? 1 : 0,
    done: skip,
    setProgress: (progress) => set({ progress }),
    finish: () => set({ progress: 1, done: true }),
  }
})

/** How deep the camera is because of the intro alone: 1 at the floor, 0 once
 *  risen. Eased so the ascent slows as it nears the light. */
export function introDepth(progress: number): number {
  const rise = Math.min(1, progress / 0.63) // the water is done at ~1.45s
  const eased = 1 - Math.pow(1 - rise, 2.4)
  return 1 - eased
}
