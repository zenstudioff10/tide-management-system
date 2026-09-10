import type { AppData, DimOption, Task } from '../types'
import { addDays, daysUntil, startOfDay } from '../lib/time'

/** The tasks in the active list — or all of them when "semua" is chosen. */
export function boardTasks(data: Pick<AppData, 'tasks' | 'settings'>): Task[] {
  const active = data.settings.activeBoardId
  if (!active || active === 'all') return data.tasks
  return data.tasks.filter((t) => t.boardId === active)
}

/** The one grouping that is computed rather than stored. */
export const DATE_GROUP = 'date'

export interface Lane {
  key: string
  label: string
  color: string
  optionId: string | null
  tasks: Task[]
}

interface LaneInput {
  tasks: Task[]
  options: DimOption[]
  groupBy: string | null
  filters: Record<string, string[]>
  query: string
  showDone: boolean
}

const matches = (task: Task, filters: Record<string, string[]>, query: string, showDone: boolean) => {
  if (!showDone && task.status !== 'open') return false
  // AND across dimensions, OR within one
  for (const optionIds of Object.values(filters)) {
    if (!optionIds.some((o) => task.optionIds.includes(o))) return false
  }
  if (query.trim()) {
    const q = query.trim().toLowerCase()
    if (!task.title.toLowerCase().includes(q) && !task.notes.toLowerCase().includes(q)) return false
  }
  return true
}

const rank = (a: Task, b: Task) => {
  if (a.status !== b.status) return a.status === 'open' ? -1 : 1
  return a.order - b.order
}

/** The depth column. Lanes are just the options of the chosen dimension, so
 *  inventing a new dimension invents a new set of depths — no code involved. */
export function buildLanes({ tasks, options, groupBy, filters, query, showDone }: LaneInput): Lane[] {
  const visible = tasks.filter((t) => matches(t, filters, query, showDone))

  if (groupBy === DATE_GROUP) return dateLanes(visible)

  if (!groupBy) {
    return [
      {
        key: 'all',
        label: 'Everything',
        color: 'var(--foam)',
        optionId: null,
        tasks: [...visible].sort(rank),
      },
    ]
  }

  const dimensionOptions = options
    .filter((o) => o.dimensionId === groupBy)
    .sort((a, b) => a.order - b.order)

  const lanes: Lane[] = dimensionOptions.map((o) => ({
    key: o.id,
    label: o.name,
    color: o.color,
    optionId: o.id,
    tasks: visible.filter((t) => t.optionIds.includes(o.id)).sort(rank),
  }))

  const assigned = new Set(dimensionOptions.map((o) => o.id))
  const drifting = visible.filter((t) => !t.optionIds.some((x) => assigned.has(x))).sort(rank)

  if (drifting.length) {
    lanes.push({
      key: 'drifting',
      label: 'Drifting',
      color: 'var(--ink-3)',
      optionId: null,
      tasks: drifting,
    })
  }
  return lanes
}

/** Buckets computed from dueAt. Empty ones are left out — unlike a dimension's
 *  options, these are not structure the user built and wants to see standing. */
function dateLanes(tasks: Task[], now = Date.now()): Lane[] {
  const buckets: { key: string; label: string; color: string; tasks: Task[] }[] = [
    { key: 'terlewat', label: 'Terlewat', color: '#dd6b4d', tasks: [] },
    { key: 'hari-ini', label: 'Hari ini', color: '#bfdcd8', tasks: [] },
    { key: 'besok', label: 'Besok', color: '#8fd8cc', tasks: [] },
    { key: 'minggu-ini', label: 'Minggu ini', color: '#4fa3a0', tasks: [] },
    { key: 'minggu-depan', label: 'Minggu depan', color: '#5b7fa8', tasks: [] },
    { key: 'nanti', label: 'Nanti', color: '#8e9bc4', tasks: [] },
    { key: 'tanpa-tanggal', label: 'Tanpa tanggal', color: 'var(--ink-3)', tasks: [] },
  ]
  const at = (key: string) => buckets.find((b) => b.key === key)!
  const today = startOfDay(now)

  for (const task of tasks) {
    if (!task.dueAt) {
      at('tanpa-tanggal').tasks.push(task)
      continue
    }
    const day = startOfDay(task.dueAt)
    const days = Math.round((day - today) / 86_400_000)
    if (days < 0) at('terlewat').tasks.push(task)
    else if (days === 0) at('hari-ini').tasks.push(task)
    else if (days === 1) at('besok').tasks.push(task)
    else if (days <= 7) at('minggu-ini').tasks.push(task)
    else if (days <= 14) at('minggu-depan').tasks.push(task)
    else at('nanti').tasks.push(task)
  }

  const byDate = (a: Task, b: Task) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    return (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) || a.order - b.order
  }

  return buckets
    .filter((b) => b.tasks.length)
    .map((b) => ({ ...b, optionId: null, tasks: b.tasks.sort(byDate) }))
}

// ── what you actually have ─────────────────────────────────────────────

export interface WeekLoad {
  /** open tasks with a date inside the next seven days */
  thisWeek: number
  overdue: number
  today: number
  important: number
  total: number
  /** the day carrying the most, within the next fortnight */
  heaviest: { day: number; count: number } | null
}

export function weekLoad(
  data: Pick<AppData, 'tasks' | 'settings'>,
  now = Date.now(),
): WeekLoad {
  const open = data.tasks.filter((t) => t.status === 'open')
  const important = new Set(data.settings.importantOptionIds ?? [])

  const byDay = new Map<number, number>()
  for (const t of open) {
    if (!t.dueAt) continue
    const d = daysUntil(t.dueAt, now)
    if (d < 0 || d > 14) continue
    const key = startOfDay(t.dueAt)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }

  let heaviest: { day: number; count: number } | null = null
  for (const [day, count] of byDay) {
    if (!heaviest || count > heaviest.count || (count === heaviest.count && day < heaviest.day)) {
      heaviest = { day, count }
    }
  }

  return {
    thisWeek: open.filter((t) => t.dueAt && daysUntil(t.dueAt, now) >= 0 && daysUntil(t.dueAt, now) <= 7).length,
    overdue: open.filter((t) => t.dueAt && daysUntil(t.dueAt, now) < 0).length,
    today: open.filter((t) => t.dueAt && daysUntil(t.dueAt, now) === 0).length,
    important: open.filter((t) => t.optionIds.some((o) => important.has(o))).length,
    total: open.length,
    heaviest,
  }
}

/** Open tasks carrying any label the user marked as important. */
export function importantTasks(data: Pick<AppData, 'tasks' | 'settings'>): Task[] {
  const important = new Set(data.settings.importantOptionIds ?? [])
  if (!important.size) return []
  return data.tasks
    .filter((t) => t.status === 'open' && t.optionIds.some((o) => important.has(o)))
    .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
}

/** Everything with a date, soonest first, overdue included. */
export function byDueDate(data: Pick<AppData, 'tasks'>, withinDays = 14, now = Date.now()): Task[] {
  return data.tasks
    .filter((t) => t.status === 'open' && t.dueAt && daysUntil(t.dueAt, now) <= withinDays)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
}

/** The next fortnight as a row of days, for the load bars. */
export function loadByDay(data: Pick<AppData, 'tasks'>, days = 14, now = Date.now()) {
  const out: { day: number; count: number }[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(startOfDay(now), i)
    out.push({
      day,
      count: data.tasks.filter(
        (t) => t.status === 'open' && t.dueAt && startOfDay(t.dueAt) === day,
      ).length,
    })
  }
  return out
}

/** What the surface tells you before you have asked anything. */
export function nextUp(data: Pick<AppData, 'reminders' | 'tasks'>, now = Date.now()) {
  const candidates: { label: string; at: number; kind: 'reminder' | 'task' }[] = []

  for (const r of data.reminders) {
    if (r.done) continue
    const at = r.snoozedUntil ?? r.at
    if (at > now) candidates.push({ label: r.title, at, kind: 'reminder' })
  }
  for (const t of data.tasks) {
    if (t.status !== 'open' || !t.dueAt) continue
    if (t.dueAt > now) candidates.push({ label: t.title, at: t.dueAt, kind: 'task' })
  }
  candidates.sort((a, b) => a.at - b.at)
  return candidates[0] ?? null
}

/** Reminders whose moment has arrived and which have not been announced. */
export function dueReminders(data: Pick<AppData, 'reminders'>, now = Date.now()) {
  return data.reminders.filter((r) => {
    if (r.done) return false
    const at = r.snoozedUntil ?? r.at
    return at <= now && (!r.firedAt || r.firedAt < at)
  })
}
