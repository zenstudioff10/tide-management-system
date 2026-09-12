import { create } from 'zustand'
import type { AppData, Board, DimOption, Dimension, Reminder, Settings, Task } from '../types'
import { id } from '../lib/id'
import { between } from '../lib/order'
import { loadData, saveData, saveNow } from '../lib/persist'
import { seedData } from '../lib/seed'
import { nextOccurrence, thisWeekMonFri } from '../lib/time'

interface AppStore extends AppData {
  ready: boolean

  hydrate: () => Promise<void>
  replaceAll: (data: AppData) => void

  addTask: (input: Partial<Task> & { title: string }) => Task
  updateTask: (taskId: string, patch: Partial<Task>) => void
  deleteTask: (taskId: string) => void
  toggleDone: (taskId: string) => void
  /** honours the dimension's kind: single swaps, multi accumulates */
  toggleOption: (taskId: string, optionId: string) => void
  moveTask: (taskId: string, to: { optionId: string | null; dimensionId: string; beforeId?: string; afterId?: string }) => void

  addBoard: (name: string) => Board
  updateBoard: (boardId: string, patch: Partial<Board>) => void
  deleteBoard: (boardId: string) => void
  setActiveBoard: (boardId: string | 'all') => void

  addDimension: (name: string, kind: Dimension['kind']) => Dimension
  updateDimension: (dimensionId: string, patch: Partial<Dimension>) => void
  deleteDimension: (dimensionId: string) => void
  addOption: (dimensionId: string, name: string, color: string) => DimOption
  updateOption: (optionId: string, patch: Partial<DimOption>) => void
  deleteOption: (optionId: string) => void

  addReminder: (input: Partial<Reminder> & { title: string; at: number }) => Reminder
  updateReminder: (reminderId: string, patch: Partial<Reminder>) => void
  deleteReminder: (reminderId: string) => void
  /** marks fired, then rolls a repeating reminder forward */
  markFired: (reminderId: string) => void
  snooze: (reminderId: string, minutes: number) => void

  setSettings: (patch: Partial<Settings>) => void
  /** puts the automatic week label where it belongs and takes it off where it
   *  does not; safe to call as often as you like */
  syncAutoWeek: () => void
}

const snapshot = (s: AppStore): AppData => ({
  version: 1,
  boards: s.boards,
  dimensions: s.dimensions,
  options: s.options,
  tasks: s.tasks,
  reminders: s.reminders,
  settings: s.settings,
})

const empty = seedData()

/** The list a new task should join: the one in view, or the first one. */
function currentBoardId(state: { boards: Board[]; settings: Settings }): string | undefined {
  const active = state.settings.activeBoardId
  if (active && active !== 'all') return active
  return state.boards[0]?.id
}

export const useApp = create<AppStore>((set, get) => ({
  ...empty,
  tasks: [],
  boards: [],
  dimensions: [],
  options: [],
  ready: false,

  hydrate: async () => {
    const loaded = await loadData()
    const data = loaded ?? seedData()

      // a file written before the week label was automatic
    if (!data.settings.autoWeekOptionId) {
      const weekly = data.options.find((o) => /minggu ini/i.test(o.name))
      if (weekly) {
        data.settings = {
          ...data.settings,
          autoWeekOptionId: weekly.id,
          autoWeekBoardIds: (data.boards ?? [])
            .filter((b) => !/tugas/i.test(b.name))
            .map((b) => b.id),
        }
      }
    }

  // a file written before lists existed: everything in it was an exam
    if (!data.boards || !data.boards.length) {
      const ulangan: Board = { id: id(), name: 'Ulangan', order: 0, groupBy: 'date' }
      const tugas: Board = { id: id(), name: 'Tugas', order: 1, groupBy: 'date' }
      data.boards = [ulangan, tugas]
      data.tasks = data.tasks.map((t) => ({ ...t, boardId: t.boardId ?? ulangan.id }))
      data.settings = { ...data.settings, activeBoardId: ulangan.id }
    }

    // a file written before the durations moved into settings
    if (!data.settings.pomodoro) {
      data.settings = {
        ...data.settings,
        pomodoro: {
          focus: 25,
          short: 5,
          long: 15,
          cyclesBeforeLong: 4,
          autoStartBreak: true,
          autoStartNext: false,
        },
      }
    }

    // a file written before a list could track progress. /tugas/i is the same
    // test the auto-week rule above uses to tell homework from exams, so the
    // two agree about what a homework list is.
    if (data.boards?.some((b) => b.tracksProgress === undefined)) {
      data.boards = data.boards.map((b) =>
        b.tracksProgress === undefined
          ? { ...b, tracksProgress: /tugas/i.test(b.name) }
          : b,
      )
    }

    // a file written before "label penting" existed: choose the obvious ones
    if (!data.settings.importantOptionIds) {
      data.settings = {
        ...data.settings,
        importantOptionIds: data.options
          .filter((o) => /^hard$/i.test(o.name) || /attention/i.test(o.name))
          .map((o) => o.id),
      }
    }

    set({ ...data, ready: true })
    get().syncAutoWeek()
    saveData(data)
  },

  replaceAll: (data) => {
    set({ ...data, ready: true })
    get().syncAutoWeek()
    saveData(data)
  },

  // ── tasks ────────────────────────────────────────────────────────────
  addTask: (input) => {
    const tasks = get().tasks
    const lowest = tasks.reduce((min, t) => Math.min(min, t.order), 0)
    const task: Task = {
      id: id(),
      title: input.title.trim(),
      notes: input.notes ?? '',
      status: 'open',
      // a new task joins whichever list you are looking at
      boardId: input.boardId ?? currentBoardId(get()),
      optionIds: input.optionIds ?? [],
      dueAt: input.dueAt,
      remindAt: input.remindAt,
      repeat: input.repeat,
      order: lowest - 1,
      subtasks: input.subtasks ?? [],
      createdAt: Date.now(),
    }
    set({ tasks: [task, ...tasks] })
    return task
  },

  updateTask: (taskId, patch) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) })),

  deleteTask: (taskId) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) })),

  toggleDone: (taskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t
        const done = t.status === 'done'
        return {
          ...t,
          status: done ? 'open' : 'done',
          completedAt: done ? undefined : Date.now(),
        }
      }),
    })),

  toggleOption: (taskId, optionId) =>
    set((s) => {
      const option = s.options.find((o) => o.id === optionId)
      if (!option) return {}
      const dimension = s.dimensions.find((d) => d.id === option.dimensionId)
      const siblings = new Set(
        s.options.filter((o) => o.dimensionId === option.dimensionId).map((o) => o.id),
      )
      return {
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t
          const has = t.optionIds.includes(optionId)
          if (has) return { ...t, optionIds: t.optionIds.filter((x) => x !== optionId) }
          const kept =
            dimension?.kind === 'single' ? t.optionIds.filter((x) => !siblings.has(x)) : t.optionIds
          return { ...t, optionIds: [...kept, optionId] }
        }),
      }
    }),

  moveTask: (taskId, to) =>
    set((s) => {
      const byId = new Map(s.tasks.map((t) => [t.id, t]))
      const before = to.beforeId ? byId.get(to.beforeId)?.order : undefined
      const after = to.afterId ? byId.get(to.afterId)?.order : undefined
      const order = between(before, after)
      const siblings = new Set(
        s.options.filter((o) => o.dimensionId === to.dimensionId).map((o) => o.id),
      )
      return {
        tasks: s.tasks.map((t) => {
          if (t.id !== taskId) return t
          const kept = t.optionIds.filter((x) => !siblings.has(x))
          return { ...t, order, optionIds: to.optionId ? [...kept, to.optionId] : kept }
        }),
      }
    }),

  // ── lists ────────────────────────────────────────────────────────────
  addBoard: (name) => {
    const board: Board = {
      id: id(),
      name: name.trim(),
      order: get().boards.length,
      groupBy: 'date',
    }
    set((s) => ({ boards: [...s.boards, board] }))
    return board
  },

  updateBoard: (boardId, patch) =>
    set((s) => ({ boards: s.boards.map((b) => (b.id === boardId ? { ...b, ...patch } : b)) })),

  /** the list goes; its tasks move to the first remaining one rather than
   *  disappearing with it */
  deleteBoard: (boardId) =>
    set((s) => {
      const remaining = s.boards.filter((b) => b.id !== boardId)
      const fallback = remaining[0]?.id
      return {
        boards: remaining,
        tasks: s.tasks.map((t) => (t.boardId === boardId ? { ...t, boardId: fallback } : t)),
        settings:
          s.settings.activeBoardId === boardId
            ? { ...s.settings, activeBoardId: fallback ?? 'all' }
            : s.settings,
      }
    }),

  setActiveBoard: (boardId) =>
    set((s) => ({ settings: { ...s.settings, activeBoardId: boardId } })),

  // ── the grouping system ──────────────────────────────────────────────
  addDimension: (name, kind) => {
    const dimension: Dimension = {
      id: id(),
      name: name.trim(),
      kind,
      order: get().dimensions.length,
      showOnCard: true,
    }
    set((s) => ({ dimensions: [...s.dimensions, dimension] }))
    return dimension
  },

  updateDimension: (dimensionId, patch) =>
    set((s) => ({
      dimensions: s.dimensions.map((d) => (d.id === dimensionId ? { ...d, ...patch } : d)),
    })),

  deleteDimension: (dimensionId) =>
    set((s) => {
      const doomed = new Set(
        s.options.filter((o) => o.dimensionId === dimensionId).map((o) => o.id),
      )
      return {
        dimensions: s.dimensions.filter((d) => d.id !== dimensionId),
        options: s.options.filter((o) => o.dimensionId !== dimensionId),
        tasks: s.tasks.map((t) => ({ ...t, optionIds: t.optionIds.filter((x) => !doomed.has(x)) })),
        settings:
          s.settings.defaultGroupBy === dimensionId
            ? { ...s.settings, defaultGroupBy: undefined }
            : s.settings,
      }
    }),

  addOption: (dimensionId, name, color) => {
    const option: DimOption = {
      id: id(),
      dimensionId,
      name: name.trim(),
      color,
      order: get().options.filter((o) => o.dimensionId === dimensionId).length,
    }
    set((s) => ({ options: [...s.options, option] }))
    return option
  },

  updateOption: (optionId, patch) =>
    set((s) => ({ options: s.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) })),

  deleteOption: (optionId) =>
    set((s) => ({
      options: s.options.filter((o) => o.id !== optionId),
      tasks: s.tasks.map((t) => ({ ...t, optionIds: t.optionIds.filter((x) => x !== optionId) })),
    })),

  // ── reminders ────────────────────────────────────────────────────────
  addReminder: (input) => {
    const reminder: Reminder = {
      id: id(),
      title: input.title.trim(),
      at: input.at,
      repeat: input.repeat,
      taskId: input.taskId,
      done: false,
    }
    set((s) => ({ reminders: [...s.reminders, reminder] }))
    return reminder
  },

  updateReminder: (reminderId, patch) =>
    set((s) => ({
      reminders: s.reminders.map((r) => (r.id === reminderId ? { ...r, ...patch } : r)),
    })),

  deleteReminder: (reminderId) =>
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== reminderId) })),

  markFired: (reminderId) =>
    set((s) => ({
      reminders: s.reminders.map((r) => {
        if (r.id !== reminderId) return r
        if (r.repeat) {
          return {
            ...r,
            at: nextOccurrence(r.at, r.repeat, Date.now()),
            firedAt: Date.now(),
            snoozedUntil: undefined,
          }
        }
        return { ...r, firedAt: Date.now(), done: true, snoozedUntil: undefined }
      }),
    })),

  snooze: (reminderId, minutes) =>
    set((s) => ({
      reminders: s.reminders.map((r) =>
        r.id === reminderId ? { ...r, snoozedUntil: Date.now() + minutes * 60_000, done: false } : r,
      ),
    })),

  // ── settings ─────────────────────────────────────────────────────────
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  syncAutoWeek: () => {
    const s = get()
    const optionId = s.settings.autoWeekOptionId
    if (!optionId) return

    const boards = new Set(s.settings.autoWeekBoardIds ?? [])
    const { from, to } = thisWeekMonFri()

    let changed = false
    const tasks = s.tasks.map((t) => {
      const applies = t.boardId ? boards.has(t.boardId) : false
      const due = t.dueAt !== undefined && t.dueAt >= from && t.dueAt <= to
      const should = applies && due
      const has = t.optionIds.includes(optionId)
      if (should === has) return t
      changed = true
      return {
        ...t,
        optionIds: should
          ? [...t.optionIds, optionId]
          : t.optionIds.filter((x) => x !== optionId),
      }
    })

    if (changed) set({ tasks })
  },
}))

/** Writes trail the state by 1.5s, coalesced, atomic on the Rust side. */
/** Re-runs the automatic week label after anything that could change it.
 *  A second pass finds nothing to do, so this cannot loop. */
let syncing = false
useApp.subscribe((state, prev) => {
  if (!state.ready || syncing) return
  if (
    state.tasks === prev.tasks &&
    state.settings === prev.settings &&
    state.boards === prev.boards
  ) {
    return
  }
  syncing = true
  state.syncAutoWeek()
  syncing = false
})

let lastSnapshot: AppData | null = null
useApp.subscribe((state) => {
  if (!state.ready) return
  const next = snapshot(state)
  if (
    lastSnapshot &&
    lastSnapshot.tasks === next.tasks &&
    lastSnapshot.boards === next.boards &&
    lastSnapshot.dimensions === next.dimensions &&
    lastSnapshot.options === next.options &&
    lastSnapshot.reminders === next.reminders &&
    lastSnapshot.settings === next.settings
  ) {
    return
  }
  lastSnapshot = next
  saveData(next)
})

window.addEventListener('beforeunload', () => {
  const state = useApp.getState()
  if (state.ready) void saveNow(snapshot(state))
})
