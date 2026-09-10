import { invoke, isTauri } from '@tauri-apps/api/core'
import type { AppData } from '../types'

const LS_KEY = 'tide.data.v1'

/** Reads tide.json through Rust (atomic writes, rotating backups live there).
 *  Falls back to localStorage so `npm run dev` in a plain browser still works. */
export async function loadData(): Promise<AppData | null> {
  try {
    if (isTauri()) {
      const raw = await invoke<string | null>('load_data')
      return raw ? (JSON.parse(raw) as AppData) : null
    }
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch (err) {
    console.error('could not read tide.json', err)
    return null
  }
}

let timer: number | undefined
let pending: AppData | null = null

/** Told about every write, so the interface can show the truth rather than
 *  assume it. */
type Watcher = (state: { savedAt: number | null; error: string | null }) => void
const watchers = new Set<Watcher>()
let savedAt: number | null = null
let error: string | null = null

export function watchSaves(fn: Watcher): () => void {
  watchers.add(fn)
  fn({ savedAt, error })
  return () => watchers.delete(fn)
}

const announce = () => watchers.forEach((fn) => fn({ savedAt, error }))

async function flush(): Promise<void> {
  if (!pending) return
  const data = pending
  pending = null
  const json = JSON.stringify(data, null, 2)
  try {
    if (isTauri()) {
      await invoke('save_data', { json })
    } else {
      // keep the previous version alongside: a half-written localStorage entry
      // should never be the only copy
      const previous = localStorage.getItem(LS_KEY)
      if (previous) localStorage.setItem(`${LS_KEY}.prev`, previous)
      localStorage.setItem(LS_KEY, json)
    }
    savedAt = Date.now()
    error = null
  } catch (err) {
    // put it back so the next flush retries rather than dropping the edit
    pending = data
    error = String(err)
    console.error('could not write tide.json', err)
  }
  announce()
}

/** Coalesces bursts of edits into one atomic write. */
export function saveData(data: AppData) {
  pending = data
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(flush, 800)
}

/** Called on every path out — hiding, blurring, closing, quitting — so the last
 *  keystroke is never the one that gets lost. */
export function saveNow(data: AppData) {
  pending = data
  if (timer) window.clearTimeout(timer)
  return flush()
}

/** Writes whatever is still pending, if anything is. */
export function flushPending(): Promise<void> {
  if (timer) window.clearTimeout(timer)
  return flush()
}

export async function saveStatus(): Promise<{
  path: string
  saved_at: number | null
  backups: number
  mirror: string
  mirror_written: boolean
} | null> {
  if (!isTauri()) return null
  try {
    return await invoke('save_status')
  } catch {
    return null
  }
}

export async function dataPath(): Promise<string> {
  if (!isTauri()) return 'browser localStorage'
  return invoke<string>('data_path')
}

export async function exportTo(path: string, data: AppData) {
  const json = JSON.stringify(data, null, 2)
  if (isTauri()) await invoke('export_data', { path, json })
}

export async function importFrom(path: string): Promise<AppData> {
  const raw = await invoke<string>('import_data', { path })
  return JSON.parse(raw) as AppData
}
