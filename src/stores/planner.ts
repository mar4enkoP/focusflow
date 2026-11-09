import { useWorkspaceAccessStore } from './workspaceAccess'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useTasksStore } from './tasks'
import { useFocusHistoryStore } from './focusHistory'
import { generateSchedule, validSettings, type PlanSettings, type Schedule } from '@/planning'
import { localDay } from '@/analytics'

export interface SessionPlan {
  id: string
  date: string
  createdAt: number
  settings: PlanSettings
  schedule: Schedule
  completedIds: string[]
  baseline: Record<string, number>
  expected: Record<string, number>
  startedAt?: number
  activeId?: string
  offset: number
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export const usePlannerStore = defineStore('planner', () => {
  const access = useWorkspaceAccessStore()
  const tasks = useTasksStore(),
    history = useFocusHistoryStore()
  const settings = ref<PlanSettings>({
    minutes: 60,
    breakMinutes: 5,
    breakEvery: 2,
    selectedIds: [],
  })
  const accepted = ref<SessionPlan>()
  const proposal = ref<SessionPlan>()
  const error = ref('')
  function updateSettings(value: PlanSettings) {
    if (!access.canEdit) return
    settings.value = copy(value)
  }
  function actual(id: string) {
    return (
      history.observations.filter((o) => o.taskId === id).reduce((sum, o) => sum + o.actualMs, 0) +
      history.sessions.filter((s) => s.taskId === id).reduce((sum, s) => sum + s.actualMs, 0)
    )
  }
  function spent(id: string) {
    return Math.max(0, (actual(id) - (accepted.value?.baseline[id] ?? 0)) / 60000)
  }
  function remaining(now = Date.now()) {
    const plan = accepted.value
    if (!plan) return 0
    return Math.max(
      0,
      plan.settings.minutes -
        (plan.startedAt === undefined ? 0 : Math.max(0, (now - plan.startedAt) / 60000)),
    )
  }
  const overrun = computed(
    () =>
      !!accepted.value &&
      accepted.value.settings.selectedIds.some(
        (id) =>
          !accepted.value!.completedIds.includes(id) &&
          spent(id) > (accepted.value!.expected[id] ?? Infinity),
      ),
  )
  const nextId = computed(
    () =>
      accepted.value?.schedule.slots.find(
        (slot) =>
          slot.kind === 'task' &&
          !accepted.value!.completedIds.includes(slot.taskId!) &&
          tasks.tasks.some((t) => t.id === slot.taskId && !t.completed),
      )?.taskId,
  )
  function generate(reschedule = false, now = Date.now()) {
    if (!access.canMutate) return false
    error.value = ''
    if (!validSettings(settings.value)) {
      error.value = 'Use 1–1,440 minutes, breaks of 0–60 minutes, and a frequency of 1–20 tasks.'
      return
    }
    const previous = reschedule ? accepted.value : undefined
    if (reschedule && !previous) return
    const config = copy(previous?.settings ?? settings.value)
    const completedIds = [...(previous?.completedIds ?? [])]
    const offset =
      previous?.startedAt === undefined
        ? 0
        : Math.min(config.minutes, Math.max(0, Math.ceil((now - previous.startedAt) / 60000)))
    const active =
      previous?.activeId &&
      !completedIds.includes(previous.activeId) &&
      tasks.tasks.some((t) => t.id === previous.activeId && !t.completed)
        ? {
            id: previous.activeId,
            remaining: Math.max(
              1,
              (previous.expected[previous.activeId] ?? 0) - spent(previous.activeId),
            ),
          }
        : undefined
    // An overrun has no trustworthy remaining estimate. Reserve five more minutes
    // explicitly in the proposal; the user can reject it without touching the timer.
    if (active && spent(active.id) >= (previous!.expected[active.id] ?? 0)) active.remaining = 5
    const pending = {
      ...config,
      selectedIds: config.selectedIds.filter((id) => !completedIds.includes(id)),
    }
    const schedule = generateSchedule(
      tasks.tasks,
      pending,
      history.observations,
      config.minutes - offset,
      active,
      completedIds.length,
    )
    const baseline =
      previous?.baseline ?? Object.fromEntries(config.selectedIds.map((id) => [id, actual(id)]))
    const expected = { ...previous?.expected }
    for (const slot of schedule.slots)
      if (slot.taskId)
        expected[slot.taskId] = (previous ? spent(slot.taskId) : 0) + slot.end - slot.start
    proposal.value = {
      id: previous?.id ?? crypto.randomUUID(),
      date: previous?.date ?? localDay(now),
      createdAt: previous?.createdAt ?? now,
      settings: config,
      schedule,
      completedIds,
      baseline,
      expected,
      startedAt: previous?.startedAt,
      activeId: previous?.activeId,
      offset,
    }
  }
  function accept(now = Date.now()) {
    if (!access.canMutate) return false
    const plan = proposal.value
    if (!plan) return false
    if (
      plan.schedule.slots.some(
        (s) => s.taskId && !tasks.tasks.some((t) => t.id === s.taskId && !t.completed),
      ) ||
      (plan.startedAt !== undefined &&
        (plan.offset !==
          Math.min(plan.settings.minutes, Math.max(0, Math.ceil((now - plan.startedAt) / 60000))) ||
          plan.schedule.total >
            Math.max(0, plan.settings.minutes - Math.ceil((now - plan.startedAt) / 60000))))
    ) {
      error.value = 'Tasks or available time changed. Generate a fresh proposal.'
      return false
    }
    accepted.value = copy(plan)
    proposal.value = undefined
    return true
  }
  function reject() {
    if (!access.canMutate) return false
    proposal.value = undefined
    error.value = ''
  }
  function begin(id: string, now = Date.now()) {
    if (!access.canMutate) return false
    const plan = accepted.value
    if (plan && plan.startedAt === undefined && plan.date !== localDay(now)) {
      error.value =
        'This plan belongs to another day. Generate and accept a new proposal to carry work forward.'
      return false
    }
    if (
      !plan ||
      !plan.schedule.slots.some((s) => s.taskId === id) ||
      !tasks.tasks.some((t) => t.id === id && !t.completed) ||
      remaining(now) <= 0
    )
      return false
    plan.startedAt ??= now
    plan.activeId = id
    return true
  }
  watch(
    () => tasks.tasks.map((t) => `${t.id}:${t.completed}`).join('|'),
    () => {
      if (!access.canEdit) return
      if (!accepted.value) return
      for (const task of tasks.tasks)
        if (
          task.completed &&
          accepted.value.settings.selectedIds.includes(task.id) &&
          !accepted.value.completedIds.includes(task.id)
        )
          accepted.value.completedIds.push(task.id)
    },
    { flush: 'sync' },
  )
  function snapshot() {
    return { settings: settings.value, accepted: accepted.value }
  }
  function restore(value: unknown) {
    if (!access.canMutate) return false
    if (!value || typeof value !== 'object') return false
    const data = value as ReturnType<typeof snapshot>
    if (!validSettings(data.settings)) return false
    if (data.accepted && !validPlan(data.accepted)) return false
    settings.value = copy(data.settings)
    accepted.value = data.accepted ? copy(data.accepted) : undefined
    if (accepted.value) {
      accepted.value.completedIds = [
        ...new Set([
          ...accepted.value.completedIds,
          ...tasks.tasks
            .filter((t) => t.completed && accepted.value!.settings.selectedIds.includes(t.id))
            .map((t) => t.id),
        ]),
      ]
    }
    return true
  }
  return {
    updateSettings,
    settings,
    accepted,
    proposal,
    error,
    overrun,
    nextId,
    remaining,
    spent,
    generate,
    accept,
    reject,
    begin,
    snapshot,
    restore,
  }
})

function validPlan(p: SessionPlan) {
  if (
    !p ||
    typeof p.id !== 'string' ||
    typeof p.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
    !Number.isSafeInteger(p.createdAt) ||
    p.createdAt < 0 ||
    !validSettings(p.settings) ||
    !Array.isArray(p.completedIds) ||
    !p.completedIds.every((id) => typeof id === 'string' && p.settings.selectedIds.includes(id)) ||
    !Number.isInteger(p.offset) ||
    p.offset < 0 ||
    p.offset > p.settings.minutes ||
    (p.startedAt !== undefined && (!Number.isSafeInteger(p.startedAt) || p.startedAt < 0)) ||
    (p.activeId !== undefined && !p.settings.selectedIds.includes(p.activeId)) ||
    !p.baseline ||
    !p.expected ||
    Array.isArray(p.baseline) ||
    Array.isArray(p.expected) ||
    !Object.values(p.baseline).every((n) => Number.isFinite(n) && n >= 0) ||
    !Object.values(p.expected).every((n) => Number.isFinite(n) && n >= 0) ||
    !p.schedule ||
    !Array.isArray(p.schedule.slots) ||
    !Array.isArray(p.schedule.omitted)
  )
    return false
  let end = 0,
    breaks = 0
  const seen = new Set<string>()
  for (const slot of p.schedule.slots) {
    if (
      !slot ||
      !['task', 'break'].includes(slot.kind) ||
      typeof slot.title !== 'string' ||
      typeof slot.learned !== 'boolean' ||
      !Number.isInteger(slot.start) ||
      !Number.isInteger(slot.end) ||
      slot.start !== end ||
      slot.end <= slot.start ||
      slot.end > p.settings.minutes - p.offset
    )
      return false
    if (slot.kind === 'task') {
      if (!slot.taskId || !p.settings.selectedIds.includes(slot.taskId) || seen.has(slot.taskId))
        return false
      seen.add(slot.taskId)
    } else breaks += slot.end - slot.start
    end = slot.end
  }
  return (
    p.schedule.total === end &&
    p.schedule.breaks === breaks &&
    p.schedule.free === p.settings.minutes - p.offset - end &&
    p.schedule.omitted.every(
      (o) =>
        o &&
        typeof o.taskId === 'string' &&
        typeof o.title === 'string' &&
        typeof o.reason === 'string',
    )
  )
}
