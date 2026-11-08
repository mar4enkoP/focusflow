import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { addDays, dayStart, localDay, summarize } from '../analytics'
import { validObservation, type Observation } from '../estimation'
import { useTasksStore } from '../stores/tasks'
import { useTimerStore } from '../stores/timer'
import { useFocusHistoryStore } from '../stores/focusHistory'

const record = (id: string, completedAt: number, minutes = 20): Observation => ({
  sessionId: id,
  taskId: id,
  title: id,
  plannedMinutes: 20,
  actualMs: minutes * 60000,
  completedAt,
  reliable: true,
  category: 'Work',
})
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 8, 12))
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())
it('handles empty histories with seven zero days and no fabricated accuracy', () => {
  const summary = summarize([], Date.now())
  expect(summary.todayMs).toBe(0)
  expect(summary.weekMs).toBe(0)
  expect(summary.completed).toBe(0)
  expect(summary.days).toHaveLength(7)
  expect(summary.accuracy).toBeUndefined()
})
it('counts reliable real work once and keeps incomplete sessions out of analytics', () => {
  const now = Date.now(),
    a = record('a', now)
  const summary = summarize(
    [a, a, { ...record('bad', now), reliable: false }, record('empty', now, 0)],
    now,
  )
  expect(summary.todayMs).toBe(1200000)
  expect(summary.completed).toBe(1)
  const tasks = useTasksStore(),
    timer = useTimerStore(),
    history = useFocusHistoryStore()
  tasks.save({ title: 'Working', duration: 10, category: 'Work' })
  timer.select(tasks.tasks[0]!.id)
  timer.start()
  vi.advanceTimersByTime(60000)
  timer.pause()
  expect(summarize(history.observations, Date.now()).todayMs).toBe(0)
})
it('splits intervals across local midnight while completion counts stay on completion day', () => {
  const start = new Date(2026, 10, 7, 23, 50).getTime(),
    end = new Date(2026, 10, 8, 0, 10).getTime()
  const summary = summarize([{ ...record('a', end), intervals: [{ start, end }] }], Date.now())
  expect(summary.todayMs).toBe(600000)
  expect(summary.days.find((d) => d.date === '2026-11-07')!.ms).toBe(600000)
  expect(summary.completedToday).toBe(1)
  expect(summary.legacy).toBe(0)
})
it('uses Monday week boundaries and local calendar dates', () => {
  const now = new Date(2026, 10, 9, 12).getTime()
  const summary = summarize(
    [
      record('sun', new Date(2026, 10, 8, 23, 59).getTime()),
      record('mon', new Date(2026, 10, 9, 0, 1).getTime()),
    ],
    now,
  )
  expect(summary.weekMs).toBe(1200000)
  expect(summary.todayMs).toBe(1200000)
  expect(localDay(new Date(2026, 0, 1, 0, 1).getTime())).toBe('2026-01-01')
})
it.each([
  [2026, 2, 29],
  [2026, 9, 25],
])('uses calendar days across DST boundaries %j', (year, month, day) => {
  const start = new Date(year!, month!, day!).getTime(),
    end = addDays(start, 1)
  expect(new Date(end).getDate()).toBe(day! + 1)
  expect(new Date(end).getHours()).toBe(0)
  const offsetDifference = new Date(end).getTimezoneOffset() - new Date(start).getTimezoneOffset()
  expect(end - start).toBe((24 * 60 + offsetDifference) * 60000)
  const focusStart = start + 60000,
    focusEnd = start + 4 * 3600000
  const summary = summarize(
    [
      {
        ...record('dst', focusEnd, (focusEnd - focusStart) / 60000),
        intervals: [{ start: focusStart, end: focusEnd }],
      },
    ],
    end + 60000,
  )
  expect(summary.days.find((d) => d.date === localDay(start))!.ms).toBe(focusEnd - focusStart)
})
it('documents legacy attribution and keeps missing categories unknown', () => {
  const legacy = record('legacy', Date.now())
  delete legacy.category
  const summary = summarize([legacy], Date.now())
  expect(summary.legacy).toBe(1)
  expect(summary.categories).toEqual([{ name: 'Unknown (legacy)', ms: 1200000 }])
})
it('calculates planned/actual accuracy only for meaningful reliable durations', () => {
  const summary = summarize(
    [
      record('accurate', Date.now()),
      record('under', Date.now(), 40),
      record('tiny', Date.now(), 0.1),
    ],
    Date.now(),
  )
  expect(summary.accuracy).toBe(75)
  expect(summary.records[1]!.plannedMinutes).toBe(20)
  expect(summary.records[1]!.actualMs).toBe(2400000)
})
it('records category and intervals, excludes pauses, and survives deletion of completed tasks', () => {
  const tasks = useTasksStore(),
    timer = useTimerStore(),
    history = useFocusHistoryStore()
  tasks.save({ title: 'Reading', duration: 20, category: 'Reading' })
  timer.select(tasks.tasks[0]!.id)
  const start = Date.now()
  timer.start()
  vi.advanceTimersByTime(60000)
  timer.pause()
  vi.advanceTimersByTime(60000)
  timer.start()
  vi.advanceTimersByTime(60000)
  timer.complete()
  expect(history.observations[0]).toMatchObject({
    category: 'Reading',
    actualMs: 120000,
    intervals: [
      { start, end: start + 60000 },
      { start: start + 120000, end: start + 180000 },
    ],
  })
  tasks.remove(tasks.tasks[0]!.id)
  expect(summarize(history.observations, Date.now()).categories).toEqual([
    { name: 'Reading', ms: 120000 },
  ])
})
it('rejects overlapping or inflated persisted intervals', () => {
  const now = Date.now()
  expect(
    validObservation({
      ...record('a', now),
      intervals: [
        { start: now - 100, end: now },
        { start: now - 50, end: now },
      ],
    }),
  ).toBe(false)
  expect(
    validObservation({ ...record('a', now), intervals: [{ start: now - 9999999, end: now }] }),
  ).toBe(false)
  expect(dayStart(now)).toBe(new Date(2026, 10, 8).getTime())
})
