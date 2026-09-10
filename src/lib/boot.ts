/** The handover from the loading screen in index.html to the app itself. */

/** Shown at least this long, so a fast machine never sees it flash past. */
const MINIMUM_MS = 700
const FADE_MS = 400

let dismissed: Promise<void> | null = null

/** Fades the loading screen out and resolves once it is gone. Safe to call
 *  more than once — every caller waits on the same handover. */
export function dismissBoot(): Promise<void> {
  if (dismissed) return dismissed

  dismissed = new Promise((resolve) => {
    const el = document.getElementById('boot')
    if (!el) return resolve()

    // performance.now() is measured from navigation start, which is exactly
    // the age of the loading screen
    const wait = Math.max(0, MINIMUM_MS - performance.now())
    window.setTimeout(() => {
      el.classList.add('gone')
      window.setTimeout(() => {
        el.remove()
        resolve()
      }, FADE_MS)
    }, wait)
  })

  return dismissed
}
