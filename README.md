# Tide

A desktop management system that runs as one screen of water: tasks, a clock, a
countdown, reminders and a pomodoro, held together by depth.

Built with Tauri 2, React 19, TypeScript and a hand-written WebGL2 ocean.

## Running it

```bash
npm install
npm run app       # tauri dev — the real desktop window
npm run bundle    # a signed-less .app and .dmg in src-tauri/target/release/bundle
```

`npm run dev` alone opens the interface in a browser with localStorage instead of
the data file. Useful for styling, but the menu bar timer, the global hotkey and
native notifications only exist inside the app.

## The idea

**Depth is the information axis.** Work further out in time sits deeper and
darker. Starting a focus session takes the whole interface down with it — the
water dims, the surface light climbs out of frame — and a break brings it back up
into the light with a breathing pacer. The palette is driven by the actual hour,
so opening the app tells you roughly what time it is before you read the clock:
pre-dawn indigo, dawn rose-gold, midday caustics, dusk amber, night ink with a
moon path.

## Lists

The column is split into **lists** — *Ulangan* and *Tugas* to begin with, plus
whatever you add with the `+` beside the tabs. Switching a tab switches the
whole app's context: the homescreen agenda, the briefing and every count follow
it. `semua` shows them together.

Each list remembers how you were looking at it — its own grouping and its own
filters — while the labels themselves stay shared, so HARD means HARD in every
list. A task moves between lists from its own drawer. Deleting a list never
deletes its contents; they move to the first remaining list.

## Grouping is data, not code

There is no `difficulty` field. There is no `week` field. Instead:

- a **Dimension** is a way of slicing work — *Difficulty*, *Flags*, *Horizon*
- an **Option** is one value inside it — *Hard*, *Needs attention*, *Next week*
- a task holds a flat list of option ids, and nothing else

The depth column groups by whichever dimension you pick, so **creating a new
dimension in Settings creates a new set of depths, a new filter and a new row of
chips, with no code change**. Single-value dimensions swap when you pick another;
multi-value ones accumulate. Tasks with no value in the active dimension collect
in a lane called *Drifting*.

Four dimensions are seeded on first run, the ones the schedule actually uses —
**Tingkat** (HARD/MEDIUM/EASY), **Tipe** (Logika/Hitung, Hafalan), **Perhatian**
(High Attention) and **Waktu** (Minggu ini, Bisa belajar H-1) — along with the 16
exams themselves. Rename, recolour or delete any of it.

Which labels count as *penting* is also just data — pick them in Settings, and
the briefing surfaces anything carrying them, however far off its date is.

One grouping is computed rather than stored: **Tanggal**, whose lanes are
*Terlewat · Hari ini · Besok · Minggu ini · Minggu depan · Nanti · Tanpa tanggal*,
derived from each task's due date. It is the default view. Rows cannot be dragged
between date lanes — moving a card should never silently rewrite an exam date —
but the `+` inside a lane inherits that lane's day.

## Screens

| | |
|---|---|
| **Surface** | clock, date, the task list itself, the day drawn as a draining tide with reminders moored along it, and the fortnight's load |
| **Depths** | the water column, one list at a time — a fixed date column on the left (`KAM 10 / SEP`), the title, then its labels as coloured highlights. Group by date or by any dimension, filter, drag between depths, open a task for notes, steps, due date and estimate |
| **Focus** | the briefing — how heavy the fortnight is, what falls soonest (said as *besok*, *5 hari lagi*), and what carries a label you marked important |
| **Timer** | one large face with a pomodoro / hitung mundur / stopwatch switch. Durations are edited inline; the wall clock, date and format toggles sit in the footer. Whatever is running shows in the menu bar |
| **Reminders** | buoys — one-off or repeating, with snooze when they ring |
| **Settings** | the dimension editor, dive lengths, the working day, water and sound, the capture hotkey, export and import |

## Asking it things

`⌘K` opens a conversation about your schedule — and only your schedule. There is
no model and no network: it reads the sentence for a date range, labels, a list
and an intent, then writes the answer from templates. Everything happens against
the file already on your disk.

```
— minggu ini sibuk nggak
  Lumayan padat — 5 agenda minggu ini, 3 di antaranya penting.
  Paling berat KAMIS 10 September: 2 agenda.

— kalau minggu depan
  Lumayan padat — 10 agenda minggu depan, 6 di antaranya penting.
  Paling berat KAMIS 17 September: 3 agenda.
```

Follow-ups work: a question with only a new date keeps the previous subject.
Typos are forgiven from five letters up (`mingu depan`, `hafalann`), so `hari`
can never be mistaken for `HARD`.

| what it does | asked like |
|---|---|
| a day or a range | `kamis ada apa` · `besok` · `minggu depan` · `tanggal 17` · `3 hari ke depan` |
| by label | `apa yang hard minggu ini` · `hafalan apa aja` |
| by list | `tugas minggu ini` · `ulangan besok` |
| how many | `berapa yang hard minggu depan` |
| one date | `kapan ulangan fisika` |
| how heavy | `minggu ini sibuk nggak` · `hari apa paling padat` |
| free days | `kapan aku senggang minggu ini` |
| where to start | `mulai belajar dari mana` |
| compare | `minggu ini vs minggu depan` |
| what slipped | `ada yang telat nggak` · `gimana hari ini` |

Ask it anything else — the weather, the capital of somewhere — and it says so
rather than guessing: *"Aku cuma tahu jadwalmu"*, with examples. Commands still
work: type `depths` and it offers to open it below the box.

## Keys

| | |
|---|---|
| `⌘K` | command palette — jump, dive on a task, change the grouping |
| `g` then `s d f t r ,` | surface, depths, focus, timer, reminders, settings |
| `j` `k` | move down and up the column |
| `x` `e` | complete, open |
| `1`–`9` | assign the nth value of the active dimension |
| `⌃⌥Space` | capture bar from anywhere (rebindable in Settings) |

Capture syntax: `UH Kimia #hard #hafalan jumat 3pm` — `#` matches any label by
name, dates understand Indonesian (*hari ini, besok, lusa, minggu depan,
senin…minggu*) as well as English (*today, tmr, next week, in 30m*), and times
take `3pm`, `15:00` or `9.30am`. `⌘N`, or the `+` on the capture bar, opens the
full form instead: title, day, labels, notes.

## Your data

One file, readable, yours:

```
~/Library/Application Support/com.tide.app/tide.json
~/Library/Application Support/com.tide.app/backups/tide-YYYYMMDD-HHmm.json
```

Writes are debounced by 800ms, then performed in Rust as a temp file plus a
rename, so an interrupted write cannot corrupt the file.

Losing an edit takes more than one accident:

- **Every way out writes first.** Hiding the window, losing focus, closing the
  tab — and Quit, which Rust holds open until the interface confirms its last
  write is on disk, with a 1.2s deadline so a wedged webview can never trap the
  app open.
- **Backups** in `backups/`: one per quarter hour of activity, and at least one
  every day however quiet that day was. The last twenty are kept.
- **A daily copy in Documents.** `~/Documents/Tide/tide-YYYY-MM-DD.json`, written
  once a day — somewhere you actually look, and somewhere iCloud will carry it.
- **A failed write is never silent.** It says so on screen, keeps the edit
  pending, and retries on the next change rather than dropping it.
- **In the browser** the previous version is kept alongside the current one, so a
  half-written entry is never the only copy.

Settings shows when it last saved, how many backups exist, and where today's copy
went. Export and import are there too. Nothing is sent anywhere; the app makes no
network requests.

## Notes on the build

- **Every clock is anchored to wall-clock time.** Sleeping the Mac or hiding the
  window cannot make a pomodoro or a countdown drift.
- **The tide is the progress bar.** While a focus block or countdown runs the
  waterline drains across the session and rises again on a break — and because
  it is published centrally, it keeps draining while you read the schedule on
  another screen.
- **One writer.** The capture bar is a second window with its own JavaScript
  context, so it never touches the data file — it hands the line to the main
  window, which owns every write.
- **The list has a ground.** Depths sits on a soft-edged field of ink that fades
  out at its margins, so type stays legible while the water keeps moving around
  and above it. No white card, no frosted glass. Depth dims a lane's chrome, never
  its text.
- **It never opens empty.** A loading screen is inlined into `index.html` —
  markup and CSS the parser paints before the bundle is even fetched — so the
  window is the app's own near-black from the first frame, with the wordmark
  over a breathing line while the data file is read. It stays a minimum of 700ms
  so it cannot flash past, and the ascent begins only once it has gone, rather
  than playing its first second out of sight behind it.
- **The deep is inhabited.** Four fish cross the lower water on independent
  speeds, undulating along their own length rather than sliding. They are gated
  on depth, so the bright homescreen keeps its stillness and the column below
  has company. They are drawn as what catches light, not as shadows — in
  near-black water a silhouette would be invisible.
- **The ocean pauses when unwatched.** No frames are rendered while the window is
  hidden, the DPR is capped at 2, and `prefers-reduced-motion` settles the water
  to stillness. Settings can drop it to a static gradient entirely.
- **Closing the window parks the app in the menu bar**, where the session keeps
  running and reminders still fire. Quit lives in the tray menu.

## Layout

```
src/
  ocean/       palette.ts (the hour's colours), shaders.ts (water, fish), Ocean.tsx
  design/      tokens.css, components.css, routes.css, icons.tsx
  store/       useApp (data + persistence), useUi, useTimers, selectors
  lib/         quickparse, time, chime (WebAudio), persist, notify, tray, seed
  routes/      Surface, Depths, Focus, Timer, Reminders, Settings
  quick-add/   the hotkey capture window
src-tauri/src/ storage.rs (atomic writes), tray.rs, shortcut.rs, lib.rs
```
