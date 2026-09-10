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

async function flush() {
  if (!pending) return
  const data = pending
  pending = null
  const json = JSON.stringify(data, null, 2)
  try {
    if (isTauri()) await invoke('save_data', { json })
    else localStorage.setItem(LS_KEY, json)
  } catch (err) {
    console.error('could not write tide.json', err)
  }
}

/** Coalesces bursts of edits into one atomic write. */
export function saveData(data: AppData) {
  pending = data
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(flush, 1500)
}

/** Called on window close so the last keystroke is never lost. */
export function saveNow(data: AppData) {
  pending = data
  if (timer) window.clearTimeout(timer)
  return flush()
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
