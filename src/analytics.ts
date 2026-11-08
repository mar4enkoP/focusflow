import { MAX_RELIABLE_FOCUS_MS, type Observation } from './estimation'
export function localDay(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dayStart(timestamp: number) {
  const d = new Date(timestamp)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
export function addDays(timestamp: number, days: number) {
  const d = new Date(timestamp)
  d.setDate(d.getDate() + days)
  return d.getTime()
}
export function summarize(history: Observation[], now: number) {
  const today = dayStart(now),
    week = addDays(today, -((new Date(today).getDay() + 6) % 7))
  const seen = new Set<string>()
  const records = history.filter((o) => {
    if (seen.has(o.sessionId)) return false
    seen.add(o.sessionId)
    return (
      o.reliable && o.actualMs > 0 && o.actualMs <= MAX_RELIABLE_FOCUS_MS && o.completedAt <= now
    )
  })
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: localDay(addDays(today, i - 6)),
    ms: 0,
  }))
  const daily = new Map<string, number>()
  const categories = new Map<string, number>()
  let legacy = 0
  for (const record of records) {
    categories.set(
      record.category ?? 'Unknown (legacy)',
      (categories.get(record.category ?? 'Unknown (legacy)') ?? 0) + record.actualMs,
    )
    let located = 0
    for (const interval of record.intervals ?? []) {
      let start = interval.start
      const end = Math.min(interval.end, now)
      while (start < end) {
        const boundary = Math.min(end, addDays(dayStart(start), 1))
        const key = localDay(start)
        daily.set(key, (daily.get(key) ?? 0) + boundary - start)
        located += boundary - start
        start = boundary
      }
    }
    const remainder = Math.max(0, record.actualMs - located)
    if (remainder) {
      legacy++
      const key = localDay(record.completedAt)
      daily.set(key, (daily.get(key) ?? 0) + remainder)
    }
  }
  for (const day of days) day.ms = daily.get(day.date) ?? 0
  const weekMs = [...daily]
    .filter(([day]) => day >= localDay(week) && day <= localDay(today))
    .reduce((sum, [, ms]) => sum + ms, 0)
  const accuracyRecords = records.filter((o) => o.actualMs >= 60000)
  const error = accuracyRecords.length
    ? accuracyRecords.reduce(
        (sum, o) => sum + Math.abs(o.plannedMinutes * 60000 - o.actualMs) / o.actualMs,
        0,
      ) / accuracyRecords.length
    : undefined
  return {
    todayMs: daily.get(localDay(today)) ?? 0,
    weekMs,
    days,
    records,
    completed: new Set(records.map((o) => o.taskId)).size,
    completedToday: new Set(
      records.filter((o) => localDay(o.completedAt) === localDay(today)).map((o) => o.taskId),
    ).size,
    accuracy: error === undefined ? undefined : Math.max(0, 100 * (1 - error)),
    categories: [...categories].map(([name, ms]) => ({ name, ms })),
    legacy,
    excluded:
      history.length -
      seen.size +
      [...new Map(history.map((o) => [o.sessionId, o])).values()].filter(
        (o) => !o.reliable || o.actualMs <= 0 || o.actualMs > MAX_RELIABLE_FOCUS_MS,
      ).length,
  }
}
