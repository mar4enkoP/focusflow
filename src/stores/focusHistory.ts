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

export const useFocusHistoryStore = defineStore('focusHistory', () => {
  const sessions = ref<FocusSession[]>([])
  const observations = ref<Observation[]>([])
  function tick(id?: string, now = Date.now()) {
    const session = sessions.value.find((s) => s.taskId === id)
    if (!session || session.since === undefined) return
    const elapsed = now - session.since
    // Background suspension, sleep, clock changes and long gaps are not proof of work.
    if (elapsed < 0 || elapsed > 5 * 60000) session.reliable = false
    session.actualMs = Math.min(Number.MAX_SAFE_INTEGER, session.actualMs + Math.max(0, elapsed))
    session.since = now
    if (session.actualMs > MAX_RELIABLE_FOCUS_MS) session.reliable = false
  }
  function begin(task: Task, reliable = true) {
    let session = sessions.value.find((s) => s.taskId === task.id)
    if (!session) {
      session = {
        sessionId: crypto.randomUUID(),
        taskId: task.id,
        title: task.title,
        plannedMinutes: task.duration,
        actualMs: 0,
        reliable,
      }
      sessions.value.push(session)
      session = sessions.value[sessions.value.length - 1]!
    }
    session.since ??= Date.now()
  }
  function pause(id?: string) {
    tick(id)
    const session = sessions.value.find((s) => s.taskId === id)
    if (session) delete session.since
  }
  function finish(task: Task) {
    pause(task.id)
    const session = sessions.value.find((s) => s.taskId === task.id)
    if (session && !observations.value.some((o) => o.sessionId === session.sessionId)) {
      observations.value.push({ ...session, completedAt: Date.now() })
    }
    discard(task.id)
  }
  function discard(id: string) {
    sessions.value = sessions.value.filter((s) => s.taskId !== id)
  }
  function restore(value: unknown, tasks: Task[], activeId?: string) {
    if (!value || typeof value !== 'object') return false
    const data = value as { sessions?: unknown; observations?: unknown }
    if (!Array.isArray(data.sessions) || !Array.isArray(data.observations)) return false
    const seen = new Set<string>()
    let valid = true
    observations.value = data.observations.filter((o): o is Observation => {
      if (!validObservation(o)) {
        valid = false
        return false
      }
      if (seen.has(o.sessionId)) return false
      seen.add(o.sessionId)
      return true
    })
    const taskIds = new Set<string>()
    sessions.value = data.sessions.filter((s): s is FocusSession => {
      if (!validSession(s)) {
        valid = false
        return false
      }
      if (
        seen.has(s.sessionId) ||
        taskIds.has(s.taskId) ||
        !tasks.some((t) => t.id === s.taskId && !t.completed)
      )
        return false
      seen.add(s.sessionId)
      taskIds.add(s.taskId)
      return true
    })
    for (const session of sessions.value) {
      if (session.since !== undefined) {
        session.reliable = false
        if (session.taskId === activeId) tick(session.taskId)
        else delete session.since
      }
    }
    return valid
  }
  function snapshot() {
    return { sessions: sessions.value, observations: observations.value }
  }
  return { sessions, observations, tick, begin, pause, finish, discard, restore, snapshot }
})
