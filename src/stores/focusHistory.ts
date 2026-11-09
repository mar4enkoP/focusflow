import { useWorkspaceAccessStore } from './workspaceAccess'
import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Task } from './tasks'
import {
  MAX_RELIABLE_FOCUS_MS,
  validObservation,
  validSession,
  type FocusSession,
  type Observation,
} from '@/estimation'

// Compare all stored fields, including nested intervals, independently of object key order.
// Unknown fields are included so differing data is never silently treated as a duplicate.
function recordSignature(value: FocusSession | Observation) {
  return JSON.stringify(value, (_key: string, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  )
}

export const useFocusHistoryStore = defineStore('focusHistory', () => {
  const access = useWorkspaceAccessStore()
  const sessions = ref<FocusSession[]>([])
  const observations = ref<Observation[]>([])
  function tick(id?: string, now = Date.now()) {
    if (!access.canMutate) return false
    const session = sessions.value.find((s) => s.taskId === id)
    if (!session || session.since === undefined) return
    const elapsed = now - session.since
    const last = session.intervals?.[session.intervals.length - 1]
    const start = Math.max(session.since, last?.end ?? session.since)
    const measured = Math.max(0, now - start)
    // Background suspension, sleep, clock changes and long gaps are not proof of work.
    if (elapsed < 0 || elapsed > 5 * 60000 || start > session.since) session.reliable = false
    if (measured > 0 && session.intervals) {
      if (last?.end === start) last.end = now
      else session.intervals.push({ start, end: now })
    }
    session.actualMs = Math.min(Number.MAX_SAFE_INTEGER, session.actualMs + measured)
    // Keep the high-water mark when a caller ticks again before the clock catches up.
    session.since = Math.max(session.since, now)
    if (session.actualMs > MAX_RELIABLE_FOCUS_MS) session.reliable = false
  }
  function begin(task: Task, reliable = true) {
    if (!access.canMutate) return false
    let session = sessions.value.find((s) => s.taskId === task.id)
    if (!session) {
      session = {
        sessionId: crypto.randomUUID(),
        taskId: task.id,
        title: task.title,
        plannedMinutes: task.duration,
        actualMs: 0,
        reliable,
        category: task.category,
        intervals: [],
      }
      sessions.value.push(session)
      session = sessions.value[sessions.value.length - 1]!
    }
    const now = Date.now()
    if (now < (session.intervals?.[session.intervals.length - 1]?.end ?? 0))
      session.reliable = false
    session.since ??= now
  }
  function pause(id?: string, now = Date.now()) {
    if (!access.canMutate) return false
    tick(id, now)
    const session = sessions.value.find((s) => s.taskId === id)
    if (session) {
      if (now < (session.intervals?.[session.intervals.length - 1]?.end ?? 0))
        session.reliable = false
      delete session.since
    }
  }
  function finish(task: Task) {
    if (!access.canMutate) return false
    const now = Date.now()
    pause(task.id, now)
    const session = sessions.value.find((s) => s.taskId === task.id)
    if (session && !observations.value.some((o) => o.sessionId === session.sessionId)) {
      observations.value.push({ ...session, completedAt: now })
    }
    discard(task.id)
  }
  function discard(id: string) {
    if (!access.canMutate) return false
    sessions.value = sessions.value.filter((s) => s.taskId !== id)
  }
  function restore(value: unknown, tasks: Task[], activeId?: string) {
    if (!access.canMutate) return false
    if (!value || typeof value !== 'object') return false
    const data = value as { sessions?: unknown; observations?: unknown }
    if (!Array.isArray(data.sessions) || !Array.isArray(data.observations)) return false
    const seen = new Map<string, { kind: 'session' | 'observation'; signature: string }>()
    let valid = true
    function unique(record: FocusSession | Observation, kind: 'session' | 'observation') {
      const signature = recordSignature(record)
      const previous = seen.get(record.sessionId)
      if (previous) {
        // A conflict makes persistence preserve the original raw snapshot. Only exact
        // duplicates of the same record kind can be dropped without losing information.
        if (previous.kind !== kind || previous.signature !== signature) valid = false
        return false
      }
      seen.set(record.sessionId, { kind, signature })
      return true
    }
    observations.value = data.observations.filter((o): o is Observation => {
      if (!validObservation(o)) {
        valid = false
        return false
      }
      return unique(o, 'observation')
    })
    const taskIds = new Set<string>()
    sessions.value = data.sessions.filter((s): s is FocusSession => {
      if (!validSession(s)) {
        valid = false
        return false
      }
      if (!unique(s, 'session')) return false
      if (taskIds.has(s.taskId)) {
        valid = false
        return false
      }
      taskIds.add(s.taskId)
      return tasks.some((t) => t.id === s.taskId && !t.completed)
    })
    for (const session of sessions.value) {
      if (session.since !== undefined) {
        session.reliable = false
        // The timer reconciles the active session after inspecting its original timestamp.
        if (session.taskId !== activeId) delete session.since
      }
    }
    return valid
  }
  function snapshot() {
    return { sessions: sessions.value, observations: observations.value }
  }
  return { sessions, observations, tick, begin, pause, finish, discard, restore, snapshot }
})
