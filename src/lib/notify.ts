import { isTauri } from '@tauri-apps/api/core'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

let granted: boolean | null = null

export async function ensureNotifyPermission(): Promise<boolean> {
  if (granted !== null) return granted
  try {
    if (isTauri()) {
      granted = (await isPermissionGranted()) || (await requestPermission()) === 'granted'
    } else if ('Notification' in window) {
      granted = Notification.permission === 'granted'
        ? true
        : (await Notification.requestPermission()) === 'granted'
    } else {
      granted = false
    }
  } catch {
    granted = false
  }
  return granted
}

export async function notify(title: string, body?: string) {
  if (!(await ensureNotifyPermission())) return
  try {
    if (isTauri()) sendNotification({ title, body })
    else new Notification(title, { body })
  } catch (err) {
    console.warn('notification failed', err)
  }
}
