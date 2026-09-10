const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const startOfDay = (t: number | Date): number => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const addDays = (t: number, n: number): number => {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export const sameDay = (a: number, b: number): boolean => startOfDay(a) === startOfDay(b)

/** "08:00" → minutes since midnight */
export const parseHM = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fmtClock(t: number, h24: boolean, seconds: boolean): string {
  const d = new Date(t)
  let h = d.getHours()
  if (!h24) {
    h = h % 12
    if (h === 0) h = 12
  }
  const parts = [h24 ? String(h).padStart(2, '0') : String(h), String(d.getMinutes()).padStart(2, '0')]
  if (seconds) parts.push(String(d.getSeconds()).padStart(2, '0'))
  return parts.join(':')
}

export const meridiem = (t: number): string => (new Date(t).getHours() < 12 ? 'am' : 'pm')

// Indonesian, because that is the language the schedule is already written in
const HARI = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB']
const HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
const BULAN_PANJANG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const fmtDateLine = (t: number): string => {
  const d = new Date(t)
  return `${HARI_PANJANG[d.getDay()]} · ${d.getDate()} ${BULAN_PANJANG[d.getMonth()]}`
}

export const fmtShortDate = (t: number): string => {
  const d = new Date(t)
  return `${d.getDate()} ${BULAN[d.getMonth()]}`
}

/** The two lines of a task row's date column: `KAM 10` over `SEP`. */
export const fmtDayCell = (t: number): { top: string; bottom: string } => {
  const d = new Date(t)
  return { top: `${HARI[d.getDay()]} ${d.getDate()}`, bottom: BULAN[d.getMonth()] }
}

export const fmtDayLong = (t: number): string => {
  const d = new Date(t)
  return `${HARI_PANJANG[d.getDay()].toUpperCase()} ${d.getDate()} ${BULAN_PANJANG[d.getMonth()]}`
}

export const fmtTimeShort = (t: number, h24 = true): string => fmtClock(t, h24, false)

/** 754_000 → "12:34". Used for every countdown in the app. */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** compact form for the menu bar, where every pixel is rented */
export function fmtTray(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function fmtRelative(t: number, now = Date.now()): string {
  const diff = t - now
  const abs = Math.abs(diff)
  const say = (n: number, unit: string) => `${n}${unit}`
  let body: string
  if (abs < MIN) body = 'now'
  else if (abs < HOUR) body = say(Math.round(abs / MIN), 'm')
  else if (abs < DAY) body = say(Math.round(abs / HOUR), 'h')
  else body = say(Math.round(abs / DAY), 'd')
  if (body === 'now') return 'now'
  return diff > 0 ? `in ${body}` : `${body} ago`
}

/** How much of the working day has drained away. 0 before it starts, 1 after. */
export function dayProgress(now: number, dayStart: string, dayEnd: string): number {
  const base = startOfDay(now)
  const from = base + parseHM(dayStart) * MIN
  const to = base + parseHM(dayEnd) * MIN
  if (to <= from) return 0
  return Math.min(1, Math.max(0, (now - from) / (to - from)))
}

/** Fraction of the 24h cycle — the single input to the ocean's palette. */
export function timeOfDay(now: number): number {
  const d = new Date(now)
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400
}

/** Whole days between two dates, ignoring the time of day. */
export const daysUntil = (t: number, now = Date.now()): number =>
  Math.round((startOfDay(t) - startOfDay(now)) / DAY)

/** "hari ini", "besok", "3 hari lagi", "lewat 2 hari" */
export function fmtCountdown(t: number, now = Date.now()): string {
  const d = daysUntil(t, now)
  if (d === 0) return 'hari ini'
  if (d === 1) return 'besok'
  if (d === 2) return 'lusa'
  if (d > 0) return `${d} hari lagi`
  if (d === -1) return 'lewat 1 hari'
  return `lewat ${Math.abs(d)} hari`
}

export const minutesBetween = (a: number, b: number): number => Math.round(Math.abs(b - a) / MIN)

/** Next occurrence of a repeating thing, strictly after `from`. */
export function nextOccurrence(at: number, repeat: { kind: string; interval: number }, from: number): number {
  let next = at
  let guard = 0
  while (next <= from && guard++ < 5000) {
    const d = new Date(next)
    switch (repeat.kind) {
      case 'daily':
        d.setDate(d.getDate() + repeat.interval)
        break
      case 'weekdays':
        do {
          d.setDate(d.getDate() + 1)
        } while (d.getDay() === 0 || d.getDay() === 6)
        break
      case 'weekly':
        d.setDate(d.getDate() + 7 * repeat.interval)
        break
      case 'monthly':
        d.setMonth(d.getMonth() + repeat.interval)
        break
      default:
        return next
    }
    next = d.getTime()
  }
  return next
}

export { MIN, HOUR, DAY }
