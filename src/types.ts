export type Id = string

/** A user-invented way of slicing work: "Difficulty", "Flags", "Horizon".
 *  Nothing about these is hardcoded — the whole grouping system is data. */
export interface Dimension {
  id: Id
  name: string
  /** single: a task holds at most one option here. multi: any number. */
  kind: 'single' | 'multi'
  order: number
  /** show this dimension's chips on the task row */
  showOnCard: boolean
}

/** One value inside a dimension: "Hard", "Needs attention", "Next week". */
export interface DimOption {
  id: Id
  dimensionId: Id
  name: string
  /** hex, drawn from the ocean palette */
  color: string
  order: number
}

/** A list — "Ulangan", "Tugas", or whatever you invent later. Each one
 *  remembers how you were looking at it. */
export interface Board {
  id: Id
  name: string
  order: number
  /** 'date', a dimension id, or null for one open water */
  groupBy?: string | null
  /** dimensionId → chosen optionIds */
  filters?: Record<string, string[]>
}

export interface Subtask {
  id: Id
  title: string
  done: boolean
}

export type RepeatKind = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Repeat {
  kind: RepeatKind
  interval: number
}

export interface Task {
  id: Id
  title: string
  notes: string
  status: 'open' | 'done' | 'archived'
  /** which list it lives in */
  boardId?: Id
  /** links into any dimension's options. the entire categorisation system. */
  optionIds: Id[]
  dueAt?: number
  remindAt?: number
  repeat?: Repeat
  /** fractional index — reordering inserts at the midpoint of its neighbours */
  order: number
  subtasks: Subtask[]
  createdAt: number
  completedAt?: number
}

export interface Reminder {
  id: Id
  title: string
  at: number
  repeat?: Repeat
  taskId?: Id
  firedAt?: number
  snoozedUntil?: number
  done: boolean
}

export interface PomodoroConfig {
  focus: number
  short: number
  long: number
  cyclesBeforeLong: number
  autoStartBreak: boolean
  autoStartNext: boolean
}

export interface Settings {
  pomodoro: PomodoroConfig
  hotkey: string
  chimeVolume: number
  /** the presses, hovers and completions. Absent means on. */
  uiSounds?: boolean
  ambient: 'shader' | 'still'
  clock24h: boolean
  showSeconds: boolean
  secondClockZone?: string
  /** drives the tide line on the surface: how much of the day has drained */
  dayStart: string
  dayEnd: string
  defaultGroupBy?: Id
  /** the labels that make a task worth surfacing early, chosen in Settings */
  importantOptionIds?: Id[]
  /** the list in view; 'all' shows every list at once */
  activeBoardId?: Id | 'all'
  /** the label the app maintains itself: on when the due date is this week */
  autoWeekOptionId?: Id
  /** the lists that rule applies to; the others are left alone */
  autoWeekBoardIds?: Id[]
}

/** everything that lives in tide.json */
export interface AppData {
  version: 1
  boards: Board[]
  dimensions: Dimension[]
  options: DimOption[]
  tasks: Task[]
  reminders: Reminder[]
  settings: Settings
}

export type Route = 'surface' | 'depths' | 'focus' | 'timer' | 'reminders' | 'settings'
