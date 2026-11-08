import { normalizeTitle } from './stores/taskMemory'

export interface FocusSession {
  sessionId: string
  taskId: string
  title: string
  plannedMinutes: number
  actualMs: number
  since?: number
  reliable: boolean
  category?: string
  intervals?: { start: number; end: number }[]
}
export interface Observation extends Omit<FocusSession, 'since'> {
  completedAt: number
}
export const MAX_RELIABLE_FOCUS_MS = 8 * 60 * 60000
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function validSession(value: unknown): value is FocusSession {
  if (!value || typeof value !== 'object') return false
  const s = value as FocusSession
  return (
    typeof s.sessionId === 'string' &&
    !!s.sessionId.trim() &&
    typeof s.taskId === 'string' &&
    !!s.taskId.trim() &&
    typeof s.title === 'string' &&
    !!s.title.trim() &&
    integer(s.plannedMinutes) &&
    s.plannedMinutes >= 1 &&
    s.plannedMinutes <= 1440 &&
    integer(s.actualMs) &&
    typeof s.reliable === 'boolean' &&
    (s.category === undefined ||
      ['Work', 'Study', 'Personal', 'Health', 'Reading'].includes(s.category)) &&
    (s.intervals === undefined ||
      (Array.isArray(s.intervals) &&
        s.intervals.every(
          (interval, index) =>
            interval &&
            integer(interval.start) &&
            integer(interval.end) &&
            interval.end >= interval.start &&
            (index === 0 || interval.start >= s.intervals![index - 1]!.end),
        ) &&
        s.intervals.reduce((total, interval) => total + interval.end - interval.start, 0) <=
          s.actualMs)) &&
    (s.since === undefined || (integer(s.since) && s.since <= Date.now()))
  )
}
export function validObservation(value: unknown): value is Observation {
  const o = value as Observation
  return (
    validSession(value) &&
    !('since' in value) &&
    integer(o.completedAt) &&
    (!o.reliable ||
      o.intervals === undefined ||
      o.intervals.every((interval) => interval.end <= o.completedAt)) &&
    o.completedAt <= Date.now()
  )
}
function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}
// Latest nine reliable completions; median resists isolated outliers. Three samples
// start a conservative 50% blend, rising to 80% at five. Preferences remain separate.
export function estimateDuration(title: string, preferred: number, history: Observation[]) {
  const fallback = Math.max(
    1,
    Math.min(1440, Number.isFinite(preferred) ? Math.round(preferred) : 25),
  )
  const samples = history
    .filter(
      (o) =>
        o.reliable &&
        o.actualMs >= 60000 &&
        o.actualMs <= MAX_RELIABLE_FOCUS_MS &&
        normalizeTitle(o.title) === normalizeTitle(title),
    )
    .sort((a, b) => b.completedAt - a.completedAt || a.sessionId.localeCompare(b.sessionId))
    .slice(0, 9)
  if (samples.length < 3) return { minutes: fallback, count: samples.length, learned: false }
  const weight = samples.length >= 5 ? 0.8 : 0.5
  const blended = fallback * (1 - weight) + median(samples.map((o) => o.actualMs / 60000)) * weight
  const increment = blended < 10 ? 1 : 5
  return {
    minutes: Math.max(1, Math.min(1440, Math.round(blended / increment) * increment)),
    count: samples.length,
    learned: true,
  }
}
