import { invoke, isTauri } from '@tauri-apps/api/core'

let lastText = ''

/** Writes the live countdown into the macOS menu bar. Empty string clears it. */
export function setTrayText(text: string) {
  if (!isTauri() || text === lastText) return
  lastText = text
  void invoke('update_tray', { text }).catch(() => {
    /* tray may not exist yet during startup */
  })
}
