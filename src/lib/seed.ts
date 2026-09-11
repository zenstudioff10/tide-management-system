import { id } from './id'
import type { AppData, Board, DimOption, Dimension, Task } from '../types'

/** First run: an example week, and the four ways it gets sliced. None of these
 *  dimensions are special to the code — rename, recolour or delete any of them
 *  and the depths rebuild around whatever is left. Your own schedule lives in
 *  tide.json on your machine, never in here. */
export function seedData(): AppData {
  const ulangan: Board = { id: id(), name: 'Ulangan', order: 0, groupBy: 'date' }
  const tugas: Board = { id: id(), name: 'Tugas', order: 1, groupBy: 'date' }
  const boards: Board[] = [ulangan, tugas]

  const dimensions: Dimension[] = []
  const options: DimOption[] = []

  const dim = (name: string, kind: 'single' | 'multi') => {
    const d: Dimension = { id: id(), name, kind, order: dimensions.length, showOnCard: true }
    dimensions.push(d)
    return d
  }
  const opt = (d: Dimension, name: string, color: string) => {
    const o: DimOption = {
      id: id(),
      dimensionId: d.id,
      name,
      color,
      order: options.filter((x) => x.dimensionId === d.id).length,
    }
    options.push(o)
    return o
  }

  const tingkat = dim('Tingkat', 'single')
  const HARD = opt(tingkat, 'HARD', '#dd6b4d')
  const MEDIUM = opt(tingkat, 'MEDIUM', '#d89a62')
  const EASY = opt(tingkat, 'EASY', '#6fbfb4')

  const tipe = dim('Tipe', 'multi')
  const logika = opt(tipe, 'Logika/Hitung', '#7c9fc0')
  const hafalan = opt(tipe, 'Hafalan', '#c9bfaa')

  const perhatian = dim('Perhatian', 'multi')
  const attention = opt(perhatian, 'High Attention', '#cf7f92')

  const waktu = dim('Waktu', 'multi')
  const mingguIni = opt(waktu, 'Minggu ini', '#a48fc4')
  const belajarH1 = opt(waktu, 'Bisa belajar H-1', '#5b7fa8')

  // an example September; the weekday names in the app follow from these dates
  const at = (day: number) => new Date(2026, 8, day, 9, 0, 0, 0).getTime()
  const created = Date.now()
  let order = 0

  const task = (title: string, day: number, optionIds: string[]): Task => ({
    id: id(),
    boardId: ulangan.id,
    title,
    notes: '',
    status: 'open',
    optionIds,
    dueAt: at(day),
    order: order++,
    subtasks: [],
    createdAt: created,
  })

  const tasks: Task[] = [
    task('UH Fisika Gravitasi', 10, [HARD.id, logika.id]),
    task('UH Biologi Sel dan Histologi', 15, [HARD.id, hafalan.id, attention.id]),
    task('UH Biologi Struktur Sel', 17, [HARD.id, hafalan.id, attention.id]),
    task('UH Proposal Penelitian', 17, [logika.id, belajarH1.id]),
    task('UH Fisika Elastisitas dan Gerak Harmonik', 14, [HARD.id, logika.id, attention.id]),
    task('Quiz Biologi Sel', 10, [HARD.id, hafalan.id, attention.id]),
    task('Quiz Matematika Lanjut — lingkaran', 14, [HARD.id, logika.id, attention.id]),
    task('UH Matematika Lanjut — lingkaran', 17, [HARD.id, logika.id, attention.id]),
    task('Quiz Matematika Wajib — peluang', 9, [HARD.id, logika.id, attention.id]),
    task('UH Matematika Wajib — permutasi & kombinasi', 15, [HARD.id, logika.id, attention.id]),
    task('UH Reading', 16, [EASY.id, belajarH1.id, logika.id]),
    task('Quiz Kimia', 8, [MEDIUM.id, belajarH1.id, logika.id]),
    task('UH Agama', 11, [EASY.id, hafalan.id, logika.id, belajarH1.id]),
    task('Native Writing test', 18, [EASY.id, logika.id, belajarH1.id]),
    task('UH Informatika — CSS', 16, [MEDIUM.id, hafalan.id]),
    task('UH Sejarah — kolonialisme dan imperialisme', 11, [MEDIUM.id, hafalan.id]),
  ]

  return {
    version: 1,
    boards,
    dimensions,
    options,
    tasks,
    reminders: [],
    settings: {
      pomodoro: {
        focus: 25,
        short: 5,
        long: 15,
        cyclesBeforeLong: 4,
        autoStartBreak: true,
        autoStartNext: false,
      },
      hotkey: 'Control+Alt+Space',
      chimeVolume: 0.5,
      uiSounds: true,
      voice: true,
      ambient: 'shader',
      clock24h: true,
      showSeconds: false,
      dayStart: '06:00',
      dayEnd: '22:00',
      // opens on the date buckets — what is coming, before anything else
      defaultGroupBy: 'date',
      importantOptionIds: [HARD.id, attention.id],
      activeBoardId: ulangan.id,
      // maintained by the app: on for anything due Monday–Friday of this week
      autoWeekOptionId: mingguIni.id,
      autoWeekBoardIds: [ulangan.id],
    },
  }
}
