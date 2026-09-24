/** Notes are stored as a small, fixed subset of HTML: bold, italic, underline,
 *  strike, highlight, a heading, and three kinds of list. Anything else —
 *  pasted styles, links, images, scripts — is unwrapped to its text or dropped
 *  before it is ever saved or shown. Notes written before this were plain
 *  text; those still read as plain text. */

const KEEP: Record<string, string> = {
  B: 'b',
  STRONG: 'b',
  I: 'i',
  EM: 'i',
  U: 'u',
  S: 's',
  STRIKE: 's',
  DEL: 's',
  MARK: 'mark',
  UL: 'ul',
  OL: 'ol',
  LI: 'li',
  BR: 'br',
  P: 'div',
  DIV: 'div',
  H1: 'h3',
  H2: 'h3',
  H3: 'h3',
  H4: 'h3',
}

/** gone entirely, text and all */
const DROP = new Set([
  'SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'META',
  'TITLE', 'LINK', 'SVG', 'MATH', 'CANVAS', 'VIDEO', 'AUDIO', 'IMG', 'NOSCRIPT',
])

const RICH = /<\/?(b|strong|i|em|u|s|strike|mark|ul|ol|li|br|div|p|h3)\b/i

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function copyInto(from: Node, into: Node, doc: Document) {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      into.appendChild(doc.createTextNode(child.textContent ?? ''))
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as HTMLElement
    const tag = el.tagName.toUpperCase()
    if (DROP.has(tag)) continue
    const kept = KEEP[tag]
    // Google Docs wraps a whole paste in <b style="font-weight:normal">
    const fakeBold = kept === 'b' && /font-weight:\s*(normal|[1-5]00)/.test(el.getAttribute('style') ?? '')
    if (!kept || fakeBold) {
      copyInto(el, into, doc)
      continue
    }
    const clean = doc.createElement(kept)
    if (kept === 'ul' && el.hasAttribute('data-check')) clean.setAttribute('data-check', '')
    if (kept === 'li' && el.hasAttribute('data-checked')) clean.setAttribute('data-checked', '')
    copyInto(el, clean, doc)
    into.appendChild(clean)
  }
}

/** Parsed in an inert document: nothing in it runs or loads. */
export function cleanNotes(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out = doc.createElement('div')
  copyInto(doc.body, out, doc)
  return out.innerHTML
}

/** What the editor should show for a stored note, old plain text included. */
export function notesToHtml(stored: string): string {
  if (!stored) return ''
  if (RICH.test(stored)) return cleanNotes(stored)
  return escape(stored).replace(/\n/g, '<br>')
}

/** The words alone, for search. */
export function notesText(stored: string): string {
  if (!RICH.test(stored)) return stored
  return stored
    .replace(/<(br|\/div|\/li|\/h3)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
