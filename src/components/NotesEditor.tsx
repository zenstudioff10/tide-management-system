import { useEffect, useRef, useState } from 'react'
import { cleanNotes, notesToHtml } from '../lib/notes'
import { IconHighlight, IconListBullet, IconListCheck, IconListNumber } from '../design/icons'

type ListKind = 'ul' | 'ol' | 'check'

interface Active {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  mark: boolean
  heading: boolean
  list: ListKind | null
}

const IDLE: Active = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  mark: false,
  heading: false,
  list: null,
}

/** the colour hiliteColor paints with, so its spans can be found and turned into <mark> */
const PROBE = 'rgb(1, 2, 3)'

/** typed at the start of a line, then a space */
const SHORTHAND: Record<string, ListKind | 'heading'> = {
  '-': 'ul',
  '*': 'ul',
  '1.': 'ol',
  '[]': 'check',
  '#': 'heading',
}

interface ToolProps {
  label: string
  title: string
  on: boolean
  onPress: () => void
  children: React.ReactNode
}

function Tool({ label, title, on, onPress, children }: ToolProps) {
  return (
    <button
      type="button"
      className="notes-tool"
      title={title}
      aria-label={label}
      aria-pressed={on}
      data-on={on ? '' : undefined}
      // keep the selection in the note while the button is pressed
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  /** changes when the editor is pointed at a different note */
  docKey?: string
}

/** Notes the way a notes app takes them: bold, highlight, lists, checklists,
 *  a heading. The markdown habits work too — "- ", "1. ", "[] ", "# ". */
export function NotesEditor({ value, onChange, placeholder, docKey }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const emitted = useRef<string | null>(null)
  const loadedKey = useRef<string | undefined>(undefined)
  const [active, setActive] = useState<Active>(IDLE)

  // load the note, unless this is only our own keystroke coming back
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (loadedKey.current === docKey && value === emitted.current) return
    el.innerHTML = notesToHtml(value)
    emitted.current = value
    loadedKey.current = docKey
  }, [value, docKey])

  const within = (node: Node | null, selector: string) => {
    const el = ref.current
    const start = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null)
    const found = start?.closest?.(selector) as HTMLElement | null | undefined
    return found && el && found !== el && el.contains(found) ? found : null
  }
  const listAt = () => within(window.getSelection()?.anchorNode ?? null, 'ul, ol')
  const kindOf = (list: HTMLElement | null): ListKind | null =>
    !list ? null : list.tagName === 'OL' ? 'ol' : list.hasAttribute('data-check') ? 'check' : 'ul'

  const refresh = () => {
    const sel = window.getSelection()
    if (!sel?.anchorNode || !ref.current?.contains(sel.anchorNode)) return setActive(IDLE)
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      mark: !!within(sel.anchorNode, 'mark'),
      heading: !!within(sel.anchorNode, 'h3'),
      list: kindOf(listAt()),
    })
  }

  useEffect(() => {
    document.addEventListener('selectionchange', refresh)
    return () => document.removeEventListener('selectionchange', refresh)
  })

  const emit = () => {
    const el = ref.current
    if (!el) return
    const blank = !el.textContent?.trim() && !el.querySelector('li')
    const html = blank ? '' : cleanNotes(el.innerHTML)
    emitted.current = html
    onChange(html)
  }

  const run = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
  }

  const apply = (action: () => void) => {
    action()
    emit()
    refresh()
  }

  const setList = (kind: ListKind) => {
    const current = kindOf(listAt())
    const command = kind === 'ol' ? 'insertOrderedList' : 'insertUnorderedList'
    // a bullet list and a checklist are the same <ul>; only the flag differs
    if (current && current !== 'ol' && kind !== 'ol' && current !== kind) {
      listAt()?.toggleAttribute('data-check', kind === 'check')
      return
    }
    const existing = new Set(ref.current?.querySelectorAll('li'))
    run(command)
    if (current === kind) return
    const list = listAt()
    if (!list) return
    // the browser folds a new list into the one right above or below it; a
    // checklist under a bullet list has to stay its own list
    const fresh = Array.from(list.children).filter((li) => !existing.has(li as HTMLLIElement))
    if (kind !== 'ol' && kindOf(list) !== kind && fresh.length && fresh.length < list.children.length) {
      const sel = window.getSelection()
      // ranges are live and would fall out of the moved lines; keep the node itself
      const caret = sel?.anchorNode ? ([sel.anchorNode, sel.anchorOffset] as const) : null
      const own = document.createElement('ul')
      const after = Array.from(list.children).slice(Array.from(list.children).indexOf(fresh[0]))
      const rest = after.filter((li) => !fresh.includes(li))
      list.after(own)
      own.append(...fresh)
      if (rest.length) {
        const tail = list.cloneNode(false) as HTMLElement
        tail.append(...rest)
        own.after(tail)
      }
      if (!list.children.length) list.remove()
      own.toggleAttribute('data-check', kind === 'check')
      if (caret) sel?.collapse(...caret)
      return
    }
    list.toggleAttribute('data-check', kind === 'check')
  }

  const setHeading = () => run('formatBlock', within(window.getSelection()?.anchorNode ?? null, 'h3') ? '<div>' : '<h3>')

  const highlight = () => {
    const el = ref.current
    const sel = window.getSelection()
    if (!el || !sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    const touched = Array.from(el.querySelectorAll('mark')).filter((m) => range.intersectsNode(m))
    if (touched.length) {
      touched.forEach((m) => m.replaceWith(...Array.from(m.childNodes)))
      return
    }
    if (range.collapsed) return
    run('styleWithCSS', 'true')
    run('hiliteColor', PROBE)
    run('styleWithCSS', 'false')
    el.querySelectorAll<HTMLElement>('[style]').forEach((painted) => {
      if (painted.style.backgroundColor !== PROBE) return
      painted.style.backgroundColor = ''
      const mark = document.createElement('mark')
      mark.append(...Array.from(painted.childNodes))
      if (painted.tagName === 'SPAN') painted.replaceWith(mark)
      else painted.append(mark)
    })
  }

  /** "- " at the start of a line becomes a list, and so on */
  const expandShorthand = () => {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    if (!sel || !node || node.nodeType !== Node.TEXT_NODE || listAt()) return
    const typed = (node.textContent ?? '').slice(0, sel.anchorOffset)
    const match = /^(-|\*|1\.|\[\]|#)[\s\u00a0]$/.exec(typed)
    if (!match) return
    // only when it opens the line, not partway through one
    const block = within(node, 'div, h3') ?? ref.current
    if (!block?.textContent?.replace(/\u00a0/g, ' ').startsWith(typed.replace(/\u00a0/g, ' '))) return
    sel.setBaseAndExtent(node, 0, node, sel.anchorOffset)
    document.execCommand('delete')
    const kind = SHORTHAND[match[1]]
    if (kind === 'heading') setHeading()
    else setList(kind)
  }

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    const input = e.nativeEvent as InputEvent
    if (input.inputType === 'insertText' && input.data === ' ') expandShorthand()
    // a fresh checklist line starts unticked, whatever the line above it was
    if (input.inputType === 'insertParagraph') {
      within(window.getSelection()?.anchorNode ?? null, 'li')?.removeAttribute('data-checked')
    }
    emit()
    refresh()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey
    if (e.key === 'Tab' && listAt()) {
      e.preventDefault()
      return apply(() => run(e.shiftKey ? 'outdent' : 'indent'))
    }
    if (!mod || e.altKey) return
    const plain: Record<string, () => void> = {
      KeyB: () => run('bold'),
      KeyI: () => run('italic'),
      KeyU: () => run('underline'),
    }
    const shifted: Record<string, () => void> = {
      KeyX: () => run('strikeThrough'),
      KeyH: highlight,
      Digit7: () => setList('ol'),
      Digit8: () => setList('ul'),
      KeyL: () => setList('check'),
    }
    const action = (e.shiftKey ? shifted : plain)[e.code]
    if (!action) return
    e.preventDefault()
    apply(action)
  }

  // ticking a checklist line: a press on its circle, not on its words
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const li = within(e.target as Node, 'li')
    if (!li?.parentElement?.hasAttribute('data-check')) return
    const box = parseFloat(getComputedStyle(li).fontSize) * 1.5
    if (e.clientX - li.getBoundingClientRect().left > box) return
    e.preventDefault()
    li.toggleAttribute('data-checked')
    emit()
  }

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    if (html) document.execCommand('insertHTML', false, cleanNotes(html))
    else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
  }

  return (
    <div className="notes-field">
      <div className="notes-tools" role="toolbar" aria-label="Format catatan">
        <Tool label="Tebal" title="Tebal · ⌘B" on={active.bold} onPress={() => apply(() => run('bold'))}>
          <b>B</b>
        </Tool>
        <Tool label="Miring" title="Miring · ⌘I" on={active.italic} onPress={() => apply(() => run('italic'))}>
          <i className="notes-tool-italic">I</i>
        </Tool>
        <Tool label="Garis bawah" title="Garis bawah · ⌘U" on={active.underline} onPress={() => apply(() => run('underline'))}>
          <u>U</u>
        </Tool>
        <Tool label="Coret" title="Coret · ⌘⇧X" on={active.strike} onPress={() => apply(() => run('strikeThrough'))}>
          <s>S</s>
        </Tool>
        <Tool label="Stabilo" title="Stabilo · ⌘⇧H" on={active.mark} onPress={() => apply(highlight)}>
          <IconHighlight size={15} />
        </Tool>
        <span className="notes-tools-gap" />
        <Tool label="Judul" title="Judul · # spasi" on={active.heading} onPress={() => apply(setHeading)}>
          <span className="notes-tool-heading">H</span>
        </Tool>
        <Tool label="Poin" title="Poin · ⌘⇧8 atau - spasi" on={active.list === 'ul'} onPress={() => apply(() => setList('ul'))}>
          <IconListBullet size={15} />
        </Tool>
        <Tool label="Nomor" title="Nomor · ⌘⇧7 atau 1. spasi" on={active.list === 'ol'} onPress={() => apply(() => setList('ol'))}>
          <IconListNumber size={15} />
        </Tool>
        <Tool label="Checklist" title="Checklist · ⌘⇧L atau [] spasi" on={active.list === 'check'} onPress={() => apply(() => setList('check'))}>
          <IconListCheck size={15} />
        </Tool>
      </div>
      <div
        ref={ref}
        className="notes-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        aria-label={placeholder ?? 'Catatan'}
        data-placeholder={placeholder}
        data-empty={value ? undefined : ''}
        spellCheck={false}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onPaste={onPaste}
        onFocus={refresh}
        onBlur={() => setActive(IDLE)}
      />
    </div>
  )
}
