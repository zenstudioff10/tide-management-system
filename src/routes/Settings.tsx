import { useEffect, useState } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { useApp } from '../store/useApp'
import { useUi } from '../store/useUi'
import { OPTION_COLORS } from '../ocean/palette'
import { chime } from '../lib/chime'
import { dataPath, exportTo, importFrom, saveStatus, watchSaves } from '../lib/persist'
import { IconClose, IconPlus, IconSurface } from '../design/icons'
import { fmtRelative } from '../lib/time'
import { Chip } from '../components/Chip'

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className="toggle" data-on={on ? '' : undefined} onClick={onClick}>
      <span className="toggle-track">
        <span className="toggle-bead" />
      </span>
      {label}
    </button>
  )
}

/** The lists themselves: rename, reorder by creation, remove. Removing one
 *  moves its tasks to the first remaining list rather than deleting them. */
function Boards() {
  const boards = useApp((s) => s.boards)
  const tasks = useApp((s) => s.tasks)
  const app = useApp.getState()

  return (
    <section className="settings-block">
      <h2 className="heading">Daftar</h2>
      <p className="settings-note">
        Tab di atas kolom tugas. Menghapus daftar tidak menghapus isinya — semuanya pindah ke
        daftar pertama.
      </p>
      {[...boards]
        .sort((a, b) => a.order - b.order)
        .map((board) => (
          <div key={board.id} className="option-row">
            <input
              className="dimension-name"
              value={board.name}
              onChange={(e) => app.updateBoard(board.id, { name: e.target.value })}
            />
            <span className="gauge-label">
              {tasks.filter((t) => t.boardId === board.id).length} isi
            </span>
            <button
              className="quiet-button danger"
              disabled={boards.length < 2}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const held = tasks.filter((t) => t.boardId === board.id).length
                const fallback = [...boards]
                  .filter((b) => b.id !== board.id)
                  .sort((a, b) => a.order - b.order)[0]
                useUi.getState().askConfirm({
                  kind: 'delete',
                  title: `Daftar ${board.name}`,
                  note: held ? `${held} isi pindah ke ${fallback?.name}` : undefined,
                  x: r.left - 60,
                  y: r.top + 28,
                  onConfirm: () => app.deleteBoard(board.id),
                })
              }}
            >
              hapus
            </button>
          </div>
        ))}
    </section>
  )
}

/** The automatic week label: which option it is, and which lists follow it. */
function AutoWeek() {
  const boards = useApp((s) => s.boards)
  const options = useApp((s) => s.options)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)

  const option = options.find((o) => o.id === settings.autoWeekOptionId)
  const following = settings.autoWeekBoardIds ?? []

  const toggle = (boardId: string) =>
    setSettings({
      autoWeekBoardIds: following.includes(boardId)
        ? following.filter((x) => x !== boardId)
        : [...following, boardId],
    })

  return (
    <section className="settings-block">
      <h2 className="heading">Label otomatis</h2>
      <p className="settings-note">
        {option ? (
          <>
            Label <strong>{option.name}</strong> dipasang sendiri untuk apa pun yang jatuh tempo
            Senin sampai Jumat minggu berjalan, dan lepas sendiri saat minggunya berganti. Kamu
            tidak perlu — dan tidak bisa — mengaturnya manual.
          </>
        ) : (
          <>Belum ada label yang diatur otomatis.</>
        )}
      </p>

      <div className="drawer-fields">
        <span className="gauge-label important-dim">berlaku untuk</span>
        {[...boards]
          .sort((a, b) => a.order - b.order)
          .map((b) => (
            <button
              key={b.id}
              className="chip chip-button"
              data-active={following.includes(b.id) ? '' : undefined}
              onClick={() => toggle(b.id)}
            >
              <span
                className="chip-dot"
                style={{ background: following.includes(b.id) ? 'var(--tod-light)' : 'var(--ink-4)' }}
              />
              {b.name}
            </button>
          ))}
      </div>

      <div className="drawer-fields">
        <span className="gauge-label important-dim">labelnya</span>
        {options
          .filter((o) => o.dimensionId === option?.dimensionId)
          .sort((a, b) => a.order - b.order)
          .map((o) => (
            <Chip
              key={o.id}
              option={o}
              active={o.id === settings.autoWeekOptionId}
              onClick={() => setSettings({ autoWeekOptionId: o.id })}
            />
          ))}
      </div>
    </section>
  )
}

/** Which labels make a task worth surfacing early. Just ids into the same
 *  option table everything else uses — no special "priority" concept. */
function ImportantLabels() {
  const dimensions = useApp((s) => s.dimensions)
  const options = useApp((s) => s.options)
  const chosen = useApp((s) => s.settings.importantOptionIds ?? [])
  const setSettings = useApp((s) => s.setSettings)

  const toggle = (optionId: string) =>
    setSettings({
      importantOptionIds: chosen.includes(optionId)
        ? chosen.filter((x) => x !== optionId)
        : [...chosen, optionId],
    })

  return (
    <section className="settings-block">
      <h2 className="heading">Label penting</h2>
      <p className="settings-note">
        Task dengan label ini muncul lebih awal di tab focus, walaupun tanggalnya masih jauh.
      </p>
      {dimensions.map((dimension) => {
        const own = options
          .filter((o) => o.dimensionId === dimension.id)
          .sort((a, b) => a.order - b.order)
        if (!own.length) return null
        return (
          <div key={dimension.id} className="drawer-fields">
            <span className="gauge-label important-dim">{dimension.name}</span>
            {own.map((o) => (
              <Chip
                key={o.id}
                option={o}
                active={chosen.includes(o.id)}
                onClick={() => toggle(o.id)}
              />
            ))}
          </div>
        )
      })}
    </section>
  )
}

/** Where the grouping system is actually built. Nothing here is special-cased. */
function Groupings() {
  const dimensions = useApp((s) => s.dimensions)
  const options = useApp((s) => s.options)
  const app = useApp.getState()
  const [newDimension, setNewDimension] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [picking, setPicking] = useState<string | null>(null)

  return (
    <section className="settings-block">
      <h2 className="heading">Groupings</h2>
      <p className="settings-note">
        Every way you slice work lives here. Add one and it appears at once as a set of depths, a
        filter and a row of chips.
      </p>

      {dimensions.map((dimension) => {
        const own = options
          .filter((o) => o.dimensionId === dimension.id)
          .sort((a, b) => a.order - b.order)
        return (
          <div key={dimension.id} className="dimension">
            <div className="dimension-head">
              <input
                className="dimension-name"
                value={dimension.name}
                onChange={(e) => app.updateDimension(dimension.id, { name: e.target.value })}
              />
              <button
                className="quiet-button subtle"
                onClick={() =>
                  app.updateDimension(dimension.id, {
                    kind: dimension.kind === 'single' ? 'multi' : 'single',
                  })
                }
              >
                {dimension.kind === 'single' ? 'one value' : 'any number'}
              </button>
              <button
                className="quiet-button subtle"
                onClick={() => app.updateDimension(dimension.id, { showOnCard: !dimension.showOnCard })}
              >
                {dimension.showOnCard ? 'on rows' : 'hidden on rows'}
              </button>
              <button
                className="quiet-button danger"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  const owned = options.filter((o) => o.dimensionId === dimension.id)
                  const ids = new Set(owned.map((o) => o.id))
                  const touched = useApp
                    .getState()
                    .tasks.filter((t) => t.optionIds.some((x) => ids.has(x))).length
                  useUi.getState().askConfirm({
                    kind: 'delete',
                    title: `Grouping ${dimension.name}`,
                    note: `${owned.length} label dicabut dari ${touched} task`,
                    x: r.left - 60,
                    y: r.top + 28,
                    onConfirm: () => app.deleteDimension(dimension.id),
                  })
                }}
              >
                hapus
              </button>
            </div>

            <div className="option-rows">
              {own.map((option) => (
                <div key={option.id} className="option-row">
                  <button
                    className="swatch swatch-current"
                    style={{ background: option.color }}
                    onClick={() => setPicking(picking === option.id ? null : option.id)}
                    aria-label="Change colour"
                  />
                  {picking === option.id && (
                    <div className="swatches">
                      {OPTION_COLORS.map((c) => (
                        <button
                          key={c}
                          className="swatch"
                          data-on={c === option.color ? '' : undefined}
                          style={{ background: c }}
                          onClick={() => {
                            app.updateOption(option.id, { color: c })
                            setPicking(null)
                          }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  )}
                  <input
                    className="option-name"
                    value={option.name}
                    onChange={(e) => app.updateOption(option.id, { name: e.target.value })}
                  />
                  <button
                    className="icon-button"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      const used = useApp
                        .getState()
                        .tasks.filter((t) => t.optionIds.includes(option.id)).length
                      useUi.getState().askConfirm({
                        kind: 'delete',
                        title: `Label ${option.name}`,
                        note: used ? `dicabut dari ${used} task` : undefined,
                        x: r.left - 220,
                        y: r.top + 24,
                        onConfirm: () => app.deleteOption(option.id),
                      })
                    }}
                  >
                    <IconClose size={13} />
                  </button>
                </div>
              ))}

              <div className="option-add">
                <IconPlus size={14} />
                <input
                  value={drafts[dimension.id] ?? ''}
                  placeholder="another value"
                  onChange={(e) => setDrafts({ ...drafts, [dimension.id]: e.target.value })}
                  onKeyDown={(e) => {
                    const draft = (drafts[dimension.id] ?? '').trim()
                    if (e.key !== 'Enter' || !draft) return
                    app.addOption(
                      dimension.id,
                      draft,
                      OPTION_COLORS[own.length % OPTION_COLORS.length],
                    )
                    setDrafts({ ...drafts, [dimension.id]: '' })
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}

      <div className="option-add dimension-add">
        <IconPlus size={14} />
        <input
          value={newDimension}
          placeholder="a new way to group — Energy, Context, Client…"
          onChange={(e) => setNewDimension(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !newDimension.trim()) return
            app.addDimension(newDimension.trim(), 'single')
            setNewDimension('')
          }}
        />
      </div>
    </section>
  )
}

export function Settings() {
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const [path, setPath] = useState('')
  const [saveInfo, setSaveInfo] = useState<Awaited<ReturnType<typeof saveStatus>>>(null)
  const [saved, setSaved] = useState<{ savedAt: number | null; error: string | null }>({
    savedAt: null,
    error: null,
  })
  const [capturing, setCapturing] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    void dataPath().then(setPath)
    const refresh = () => void saveStatus().then(setSaveInfo)
    refresh()
    const iv = window.setInterval(refresh, 20_000)
    return () => window.clearInterval(iv)
  }, [])

  useEffect(() => watchSaves(setSaved), [])

  // record a real key combination rather than asking anyone to type "Control+Alt+Space"
  useEffect(() => {
    if (!capturing) return
    const onKey = async (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key === 'Escape') return setCapturing(false)
      const parts: string[] = []
      if (e.ctrlKey) parts.push('Control')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      if (e.metaKey) parts.push('Command')
      const key = e.code.replace(/^Key|^Digit/, '')
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      if (!parts.length) return
      const accelerator = [...parts, key].join('+')
      setSettings({ hotkey: accelerator })
      setCapturing(false)
      if (isTauri()) {
        try {
          await invoke('set_hotkey', { accelerator })
          setStatus(`hotkey is ${accelerator}`)
        } catch (err) {
          setStatus(`macOS refused that combination: ${String(err)}`)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capturing, setSettings])

  const doExport = async () => {
    const target = await saveDialog({
      defaultPath: `tide-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!target) return
    const s = useApp.getState()
    await exportTo(target, {
      version: 1,
      boards: s.boards,
      dimensions: s.dimensions,
      options: s.options,
      tasks: s.tasks,
      reminders: s.reminders,
      settings: s.settings,
    })
    setStatus(`written to ${target}`)
  }

  const doImport = async () => {
    const chosen = await openDialog({ multiple: false, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (!chosen || Array.isArray(chosen)) return
    try {
      const data = await importFrom(chosen)
      if (!data.version) throw new Error('not a Tide file')
      useApp.getState().replaceAll(data)
      setStatus('imported — the previous file is still in backups')
    } catch (err) {
      setStatus(`could not read that file: ${String(err)}`)
    }
  }

  return (
    <div className="settings">
      <header className="depths-head">
        <button className="icon-button" onClick={() => useUi.getState().go('surface')} title="Surface">
          <IconSurface size={18} />
        </button>
        <span className="gauge-label">settings</span>
      </header>

      <div className="settings-scroll">
        <Boards />

        <Groupings />

        <AutoWeek />

        <ImportantLabels />

        <section className="settings-block">
          <h2 className="heading">Hari</h2>
          <div className="field-row">
            <label className="number-field">
              <span className="gauge-label">starts</span>
              <input
                type="time"
                className="field mono"
                value={settings.dayStart}
                onChange={(e) => setSettings({ dayStart: e.target.value })}
              />
            </label>
            <label className="number-field">
              <span className="gauge-label">ends</span>
              <input
                type="time"
                className="field mono"
                value={settings.dayEnd}
                onChange={(e) => setSettings({ dayEnd: e.target.value })}
              />
            </label>
            <label className="number-field">
              <span className="gauge-label">second clock</span>
              <input
                className="field"
                placeholder="Asia/Jakarta"
                value={settings.secondClockZone ?? ''}
                onChange={(e) => setSettings({ secondClockZone: e.target.value || undefined })}
              />
            </label>
          </div>
        </section>

        <section className="settings-block">
          <h2 className="heading">Air & suara</h2>
          <div className="field-row">
            <Toggle
              on={settings.ambient === 'shader'}
              label={settings.ambient === 'shader' ? 'living water' : 'still water'}
              onClick={() => setSettings({ ambient: settings.ambient === 'shader' ? 'still' : 'shader' })}
            />
            <label className="number-field slider-field">
              <span className="gauge-label">chime</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.chimeVolume}
                onChange={(e) => setSettings({ chimeVolume: Number(e.target.value) })}
              />
            </label>
            <button className="quiet-button subtle" onClick={() => chime('focus', settings.chimeVolume)}>
              listen
            </button>
          </div>
        </section>

        <section className="settings-block">
          <h2 className="heading">Hotkey tangkap</h2>
          <div className="field-row">
            <span className="mono hotkey-display">{settings.hotkey}</span>
            <button className="quiet-button" onClick={() => setCapturing(true)}>
              {capturing ? 'press the combination…' : 'change'}
            </button>
          </div>
        </section>

        <section className="settings-block">
          <h2 className="heading">Datamu</h2>
          <p className="settings-note mono settings-path">{path}</p>

          <p className="settings-note" data-warn={saved.error ? '' : undefined}>
            {saved.error ? (
              <>Penyimpanan terakhir gagal: {saved.error}</>
            ) : saved.savedAt ? (
              <>Tersimpan {fmtRelative(saved.savedAt)}.</>
            ) : saveInfo?.saved_at ? (
              <>Tersimpan {fmtRelative(saveInfo.saved_at * 1000)}.</>
            ) : (
              <>Belum ada perubahan sejak dibuka.</>
            )}
          </p>

          <p className="settings-note">
            Ditulis lewat berkas sementara lalu diganti namanya, jadi penulisan yang terputus tidak
            bisa merusak berkasnya. {saveInfo ? `${saveInfo.backups} cadangan` : 'Cadangan'} tersimpan di
            <span className="mono"> backups/</span>, satu tiap seperempat jam dan sekurangnya satu
            setiap hari.
          </p>

          {saveInfo && (
            <p className="settings-note">
              Salinan harian{saveInfo.mirror_written ? ' hari ini sudah ditulis' : ' akan ditulis'} ke
              <span className="mono settings-path"> {saveInfo.mirror}</span>
            </p>
          )}
          <div className="field-row">
            <button className="quiet-button" onClick={doExport} disabled={!isTauri()}>
              export
            </button>
            <button className="quiet-button" onClick={doImport} disabled={!isTauri()}>
              import
            </button>
          </div>
          {status && <p className="settings-note">{status}</p>}
        </section>
      </div>
    </div>
  )
}
