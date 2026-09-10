import { create } from 'zustand'
import { useApp } from './useApp'
import { chime } from '../lib/chime'
import { notify } from '../lib/notify'
import { setTrayText } from '../lib/tray'
import { fmtTray } from '../lib/time'

/** Every clock here is anchored to a wall-clock `endsAt`, never to an
 *  accumulating interval, so sleeping the Mac or hiding the window cannot make
 *  any of them drift. */

export type PomoMode = 'idle' | 'focus' | 'break' | 'long'

interface Phase {
  mode: PomoMode
  running: boolean
  endsAt: number | null
  leftWhenPaused: number | null
  totalMs: number
}

interface Countdown {
  running: boolean
  endsAt: number | null
  leftWhenPaused: number | null
  totalMs: number
  label: string
}

interface Stopwatch {
  running: boolean
  startedAt: number | null
  accumulated: number
  laps: number[]
}

interface TimerStore {
  pomo: Phase
  cycle: number
  cd: Countdown
  sw: Stopwatch

  startPomodoro: () => void
  pomoToggle: () => void
  pomoSkip: () => void
  pomoReset: () => void
  pomoRemaining: () => number
  pomoProgress: () => number

  startCountdown: (ms: number, label?: string) => void
  toggleCountdown: () => void
  clearCountdown: () => void
  cdRemaining: () => number
  cdProgress: () => number

  swToggle: () => void
  swReset: () => void
  swLap: () => void
  swElapsed: () => number

  /** called on a 250ms heartbeat from App */
  poll: () => void
}

const MINUTE = 60_000

const idlePhase: Phase = {
  mode: 'idle',
  running: false,
  endsAt: null,
  leftWhenPaused: null,
  totalMs: 0,
}

export const useTimers = create<TimerStore>((set, get) => ({
  pomo: idlePhase,
  cycle: 0,
  cd: { running: false, endsAt: null, leftWhenPaused: null, totalMs: 0, label: '' },
  sw: { running: false, startedAt: null, accumulated: 0, laps: [] },

  // ── pomodoro ─────────────────────────────────────────────────────────
  startPomodoro: () => {
    const total = useApp.getState().settings.pomodoro.focus * MINUTE
    set({
      pomo: {
        mode: 'focus',
        running: true,
        endsAt: Date.now() + total,
        leftWhenPaused: null,
        totalMs: total,
      },
    })
  },

  pomoToggle: () => {
    const { pomo } = get()
    if (pomo.mode === 'idle') return get().startPomodoro()
    if (pomo.running) {
      set({
        pomo: {
          ...pomo,
          running: false,
          endsAt: null,
          leftWhenPaused: Math.max(0, (pomo.endsAt ?? 0) - Date.now()),
        },
      })
    } else {
      const left = pomo.leftWhenPaused ?? pomo.totalMs
      set({ pomo: { ...pomo, running: true, endsAt: Date.now() + left, leftWhenPaused: null } })
    }
  },

  pomoSkip: () => advance(true),

  pomoReset: () => {
    set({ pomo: idlePhase, cycle: 0 })
    setTrayText('')
  },

  pomoRemaining: () => {
    const { pomo } = get()
    if (pomo.running && pomo.endsAt) return Math.max(0, pomo.endsAt - Date.now())
    return pomo.leftWhenPaused ?? pomo.totalMs
  },

  pomoProgress: () => {
    const { pomo } = get()
    if (!pomo.totalMs) return 0
    return 1 - get().pomoRemaining() / pomo.totalMs
  },

  // ── countdown ────────────────────────────────────────────────────────
  startCountdown: (ms, label = '') =>
    set({
      cd: { running: true, endsAt: Date.now() + ms, leftWhenPaused: null, totalMs: ms, label },
    }),

  toggleCountdown: () => {
    const { cd } = get()
    if (!cd.totalMs) return
    if (cd.running) {
      set({
        cd: {
          ...cd,
          running: false,
          leftWhenPaused: Math.max(0, (cd.endsAt ?? 0) - Date.now()),
          endsAt: null,
        },
      })
    } else {
      const left = cd.leftWhenPaused ?? cd.totalMs
      set({ cd: { ...cd, running: true, endsAt: Date.now() + left, leftWhenPaused: null } })
    }
  },

  clearCountdown: () =>
    set({ cd: { running: false, endsAt: null, leftWhenPaused: null, totalMs: 0, label: '' } }),

  cdRemaining: () => {
    const { cd } = get()
    if (cd.running && cd.endsAt) return Math.max(0, cd.endsAt - Date.now())
    return cd.leftWhenPaused ?? cd.totalMs
  },

  cdProgress: () => {
    const { cd } = get()
    if (!cd.totalMs) return 0
    return 1 - get().cdRemaining() / cd.totalMs
  },

  // ── stopwatch ────────────────────────────────────────────────────────
  swToggle: () => {
    const { sw } = get()
    if (sw.running) {
      set({
        sw: {
          ...sw,
          running: false,
          accumulated: sw.accumulated + (Date.now() - (sw.startedAt ?? Date.now())),
          startedAt: null,
        },
      })
    } else {
      set({ sw: { ...sw, running: true, startedAt: Date.now() } })
    }
  },

  swReset: () => set({ sw: { running: false, startedAt: null, accumulated: 0, laps: [] } }),

  swLap: () => set((s) => ({ sw: { ...s.sw, laps: [get().swElapsed(), ...s.sw.laps] } })),

  swElapsed: () => {
    const { sw } = get()
    return sw.accumulated + (sw.running && sw.startedAt ? Date.now() - sw.startedAt : 0)
  },

  // ── heartbeat ────────────────────────────────────────────────────────
  poll: () => {
    const state = get()

    if (state.pomo.running && state.pomo.endsAt && Date.now() >= state.pomo.endsAt) {
      advance(false)
    }

    if (state.cd.running && state.cd.endsAt && Date.now() >= state.cd.endsAt) {
      const { chimeVolume } = useApp.getState().settings
      chime('reminder', chimeVolume)
      void notify('Timer selesai', state.cd.label || undefined)
      set({ cd: { ...state.cd, running: false, endsAt: null, leftWhenPaused: 0 } })
    }

    // the menu bar carries whichever clock is actually running
    const pomo = get().pomo
    if (pomo.mode !== 'idle') {
      const glyph = pomo.mode === 'focus' ? '◆' : '○'
      setTrayText(`${glyph} ${fmtTray(get().pomoRemaining())}${pomo.running ? '' : ' ⏸'}`)
    } else if (get().cd.running) {
      setTrayText(`◇ ${fmtTray(get().cdRemaining())}`)
    } else {
      setTrayText('')
    }
  },
}))

/** Ends the current phase and opens the next. `manual` keeps it silent. */
function advance(manual: boolean) {
  const { pomo, cycle } = useTimers.getState()
  const cfg = useApp.getState().settings.pomodoro
  if (pomo.mode === 'idle') return

  const wasFocus = pomo.mode === 'focus'
  const nextCycle = wasFocus ? cycle + 1 : cycle
  const isLong = wasFocus && nextCycle % cfg.cyclesBeforeLong === 0
  const nextMode: PomoMode = wasFocus ? (isLong ? 'long' : 'break') : 'focus'
  const minutes = nextMode === 'focus' ? cfg.focus : nextMode === 'long' ? cfg.long : cfg.short
  const total = minutes * MINUTE

  if (!manual) {
    const volume = useApp.getState().settings.chimeVolume
    chime(wasFocus ? 'focus' : 'break', volume)
    void notify(
      wasFocus ? (isLong ? 'Istirahat panjang' : 'Istirahat') : 'Kembali fokus',
      `${minutes} menit`,
    )
  }

  const autoStart = wasFocus ? cfg.autoStartBreak : cfg.autoStartNext

  useTimers.setState({
    cycle: nextCycle,
    pomo: {
      mode: nextMode,
      running: autoStart,
      endsAt: autoStart ? Date.now() + total : null,
      leftWhenPaused: autoStart ? null : total,
      totalMs: total,
    },
  })
}
