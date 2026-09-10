import { create } from 'zustand'
import type { Route } from '../types'

interface UiStore {
  route: Route
  /** which dimension currently carves the water into depths */
  groupBy: string | null
  /** dimensionId → selected optionIds. AND across dimensions, OR within one. */
  filters: Record<string, string[]>
  query: string
  openTaskId: string | null
  paletteOpen: boolean
  showDone: boolean
  /** a completion waiting to be confirmed, anchored where you clicked */
  confirming: { taskId: string; x: number; y: number } | null
  /** ids mid-animation: still open, still mounted, on their way out */
  clearing: string[]
  /** the last thing finished, with an undo attached */
  toast: { taskId: string; title: string } | null
  /** where foam is currently breaking */
  burst: { x: number; y: number; key: number } | null
  /** null = closed; a string = the composer is open, seeded with that text */
  composing: string | null

  go: (route: Route) => void
  setGroupBy: (dimensionId: string | null) => void
  setFilters: (filters: Record<string, string[]>) => void
  toggleFilter: (dimensionId: string, optionId: string) => void
  clearFilters: () => void
  setQuery: (q: string) => void
  openTask: (taskId: string | null) => void
  setPalette: (open: boolean) => void
  toggleShowDone: () => void
  startCompose: (text?: string) => void
  endCompose: () => void
  askConfirm: (taskId: string, x: number, y: number) => void
  cancelConfirm: () => void
  beginClearing: (taskId: string) => void
  endClearing: (taskId: string) => void
  showToast: (taskId: string, title: string) => void
  hideToast: () => void
  fireBurst: (x: number, y: number) => void
  clearBurst: () => void
}

const ROUTES: Route[] = ['surface', 'depths', 'focus', 'timer', 'reminders', 'settings']

/** #depths opens straight into the column — handy for a shortcut or a link */
const initialRoute = (): Route => {
  const hash = window.location.hash.slice(1) as Route
  return ROUTES.includes(hash) ? hash : 'surface'
}

export const useUi = create<UiStore>((set) => ({
  route: initialRoute(),
  groupBy: null,
  filters: {},
  query: '',
  openTaskId: null,
  paletteOpen: false,
  showDone: false,
  composing: null,
  confirming: null,
  clearing: [],
  toast: null,
  burst: null,

  go: (route) => set({ route, paletteOpen: false }),
  setGroupBy: (groupBy) => set({ groupBy }),
  setFilters: (filters) => set({ filters }),

  toggleFilter: (dimensionId, optionId) =>
    set((s) => {
      const current = s.filters[dimensionId] ?? []
      const next = current.includes(optionId)
        ? current.filter((x) => x !== optionId)
        : [...current, optionId]
      const filters = { ...s.filters }
      if (next.length) filters[dimensionId] = next
      else delete filters[dimensionId]
      return { filters }
    }),

  clearFilters: () => set({ filters: {}, query: '' }),
  setQuery: (query) => set({ query }),
  openTask: (openTaskId) => set({ openTaskId }),
  setPalette: (paletteOpen) => set({ paletteOpen }),
  toggleShowDone: () => set((s) => ({ showDone: !s.showDone })),
  startCompose: (text = '') => set({ composing: text, paletteOpen: false }),
  endCompose: () => set({ composing: null }),

  askConfirm: (taskId, x, y) => set({ confirming: { taskId, x, y } }),
  cancelConfirm: () => set({ confirming: null }),
  beginClearing: (taskId) =>
    set((s) => ({ confirming: null, clearing: [...s.clearing, taskId] })),
  endClearing: (taskId) => set((s) => ({ clearing: s.clearing.filter((x) => x !== taskId) })),
  showToast: (taskId, title) => set({ toast: { taskId, title } }),
  hideToast: () => set({ toast: null }),
  fireBurst: (x, y) => set({ burst: { x, y, key: Date.now() } }),
  clearBurst: () => set({ burst: null }),
}))
