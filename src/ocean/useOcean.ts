import { create } from 'zustand'

/** Where the camera is in the water, and how hard the sea is working.
 *  Routes set targets; the render loop eases towards them. */
interface OceanState {
  /** 0 = at the surface, 1 = abyss */
  depth: number
  /** 0 = idle, 1 = deep in a focus session */
  focus: number
  /** the launch ascent: 1 on the floor, 0 once risen */
  intro: number
  /** a running timer draining the tide, 0 when nothing is running */
  drain: number
  setDepth: (d: number) => void
  setFocus: (f: number) => void
  setIntro: (i: number) => void
  setDrain: (d: number) => void
}

export const useOcean = create<OceanState>((set) => ({
  depth: 0,
  focus: 0,
  intro: 0,
  drain: 0,
  setDepth: (depth) => set({ depth: Math.min(1, Math.max(0, depth)) }),
  setFocus: (focus) => set({ focus: Math.min(1, Math.max(0, focus)) }),
  setIntro: (intro) => set({ intro: Math.min(1, Math.max(0, intro)) }),
  setDrain: (drain) => set({ drain: Math.min(1, Math.max(0, drain)) }),
}))
