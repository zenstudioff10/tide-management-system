import type { AppData, DimOption, Task } from '../types'
import { norm, WEEKDAYS } from './quickparse'
import { addDays, daysUntil, fmtCountdown, fmtDayCell, fmtDayLong, startOfDay } from './time'

/** A small assistant that only knows one subject: your schedule.
 *
 *  There is no model and no network here — it classifies intent by scoring
 *  keywords, pulls a date range and labels out of the sentence, and writes the
 *  answer from templates. It is deliberately narrow: anything that is not about
 *  the schedule gets told so, rather than guessed at. */

export type Intent =
  | 'list'
  | 'count'
  | 'when'
  | 'nearest'
  | 'busiest'
  | 'free'
  | 'start'
  | 'compare'
  | 'overdue'
  | 'status'
  | 'help'
  | 'offtopic'

export interface Memory {
  range?: Range
  labelIds?: string[]
  boardId?: string | null
  intent?: Intent
}

export interface Reply {
  text: string
  tasks: Task[]
  intent: Intent
  understood: string[]
  memory: Memory
}

export interface Range {
  from: number
  to: number
  label: string
  /** a single day reads differently from a span */
  single: boolean
}

type Data = Pick<AppData, 'tasks' | 'boards' | 'options' | 'dimensions' | 'settings'>

// ── vocabulary ─────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, january: 0, feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2, apr: 3, april: 3, mei: 4, may: 4,
  jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6,
  agu: 7, agustus: 7, aug: 7, august: 7, sep: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9, nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
}

const NOISE = new Set([
  'apa', 'aja', 'saja', 'ada', 'yang', 'ku', 'aku', 'saya', 'punya', 'dong', 'nih',
  'itu', 'ini', 'di', 'pada', 'untuk', 'buat', 'sih', 'ya', 'kah', 'nggak', 'gak',
  'ga', 'tidak', 'kira', 'kok', 'deh', 'kan', 'lagi', 'masih', 'emang', 'memang',
  'coba', 'tolong', 'mau', 'pengen', 'ingin', 'harus', 'perlu', 'kalau', 'kalo',
  'what', 'do', 'i', 'have', 'is', 'are', 'my', 'the', 'on', 'for', 'me', 'got',
  'anything', 'whats', 'show', 'about', 'and', 'any', 'there', 'a', 'an',
])

const INTENT_WORDS: Record<Exclude<Intent, 'list' | 'offtopic'>, string[]> = {
  count: ['berapa', 'jumlah', 'total'],
  when: ['kapan', 'when'],
  nearest: ['terdekat', 'terdeket', 'nearest', 'soonest'],
  busiest: ['padat', 'sibuk', 'tersibuk', 'terpadat', 'busiest', 'busy', 'berat', 'terberat'],
  free: ['senggang', 'kosong', 'luang', 'longgar', 'free', 'santai'],
  start: ['mulai', 'duluan', 'prioritas', 'utamakan', 'first', 'start', 'kerjain', 'dikerjain'],
  compare: ['banding', 'bandingkan', 'compare', 'vs', 'versus', 'dibanding'],
  overdue: ['telat', 'terlewat', 'ketinggalan', 'kelewat', 'overdue', 'late', 'lewat'],
  status: ['gimana', 'bagaimana', 'kabar', 'ringkasan', 'summary', 'update'],
  help: ['bantuan', 'bisa', 'help', 'contoh', 'kemampuan'],
}

/** Two words are the same if they differ by a keystroke or two. Catches
 *  "mingu depan", "kamis"/"kamiss", "hafalann" without a spellchecker. */
function close(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 2) return false
  const budget = a.length >= 7 ? 2 : a.length >= 4 ? 1 : 0
  if (!budget) return false

  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > budget) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= budget
}

const hasWord = (tokens: string[], words: string[]) =>
  tokens.some((t) => words.some((w) => close(norm(t), w)))

// ── ranges ─────────────────────────────────────────────────────────────

const oneDay = (day: number, label: string): Range => ({
  from: startOfDay(day),
  to: startOfDay(day) + 86_399_999,
  label: label || fmtDayLong(day),
  single: true,
})

const spanOf = (from: number, days: number, label: string): Range => ({
  from: startOfDay(from),
  to: startOfDay(addDays(from, days)) + 86_399_999,
  label,
  single: false,
})

/** Monday-based, because a school week is. */
function weekStart(t: number): number {
  const d = new Date(startOfDay(t))
  return addDays(d.getTime(), -((d.getDay() + 6) % 7))
}

function nearestWeekday(from: number, weekday: number): number {
  const today = new Date(startOfDay(from)).getDay()
  return addDays(startOfDay(from), (weekday - today + 7) % 7)
}

function dateOfMonth(now: number, date: number): number {
  const d = new Date(now)
  const here = new Date(d.getFullYear(), d.getMonth(), date).getTime()
  return startOfDay(here) >= startOfDay(now)
    ? here
    : new Date(d.getFullYear(), d.getMonth() + 1, date).getTime()
}

// ── reading the sentence ───────────────────────────────────────────────

interface Parsed {
  ranges: Range[]
  labelIds: string[]
  boardId: string | null
  leftover: string[]
  understood: string[]
  intent: Intent | null
}

function parse(question: string, data: Data, now: number): Parsed {
  const tokens = question.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const ranges: Range[] = []
  const labelIds: string[] = []
  const understood: string[] = []
  const leftover: string[] = []
  let boardId: string | null = null

  const optionIndex = data.options.map((o) => ({ o, n: norm(o.name) }))
  const boardIndex = data.boards.map((b) => ({ b, n: norm(b.name) }))

  const findOption = (phrase: string): DimOption | null => {
    const n = norm(phrase)
    if (n.length < 3) return null
    const exact = optionIndex.find((x) => x.n === n)
    if (exact) return exact.o
    // typo tolerance only from five letters up: "hari" must never reach "hard"
    if (n.length >= 5) {
      const fuzzy = optionIndex.find((x) => close(x.n, n))
      if (fuzzy) return fuzzy.o
    }
    const near = optionIndex
      .filter((x) => x.n.startsWith(n) || (n.length >= 5 && x.n.includes(n)))
      .sort((a, b) => a.n.length - b.n.length)
    return near[0]?.o ?? null
  }

  for (let i = 0; i < tokens.length; i++) {
    const w = norm(tokens[i])
    const nx = tokens[i + 1] ? norm(tokens[i + 1]) : ''

    if ((close(w, 'hari') && close(nx, 'ini')) || close(w, 'today') || close(w, 'skrg')) {
      ranges.push(oneDay(now, 'hari ini'))
      understood.push('hari ini')
      if (nx) i++
      continue
    }
    if (close(w, 'besok') || close(w, 'tomorrow') || w === 'tmr') {
      ranges.push(oneDay(addDays(now, 1), 'besok'))
      understood.push('besok')
      continue
    }
    if (close(w, 'lusa')) {
      ranges.push(oneDay(addDays(now, 2), 'lusa'))
      understood.push('lusa')
      continue
    }
    if ((close(w, 'minggu') && close(nx, 'ini')) || (close(w, 'this') && close(nx, 'week'))) {
      ranges.push({
        from: startOfDay(now),
        to: startOfDay(addDays(weekStart(now), 6)) + 86_399_999,
        label: 'minggu ini',
        single: false,
      })
      understood.push('minggu ini')
      i++
      continue
    }
    if ((close(w, 'minggu') && close(nx, 'depan')) || (close(w, 'next') && close(nx, 'week'))) {
      const from = addDays(weekStart(now), 7)
      ranges.push({
        from,
        to: startOfDay(addDays(from, 6)) + 86_399_999,
        label: 'minggu depan',
        single: false,
      })
      understood.push('minggu depan')
      i++
      continue
    }
    if (close(w, 'bulan') && close(nx, 'ini')) {
      const d = new Date(now)
      ranges.push({
        from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
        to: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
        label: 'bulan ini',
        single: false,
      })
      understood.push('bulan ini')
      i++
      continue
    }
    if (/^\d{1,2}$/.test(w) && (close(nx, 'hari') || close(nx, 'days') || close(nx, 'day'))) {
      ranges.push(spanOf(now, Number(w), `${w} hari ke depan`))
      understood.push(`${w} hari ke depan`)
      i++
      continue
    }
    if (close(w, 'tanggal') && /^\d{1,2}$/.test(nx)) {
      ranges.push(oneDay(dateOfMonth(now, Number(nx)), ''))
      understood.push(`tanggal ${nx}`)
      i++
      continue
    }
    if (/^\d{1,2}$/.test(w) && MONTHS[nx] !== undefined) {
      const d = new Date(now)
      ranges.push(oneDay(new Date(d.getFullYear(), MONTHS[nx], Number(w)).getTime(), ''))
      understood.push(`${w} ${nx}`)
      i++
      continue
    }
    const weekday = Object.keys(WEEKDAYS).find((k) => close(w, k))
    if (weekday) {
      ranges.push(oneDay(nearestWeekday(now, WEEKDAYS[weekday]), ''))
      understood.push(weekday)
      continue
    }

    const board = boardIndex.find((x) => close(x.n, w))
    if (board && !boardId) {
      boardId = board.b.id
      understood.push(board.b.name)
      continue
    }

    if (nx) {
      const pair = findOption(`${tokens[i]} ${tokens[i + 1]}`)
      if (pair && norm(`${w}${nx}`).length >= norm(pair.name).length - 2) {
        if (!labelIds.includes(pair.id)) labelIds.push(pair.id)
        understood.push(pair.name)
        i++
        continue
      }
    }
    const single = findOption(tokens[i])
    if (single && !NOISE.has(w)) {
      if (!labelIds.includes(single.id)) labelIds.push(single.id)
      understood.push(single.name)
      continue
    }

    if (!NOISE.has(w)) leftover.push(tokens[i])
  }

  // intent by keyword, in order of how specific each one is
  const everyIntentWord = Object.values(INTENT_WORDS).flat()
  const cleanLeftover = leftover.filter((w) => !everyIntentWord.some((k) => close(norm(w), k)))

  let intent: Intent | null = null
  const order: Exclude<Intent, 'list' | 'offtopic'>[] = [
    'compare', 'busiest', 'free', 'start', 'overdue', 'count', 'when', 'nearest', 'help', 'status',
  ]
  for (const key of order) {
    if (hasWord(tokens, INTENT_WORDS[key])) {
      intent = key
      break
    }
  }

  return { ranges, labelIds, boardId, leftover: cleanLeftover, understood, intent }
}

// ── answering ──────────────────────────────────────────────────────────

const listOf = (tasks: Task[]) => tasks.map((t) => t.title)

function filterTasks(data: Data, p: Parsed, scope: string | null): Task[] {
  let out = data.tasks.filter((t) => t.status === 'open')
  if (scope) out = out.filter((t) => t.boardId === scope)

  if (p.labelIds.length) {
    const byDimension = new Map<string, string[]>()
    for (const optionId of p.labelIds) {
      const option = data.options.find((o) => o.id === optionId)
      if (!option) continue
      byDimension.set(option.dimensionId, [...(byDimension.get(option.dimensionId) ?? []), optionId])
    }
    out = out.filter((t) =>
      [...byDimension.values()].every((ids) => ids.some((x) => t.optionIds.includes(x))),
    )
  }

  const words = p.leftover.filter((w) => w.length > 2)
  if (words.length) {
    const hits = out.filter((t) => words.every((w) => norm(t.title).includes(norm(w))))
    if (hits.length) out = hits
  }
  return out.sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
}

const inRange = (tasks: Task[], r: Range) =>
  tasks.filter((t) => t.dueAt && t.dueAt >= r.from && t.dueAt <= r.to)

const labelNames = (data: Data, ids: string[]) =>
  ids.map((id) => data.options.find((o) => o.id === id)?.name).filter(Boolean) as string[]

/** Groups a set of tasks by day, heaviest first. */
function byDay(tasks: Task[]) {
  const map = new Map<number, Task[]>()
  for (const t of tasks) {
    if (!t.dueAt) continue
    const key = startOfDay(t.dueAt)
    map.set(key, [...(map.get(key) ?? []), t])
  }
  return [...map.entries()]
    .map(([day, items]) => ({ day, items }))
    .sort((a, b) => b.items.length - a.items.length || a.day - b.day)
}

const HELP =
  'Aku cuma tahu jadwalmu. Coba tanya: "kamis ada apa", "minggu ini sibuk nggak", ' +
  '"berapa yang HARD minggu depan", "kapan ulangan fisika", "mulai dari mana", ' +
  'atau "ada yang telat nggak".'

export function respond(question: string, data: Data, now = Date.now(), memory: Memory = {}): Reply {
  const p = parse(question, data, now)
  const q = question.trim()

  if (!q) return { text: HELP, tasks: [], intent: 'help', understood: [], memory }

  // a follow-up like "kalau minggu depan" keeps the previous subject
  const labelIds = p.labelIds.length ? p.labelIds : (memory.labelIds ?? [])
  const boardId = p.boardId ?? memory.boardId ?? null
  const carried: Parsed = { ...p, labelIds }

  const activeBoard = data.settings.activeBoardId
  const scope = boardId ?? (activeBoard && activeBoard !== 'all' ? activeBoard : null)
  const all = filterTasks(data, carried, scope)

  // words that match no task title and no label are a sign we left the subject
  const strayWords = p.leftover.filter(
    (w) => w.length > 2 && !data.tasks.some((t) => norm(t.title).includes(norm(w))),
  )
  const scheduleShaped =
    p.ranges.length > 0 || p.labelIds.length > 0 || p.boardId !== null || p.intent !== null

  const intent: Intent =
    !scheduleShaped || (strayWords.length && !p.intent && !p.labelIds.length && !p.boardId)
      ? 'offtopic'
      : (p.intent ??
        (p.ranges.length
          ? memory.intent && memory.intent !== 'offtopic' && memory.intent !== 'help'
            ? memory.intent
            : 'list'
          : 'list'))

  const range = p.ranges[0] ?? memory.range ?? spanOf(now, 14, '14 hari ke depan')
  const nextMemory: Memory = { range, labelIds, boardId, intent }
  const names = labelNames(data, labelIds)
  const withLabels = names.length ? ` ${names.join(' dan ')}` : ''

  // ── off topic ──────────────────────────────────────────────────────
  if (intent === 'offtopic' || intent === 'help') {
    return { text: HELP, tasks: [], intent: 'help', understood: p.understood, memory: nextMemory }
  }

  // ── yang telat ─────────────────────────────────────────────────────
  if (intent === 'overdue') {
    const late = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) < 0)
    if (!late.length) {
      return {
        text: 'Tidak ada yang telat. Semuanya masih di depan.',
        tasks: [],
        intent,
        understood: p.understood,
        memory: nextMemory,
      }
    }
    return {
      text:
        `Ada ${late.length} yang sudah lewat` +
        (late.length === 1 ? `: ${late[0].title}, ${fmtCountdown(late[0].dueAt!, now)}.` : '.'),
      tasks: late,
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── ringkasan ──────────────────────────────────────────────────────
  if (intent === 'status') {
    const late = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) < 0).length
    const today = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) === 0)
    const tomorrow = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) === 1)
    const parts: string[] = []
    parts.push(today.length ? `Hari ini ada ${today.length} agenda` : 'Hari ini kosong')
    if (tomorrow.length) parts.push(`besok ${tomorrow.length}`)
    if (late) parts.push(`${late} sudah lewat`)
    return {
      text: parts.join(', ') + '.',
      tasks: [...today, ...tomorrow],
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── kapan ──────────────────────────────────────────────────────────
  if (intent === 'when') {
    const dated = all.filter((t) => t.dueAt)
    const hit = dated[0]
    if (!hit) {
      return {
        text: 'Tidak ketemu yang cocok dengan itu di jadwalmu.',
        tasks: [],
        intent,
        understood: p.understood,
        memory: nextMemory,
      }
    }
    return {
      text: `${hit.title} — ${fmtDayLong(hit.dueAt!)}, ${fmtCountdown(hit.dueAt!, now)}.`,
      tasks: [hit],
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── terdekat ───────────────────────────────────────────────────────
  if (intent === 'nearest') {
    const upcoming = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) >= 0)
    const hit = upcoming[0]
    return hit
      ? {
          text: `Yang paling dekat: ${hit.title}, ${fmtDayLong(hit.dueAt!)} — ${fmtCountdown(hit.dueAt!, now)}.`,
          tasks: [hit],
          intent,
          understood: p.understood,
          memory: nextMemory,
        }
      : {
          text: 'Tidak ada yang akan datang.',
          tasks: [],
          intent,
          understood: p.understood,
          memory: nextMemory,
        }
  }

  // ── hari tersibuk ──────────────────────────────────────────────────
  if (intent === 'busiest') {
    const days = byDay(inRange(all, range))
    const top = days[0]
    if (!top) {
      return {
        text: `${sentenceCase(range.label)} kosong — tidak ada apa-apa.`,
        tasks: [],
        intent,
        understood: p.understood,
        memory: nextMemory,
      }
    }
    const total = inRange(all, range).length
    const heavy = countImportant(data, inRange(all, range))
    const busy = total >= 5 ? 'Lumayan padat' : total >= 3 ? 'Sedang' : 'Cukup longgar'
    return {
      text:
        `${busy} — ${total} agenda ${range.label}${withLabels}` +
        (heavy ? `, ${heavy} di antaranya penting` : '') +
        `. Paling berat ${fmtDayLong(top.day)}: ${top.items.length} agenda.`,
      tasks: top.items,
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── hari kosong ────────────────────────────────────────────────────
  if (intent === 'free') {
    const busyDays = new Set(inRange(all, range).map((t) => startOfDay(t.dueAt!)))
    const free: number[] = []
    for (let d = startOfDay(Math.max(range.from, startOfDay(now))); d <= range.to; d = addDays(d, 1)) {
      if (!busyDays.has(d)) free.push(d)
    }
    if (!free.length) {
      return {
        text: `Tidak ada hari kosong ${range.label} — setiap hari ada isinya.`,
        tasks: [],
        intent,
        understood: p.understood,
        memory: nextMemory,
      }
    }
    const named = free.slice(0, 4).map((d) => fmtDayCell(d).top).join(', ')
    return {
      text:
        `Ada ${free.length} hari kosong ${range.label}: ${named}` +
        (free.length > 4 ? ', dan lainnya.' : '.'),
      tasks: [],
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── mulai dari mana ────────────────────────────────────────────────
  if (intent === 'start') {
    const important = new Set(data.settings.importantOptionIds ?? [])
    const upcoming = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) >= -1)
    const ranked = [...upcoming].sort((a, b) => {
      const score = (t: Task) =>
        daysUntil(t.dueAt!, now) * 2 - (t.optionIds.some((o) => important.has(o)) ? 3 : 0)
      return score(a) - score(b)
    })
    const first = ranked[0]
    if (!first) {
      return {
        text: 'Tidak ada yang perlu dikerjakan sekarang.',
        tasks: [],
        intent,
        understood: p.understood,
        memory: nextMemory,
      }
    }
    const why = first.optionIds.some((o) => important.has(o))
      ? 'paling dekat dan berlabel penting'
      : 'yang paling dekat'
    return {
      text: `Mulai dari ${first.title} — ${why}, ${fmtCountdown(first.dueAt!, now)}.`,
      tasks: ranked.slice(0, 5),
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── bandingkan dua rentang ─────────────────────────────────────────
  if (intent === 'compare') {
    const a = p.ranges[0] ?? {
      from: startOfDay(now),
      to: startOfDay(addDays(weekStart(now), 6)) + 86_399_999,
      label: 'minggu ini',
      single: false,
    }
    const bFrom = addDays(weekStart(now), 7)
    const b = p.ranges[1] ?? {
      from: bFrom,
      to: startOfDay(addDays(bFrom, 6)) + 86_399_999,
      label: 'minggu depan',
      single: false,
    }
    const countA = inRange(all, a).length
    const countB = inRange(all, b).length
    const verdict =
      countA === countB
        ? 'sama padatnya'
        : countA > countB
          ? `${a.label} lebih padat`
          : `${b.label} lebih padat`
    return {
      text: `${sentenceCase(a.label)} ${countA} agenda, ${b.label} ${countB} — ${verdict}.`,
      tasks: inRange(all, countA >= countB ? a : b),
      intent,
      understood: p.understood,
      memory: { ...nextMemory, range: a },
    }
  }

  // ── berapa ─────────────────────────────────────────────────────────
  const found = inRange(all, range)
  if (intent === 'count') {
    return {
      text: `Ada ${found.length} agenda${withLabels} ${rangePhrase(range)}.`,
      tasks: found,
      intent,
      understood: p.understood,
      memory: nextMemory,
    }
  }

  // ── daftar biasa ───────────────────────────────────────────────────
  if (!found.length) {
    const upcoming = all.filter((t) => t.dueAt && daysUntil(t.dueAt, now) >= 0)
    const near = upcoming[0]
    return {
      text:
        `${sentenceCase(range.label)} tidak ada apa-apa${withLabels ? ` yang${withLabels}` : ''}.` +
        (near
          ? ` Yang terdekat ${fmtDayLong(near.dueAt!)}: ${near.title}.`
          : ''),
      tasks: [],
      intent: 'list',
      understood: p.understood,
      memory: nextMemory,
    }
  }

  const heavy = countImportant(data, found)
  const opener = range.single
    ? `${sentenceCase(range.label)} ada ${found.length} agenda${withLabels}`
    : `Ada ${found.length} agenda${withLabels} ${rangePhrase(range)}`
  return {
    text:
      opener +
      (heavy && !names.length ? `, ${heavy} di antaranya penting` : '') +
      '.' +
      (found.length === 1 ? ` ${listOf(found)[0]}.` : ''),
    tasks: found,
    intent: 'list',
    understood: p.understood,
    memory: nextMemory,
  }
}

const countImportant = (data: Data, tasks: Task[]) => {
  const important = new Set(data.settings.importantOptionIds ?? [])
  return tasks.filter((t) => t.optionIds.some((o) => important.has(o))).length
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "minggu ini" reads fine bare; "14 hari ke depan" wants a preposition. */
const rangePhrase = (r: Range) => (/^\d/.test(r.label) ? `dalam ${r.label}` : r.label)

export { HELP }
