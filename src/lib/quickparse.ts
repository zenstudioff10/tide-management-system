import type { DimOption } from '../types'
import { addDays, startOfDay } from './time'

export interface Parsed {
  title: string
  optionIds: string[]
  dueAt?: number
  /** what was understood, for the echo line under the capture bar */
  hints: string[]
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, min: 0, minggu: 0,
  mon: 1, monday: 1, sen: 1, senin: 1,
  tue: 2, tues: 2, tuesday: 2, sel: 2, selasa: 2,
  wed: 3, weds: 3, wednesday: 3, rab: 3, rabu: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, kam: 4, kamis: 4,
  fri: 5, friday: 5, jum: 5, jumat: 5,
  sat: 6, saturday: 6, sab: 6, sabtu: 6,
}

/** "3pm", "3:30pm", "15:00", "9.30" → minutes since midnight */
function parseTime(token: string): number | null {
  const m = token.toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const mer = m[3]
  if (!mer && !m[2] && token.length <= 2) return null // a bare "3" is not a time
  if (h > 23 || min > 59) return null
  if (mer === 'pm' && h < 12) h += 12
  if (mer === 'am' && h === 12) h = 0
  return h * 60 + min
}

export function nextWeekday(from: number, weekday: number): number {
  const base = startOfDay(from)
  const today = new Date(base).getDay()
  let delta = (weekday - today + 7) % 7
  if (delta === 0) delta = 7
  return addDays(base, delta)
}

/**
 * `UH Kimia #hard #hafalan jumat 3pm`
 *   → title "UH Kimia", the Hard and Hafalan labels, Friday at 15:00.
 */
export function quickParse(input: string, options: DimOption[], now = Date.now()): Parsed {
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  const kept: string[] = []
  const optionIds: string[] = []
  const hints: string[] = []

  let day: number | null = null
  let minutes: number | null = null

  const index = options.map((o) => ({ o, n: norm(o.name) }))

  const findOption = (raw: string) => {
    const n = norm(raw)
    if (!n) return null
    const exact = index.find((x) => x.n === n)
    if (exact) return exact.o
    const starts = index.filter((x) => x.n.startsWith(n)).sort((a, b) => a.n.length - b.n.length)
    if (starts.length) return starts[0].o
    const inside = index.filter((x) => x.n.includes(n)).sort((a, b) => a.n.length - b.n.length)
    return inside.length ? inside[0].o : null
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const lower = token.toLowerCase()

    // #label — hyphens stand in for spaces
    if (token.startsWith('#') && token.length > 1) {
      const option = findOption(token.slice(1).replace(/-/g, ' '))
      if (option) {
        if (!optionIds.includes(option.id)) optionIds.push(option.id)
        hints.push(option.name)
        continue
      }
    }

    // in 30m / in 2h
    if (lower === 'in' && tokens[i + 1]) {
      const rel = tokens[i + 1].toLowerCase().match(/^(\d{1,3})(m|min|h|hr)$/)
      if (rel) {
        const ms = Number(rel[1]) * (rel[2].startsWith('h') ? 3_600_000 : 60_000)
        const at = new Date(now + ms)
        day = startOfDay(at.getTime())
        minutes = at.getHours() * 60 + at.getMinutes()
        hints.push(`in ${rel[1]}${rel[2].startsWith('h') ? 'h' : 'm'}`)
        i++
        continue
      }
    }

    // Indonesian first, since that is what the schedule is written in
    if (lower === 'besok') {
      day = addDays(startOfDay(now), 1)
      hints.push('besok')
      continue
    }
    if (lower === 'lusa') {
      day = addDays(startOfDay(now), 2)
      hints.push('lusa')
      continue
    }
    if (lower === 'hari' && tokens[i + 1]?.toLowerCase() === 'ini') {
      day = startOfDay(now)
      hints.push('hari ini')
      i++
      continue
    }
    if (lower === 'minggu' && tokens[i + 1]?.toLowerCase() === 'depan') {
      day = addDays(startOfDay(now), 7)
      hints.push('minggu depan')
      i++
      continue
    }

    if (lower === 'today' || lower === 'tonight') {
      day = startOfDay(now)
      if (lower === 'tonight') minutes = minutes ?? 20 * 60
      hints.push(lower)
      continue
    }
    if (lower === 'tmr' || lower === 'tomorrow') {
      day = addDays(startOfDay(now), 1)
      hints.push('tomorrow')
      continue
    }
    if (lower === 'next' && tokens[i + 1]?.toLowerCase() === 'week') {
      day = addDays(startOfDay(now), 7)
      hints.push('next week')
      i++
      continue
    }
    if (lower in WEEKDAYS) {
      day = nextWeekday(now, WEEKDAYS[lower])
      hints.push(lower)
      continue
    }

    const t = parseTime(lower)
    if (t !== null) {
      minutes = t
      hints.push(lower)
      continue
    }

    kept.push(token)
  }

  let dueAt: number | undefined
  if (day !== null || minutes !== null) {
    const base = day ?? startOfDay(now)
    const mins = minutes ?? 9 * 60
    let at = base + mins * 60_000
    // a bare time that has already passed means the next one
    if (day === null && at <= now) at = addDays(at, 1)
    dueAt = at
  }

  return { title: kept.join(' '), optionIds, dueAt, hints }
}
