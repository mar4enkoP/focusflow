<script setup lang="ts">
import { t } from '@/i18n'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTimerPulse } from './composables/useTimerPulse'
import DeletionToast from './components/DeletionToast.vue'
import { useTasksStore, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from '@/components/AppIcon.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskList from '@/components/TaskList.vue'
import FocusTimer from '@/components/FocusTimer.vue'
import LegacyFocusBackdrop from '@/components/LegacyFocusBackdrop.vue'
import { useAppearanceStore } from '@/stores/appearance'
import FocusBackdrop from '@/components/FocusBackdrop.vue'
import WorkspaceTools from '@/components/WorkspaceTools.vue'
import ScreenHeading from '@/components/ScreenHeading.vue'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { persistenceNotice, STORAGE_KEY } from './persistence'
import { useTimerStore } from '@/stores/timer'
const appearance = useAppearanceStore()
const access = useWorkspaceAccessStore()
const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)')
const reducedMotion = ref(motionPreference?.matches ?? false)
function syncMotionPreference() {
  reducedMotion.value = motionPreference?.matches ?? false
}
onMounted(() => motionPreference?.addEventListener('change', syncMotionPreference))
onUnmounted(() => motionPreference?.removeEventListener('change', syncMotionPreference))
const accessNotice = computed(() => {
  if (access.canEdit) return ''
  if (access.status === 'unsupported')
    return 'Read-only — safe editing requires a browser with Web Locks support and a secure connection.'
  if (access.status === 'error') return 'Read-only — ' + access.error
  if (access.ownsLock) return 'Loading the latest workspace…'
  if (access.status === 'waiting')
    return 'Read-only — waiting for workspace ownership. Close the other FocusFlow tab to edit here.'
  return 'Read-only — workspace editing is unavailable.'
})
// Acquiring the lock and hydrating normally take only a moment. Keep that
// transient state quiet; genuine errors remain immediately visible.
const showAccessNotice = ref(false)
watch(
  [accessNotice, () => access.status],
  ([message, status], _, onCleanup) => {
    showAccessNotice.value = !!message && !['idle', 'waiting', 'owner'].includes(status)
    if (!message || showAccessNotice.value) return
    const timeout = setTimeout(() => {
      showAccessNotice.value = true
    }, 400)
    onCleanup(() => clearTimeout(timeout))
  },
  { immediate: true },
)
const timer = useTimerStore()
// Do not mount a guessed list/form before persistence has selected the first
// screen. A genuine read-only state can still show its disabled workspace.
const contentReady = ref(false)
watch(
  [() => access.canEdit, showAccessNotice, () => access.status],
  ([editable, noticeVisible, status]) => {
    if (editable || (noticeVisible && !['idle', 'owner'].includes(status))) {
      contentReady.value = true
    }
  },
  { immediate: true },
)
const workspaceOpen = ref(false)
const workspaceView = ref<'Planner' | 'Analytics' | 'Appearance' | 'Data'>()
useTimerPulse(timer, access)
function focus(id: string) {
  if (!access.canEdit) return
  showFocusHint.value = false
  timer.select(id)
  view.value = 'focus'
}
const store = useTasksStore()
// The first successful save creates a workspace snapshot. Deleting the last
// task keeps that snapshot, while resetting the workspace removes it.
function needsWelcome() {
  if (!access.canEdit || store.tasks.length) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === null
  } catch {
    return true
  }
}
const welcome = ref(needsWelcome())
const showFocusHint = ref(false)
const view = ref<'list' | 'form' | 'focus'>(welcome.value ? 'form' : 'list')
function startFocus() {
  const task = timer.task ?? store.tasks.find((task) => !task.completed)
  if (task) focus(task.id)
}
const editing = ref<Task>()

const listArrival = ref(false)
let arrivalTimer: ReturnType<typeof setTimeout> | undefined
watch(
  contentReady,
  (ready) => {
    if (!ready || !store.tasks.length || reducedMotion.value) return
    listArrival.value = true
    arrivalTimer = setTimeout(
      () => {
        listArrival.value = false
      },
      appearance.theme === '1' ? 2600 : 1400,
    )
  },
  { immediate: true },
)
watch([view, workspaceOpen], () => {
  listArrival.value = false
  clearTimeout(arrivalTimer)
})
onUnmounted(() => clearTimeout(arrivalTimer))
const welcomeExpanded = ref(false)
const welcomeRevealed = ref(false)
const backdrop = ref<InstanceType<typeof FocusBackdrop>>()

let startupChecked = access.canEdit
watch(
  () => [access.canEdit, access.generation],
  () => {
    if (access.canEdit && !startupChecked) {
      welcome.value = needsWelcome()
      startupChecked = true
    } else if (!access.canEdit) welcome.value = false
    editing.value = undefined
    workspaceOpen.value = false
    view.value = welcome.value ? 'form' : 'list'
  },
)
const heading = ref<InstanceType<typeof ScreenHeading>>()
const screenTitle = computed(() => {
  if (workspaceOpen.value) return workspaceView.value ?? 'Planner'
  if (view.value === 'list') return 'Your tasks'
  if (view.value === 'focus') return 'Time to focus.'
  if (welcome.value)
    return welcomeExpanded.value
      ? 'Set up your first task.'
      : 'A little focus.\nStart with one task.'
  return editing.value ? 'Refine your task.' : 'Make time for a task.'
})
const titleId = computed(() =>
  workspaceOpen.value
    ? 'tool-title'
    : view.value === 'form'
      ? 'creation-title'
      : view.value === 'list'
        ? 'list-title'
        : 'focus-title',
)
const taskForm = ref<InstanceType<typeof TaskForm>>()
function expandWelcome() {
  heading.value?.holdPosition()
  welcomeExpanded.value = true
}
function panelEntering(element: Element) {
  if (element.parentElement) element.parentElement.scrollTop = 0
  backdrop.value?.refresh()
}
function panelEntered(element: Element) {
  backdrop.value?.refresh()
  // Do not steal focus if the user has already selected a visible control.
  if (element.contains(document.activeElement)) return
  if (view.value === 'list') heading.value?.focus()
  else if (view.value === 'form') taskForm.value?.focusTitle()
}
function panelLeaving(element: Element) {
  element.setAttribute('inert', '')
  if (element.classList.contains('creation')) taskForm.value?.closeMenus()
}
const notice = ref('')
function create() {
  if (!access.canEdit) return
  editing.value = undefined
  view.value = 'form'
}
function edit(task: Task) {
  if (!access.canEdit) return
  editing.value = task
  view.value = 'form'
}
function showList() {
  // First-task creation has no destination to dismiss to. Keep its draft and
  // reveal state intact until a task has actually been saved.
  if (view.value === 'form' && welcome.value && !store.tasks.length && access.canEdit) return
  welcome.value = false
  editing.value = undefined
  view.value = 'list'
}
function save(input: TaskInput) {
  if (!store.save(input, editing.value?.id)) return
  if (welcome.value) showFocusHint.value = true
  notice.value = editing.value ? 'Task updated.' : 'Task added.'
  void showList()
}
</script>
<template>
  <div
    class="app-shell"
    :class="{
      'list-arrival': listArrival,
      'ember-arrival': listArrival && appearance.theme === '1',
      'is-focus': view === 'focus',
      'is-creating': view === 'form',
      'welcome-scene': !contentReady || (welcome && view === 'form'),
      'is-welcome-intro': welcome && !welcomeExpanded && view === 'form' && !workspaceOpen,
      'is-welcome-expanded': welcome && welcomeExpanded && view === 'form' && !workspaceOpen,
    }"
  >
    <LegacyFocusBackdrop
      :arriving="listArrival"
      v-if="contentReady"
      :workspace-view="workspaceView"
      :class="{
        'light-concealed':
          appearance.theme !== '1' || (welcome && view === 'form' && !workspaceOpen),
      }"
      :mode="workspaceOpen ? 'workspace' : view"
      :running="timer.isFocusing"
    />
    <FocusBackdrop
      v-if="contentReady"
      :class="{
        'light-concealed':
          appearance.theme === '1' && (!welcome || view !== 'form' || workspaceOpen),
      }"
      ref="backdrop"
      :mode="workspaceOpen ? 'workspace' : view"
      :welcome="welcome"
      :compact="welcome && !welcomeExpanded"
      :running="timer.isFocusing"
      :workspace-view="workspaceView"
    />
    <header>
      <a
        class="brand"
        href="./"
        :aria-label="t('FocusFlow home')"
        @click.prevent="store.tasks.length ? showList() : create()"
        ><AppIcon name="brand" />{{ t('FocusFlow') }}</a
      >
      <WorkspaceTools
        :theme-locked="welcome"
        :key="access.generation + String(access.canEdit)"
        @focus="focus"
        @active="
          (active, panel) => {
            workspaceOpen = active
            workspaceView = panel
          }
        "
        @tasks="showList"
      />
    </header>
    <ScreenHeading
      v-if="contentReady && !workspaceOpen && view !== 'focus' && (!welcome || welcomeRevealed)"
      ref="heading"
      :id="titleId"
      :text="t(screenTitle)"
      :initial-delay="listArrival ? (appearance.theme === '1' ? 1000 : 120) : 0"
      :initial-duration="listArrival ? (appearance.theme === '1' ? 1320 : 1000) : 400"
      :reduced-motion="reducedMotion"
      :relocate="welcome && welcomeExpanded && view === 'form' && !workspaceOpen"
    />
    <p v-if="showAccessNotice && accessNotice" class="access-notice" role="status">
      {{ t(accessNotice) }}
    </p>
    <main
      :class="{ 'workspace-hidden': workspaceOpen, 'task-list-screen': view === 'list' }"
      :inert="workspaceOpen ? true : undefined"
      :aria-hidden="workspaceOpen || undefined"
      @transitionend.self="backdrop?.refresh()"
    >
      <Transition
        v-if="contentReady"
        :name="welcome ? 'panel' : 'scene'"
        mode="out-in"
        :duration="reducedMotion ? 0 : { enter: 700, leave: 360 }"
        :appear="false"
        @after-enter="panelEntered"
        @enter="panelEntering"
        @before-leave="panelLeaving"
      >
        <section v-if="view === 'form'" class="creation" aria-labelledby="creation-title">
          <TaskForm
            ref="taskForm"
            :key="editing?.id ?? 'new'"
            :task="editing"
            :welcome="welcome"
            @expand="expandWelcome"
            @revealed="welcomeRevealed = true"
            @save="save"
            @cancel="showList"
          />
        </section>
        <FocusTimer v-else-if="view === 'focus'" />
        <section v-else class="task-panel" aria-labelledby="list-title">
          <div class="panel-heading">
            <span class="task-count"
              >{{ t('Tasks ') }}<span>{{ t(store.tasks.length) }}</span></span
            >
            <button
              v-if="store.tasks.length"
              :disabled="!access.canEdit"
              :aria-label="t('Add a task')"
              :title="t('Add a task')"
              @click="create"
            >
              <AppIcon name="plus" /><span>{{ t('Add task') }}</span>
            </button>
          </div>
          <TaskList v-if="store.tasks.length" @edit="edit" @select="focus" />
          <div v-if="!store.tasks.length" class="empty">
            <AppIcon name="list" />
            <h2>{{ t(access.canEdit ? 'No tasks yet' : 'Workspace is read-only') }}</h2>
            <button class="primary" :disabled="!access.canEdit" @click="create">
              <AppIcon name="plus" />{{ t('Create a task ') }}
            </button>
          </div>
          <button
            v-if="store.remaining"
            class="primary start-focus"
            :disabled="!access.canEdit"
            @click="startFocus"
          >
            {{ t(' Start Focus') }}<AppIcon name="arrow" />
          </button>
          <p v-if="showFocusHint && store.remaining" class="focus-hint">
            <span>{{ t('Ready to begin? Press') }}</span>
            <span class="hint-action">{{ t('Start Focus') }}<AppIcon name="arrow" /></span>
          </p>
        </section>
      </Transition>
    </main>
    <footer
      :class="{ 'workspace-hidden': workspaceOpen }"
      :inert="workspaceOpen ? true : undefined"
      :aria-hidden="workspaceOpen || undefined"
    >
      <button
        v-if="view === 'focus' && timer.task"
        class="task-dock focus-dock"
        :aria-label="t('Open task panel')"
        :title="t('Back to tasks')"
        @click="showList"
      >
        <AppIcon :name="timer.task.category" />
        <span class="dock-content">
          <span class="dock-row">
            <span class="dock-title">{{ timer.task.title }}</span>
            <span class="dock-time"
              >{{ t(Math.round(timer.progress)) }}% &middot;
              {{ t(Math.ceil(timer.remaining / 60000)) }}{{ t(' min') }}</span
            >
          </span>
          <progress :value="timer.progress" max="100" :aria-label="t('Session progress')" />
        </span></button
      ><button
        v-else-if="view !== 'list' && (view === 'focus' || store.tasks.length)"
        class="task-dock"
        :aria-label="t('Back to tasks')"
        :title="t('Back to tasks')"
        @click="showList"
      >
        <AppIcon name="list" /><span
          >{{ t(store.remaining) }} {{ t(store.remaining === 1 ? 'task' : 'tasks')
          }}{{ t(' to do') }}</span
        ><span class="dock-duration">{{ t(store.totalMinutes) }}{{ t(' min') }}</span
        ><span>{{ t('Tasks') }}</span
        ><AppIcon name="arrow" />
      </button>
      <p v-if="contentReady && view === 'list'" class="task-summary">
        {{ t(store.remaining) }}{{ t(' tasks to do · ') }}{{ t(store.totalMinutes)
        }}{{ t(' min planned ') }}
      </p>
      <p v-if="access.canEdit || !showAccessNotice">{{ t(persistenceNotice) }}</p>
    </footer>
    <span class="sr-only" role="status">{{ t(notice) }}</span>
    <DeletionToast />
  </div>
</template>
<style scoped lang="scss">
@media (prefers-reduced-motion: no-preference) {
  .list-arrival .task-panel {
    animation: list-arrive 1040ms cubic-bezier(0.22, 1, 0.36, 1) 360ms backwards;
  }
  .ember-arrival .task-panel {
    animation-duration: 1800ms;
    animation-delay: 800ms;
  }
  .ember-arrival .task-summary {
    animation-duration: 1700ms !important;
    animation-delay: 900ms !important;
  }
  .list-arrival .task-summary {
    animation: summary-arrive 980ms cubic-bezier(0.22, 1, 0.36, 1) 420ms backwards;
  }
}
@keyframes list-arrive {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes summary-arrive {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-shell.welcome-scene {
  --welcome-header-height: var(--app-header-height);
  display: flex;
  flex-direction: column;

  > main {
    position: relative;
    top: auto;
    bottom: auto;
    flex: 1;
    margin-bottom: 40px;
    min-height: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: clamp(12px, 3vh, 32px) 24px;
    overflow-y: auto;
    scrollbar-width: thin;
    > .creation {
      margin-block: auto;
      flex-shrink: 0;
    }
  }
  &.is-welcome-expanded > main {
    padding-top: max(12px, calc(var(--screen-content-top) - var(--welcome-header-height) - 70px));
    > .creation {
      margin-block: 0;
    }
  }
}

@media (max-width: 600px) {
  .app-shell.welcome-scene {
    > main {
      padding-inline: 16px;
    }
  }
}

@media (max-height: 560px) {
  .app-shell.welcome-scene {
    &.is-welcome-intro > main {
      padding-block: 8px;
    }
  }
}
// The title is outside this transition. Move the body as one piece, and fade
// glass surfaces directly so their backdrop sampling stays attached to the light.
@media (prefers-reduced-motion: no-preference) {
  .scene-enter-active {
    transition:
      transform var(--screen-enter) cubic-bezier(0.22, 1, 0.36, 1),
      opacity var(--screen-enter) ease;
  }
  .scene-leave-active {
    transition:
      transform var(--screen-leave) cubic-bezier(0.55, 0, 0.8, 0.4),
      opacity var(--screen-leave) ease;
  }
  .scene-enter-from {
    transform: translateY(28px);
  }
  .scene-leave-to {
    transform: translateY(36px);
  }
  .scene-enter-from:not(.creation),
  .scene-leave-to:not(.creation) {
    opacity: 0;
  }
  .creation.scene-enter-active :deep(.task-form:not(.welcome-form) [data-form-part]) {
    animation: surface-arrive var(--screen-enter) ease both;
  }
  .creation.scene-leave-active :deep([data-form-part]) {
    animation: surface-depart var(--screen-leave) ease both !important;
  }
}
@keyframes surface-arrive {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes surface-depart {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
:deep(.focus-backdrop) {
  transition: opacity 250ms ease 950ms;
}
:deep(.light-emission) {
  transform: scale(1, 1);
  transition: transform 1450ms cubic-bezier(0.22, 1, 0.36, 1) 950ms;
}
:deep(.light-concealed .light-emission) {
  transform: scale(0.04, 0.015);
  transition: transform 950ms cubic-bezier(0.45, 0, 0.55, 1);
}
:deep(.light-concealed) {
  opacity: 0;
  transition: opacity 150ms ease 800ms;
}
:deep(.radiant-emission),
:deep(.light-concealed .radiant-emission) {
  transform: none;
}
:deep(.radiant-atmosphere) {
  opacity: 1;
  transform: scaleY(1);
  transition:
    transform 1450ms cubic-bezier(0.22, 1, 0.36, 1) 950ms,
    opacity 1200ms ease 950ms;
}
:deep(.light-concealed .radiant-atmosphere) {
  opacity: 0;
  transform: scaleY(0.08);
  // Keep the volume aligned with its curved rim while it is visible. Prepare
  // the compressed ignition pose only after the outgoing glow has gone dark.
  transition:
    transform 0s linear 850ms,
    opacity 750ms ease-in;
}
:deep(.radiant-core) {
  opacity: 1;
  transition: opacity 450ms ease 950ms;
}
:deep(.light-concealed .radiant-core) {
  opacity: 0;
  transition: opacity 350ms ease 600ms;
}
@media (prefers-reduced-motion: reduce) {
  :deep(.radiant-atmosphere),
  :deep(.radiant-core),
  :deep(.light-concealed .radiant-atmosphere),
  :deep(.light-concealed .radiant-core) {
    transition: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  :deep(.focus-backdrop),
  :deep(.light-emission),
  :deep(.light-concealed .light-emission),
  :deep(.light-concealed) {
    transition: none;
  }
}
.access-notice {
  // Never participate in the flex layout: showing or clearing a warning must
  // not move the task form, timer, or its light source.
  position: absolute;
  top: 72px;
  left: 24px;
  right: 24px;
  z-index: 2;
  margin: 0;
  color: var(--muted);
  text-align: center;
  font-size: 12px;
}

.workspace-hidden {
  visibility: hidden;
  pointer-events: none;
  transition: visibility 0s var(--screen-leave);
}
.app-shell {
  position: relative;
  isolation: isolate;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--app-header-height);
  padding: 0 40px;
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text);
  font-size: 14px;
  letter-spacing: -0.3px;
}
main {
  position: absolute;
  top: var(--screen-content-top);
  bottom: var(--screen-bottom);
  left: 0;
  right: 0;
  isolation: isolate;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  padding: 0 24px 24px;
}
.is-creating > main {
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
}
.focus-hint {
  margin: 16px 0 0;
  min-height: 25px;
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  line-height: 17px;
  .hint-action {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 0 8px;
    height: 25px;
    border-radius: 5px;
    border: 1px solid #ffffff40;
    background: #ffffff06;
    color: var(--text);
    font: 11px/1 system-ui;
    box-shadow: inset 0 -2px 0 #ffffff0a;
    svg {
      width: 13px;
      height: 13px;
    }
  }
}
main.task-list-screen {
  overflow: hidden;
}
.task-list-screen > .task-panel {
  display: flex;
  flex-direction: column;
  max-height: 100%;
  min-height: 0;
  > .panel-heading,
  > .start-focus {
    flex-shrink: 0;
  }
  :deep(.tasks) {
    min-height: 0;
    flex-shrink: 1;
    overscroll-behavior: contain;
  }
}
.creation,
.task-panel {
  position: relative;
  isolation: isolate;
  width: 356px;
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
}
main > section {
  transition:
    transform var(--screen-enter) var(--motion-ease),
    opacity var(--screen-enter) ease;
}
main.workspace-hidden > section {
  transform: translateY(36px);
  transition-duration: var(--screen-leave);
}
main.workspace-hidden > section:not(.creation) {
  opacity: 0;
}
main :deep([data-form-part]) {
  transition: opacity var(--screen-enter) ease;
}
main.workspace-hidden :deep([data-form-part]) {
  opacity: 0;
  transition-duration: var(--screen-leave);
}
.empty {
  text-align: center;
  padding: 28px 0;
  color: var(--muted);
  h2 {
    font-size: 16px;
    font-weight: 450;
    color: var(--text);
  }
  p {
    font-size: 12px;
    margin-bottom: 24px;
  }
}
footer {
  position: absolute;
  bottom: 16px;
  left: 0;
  right: 0;
  padding: 0 24px;
  transition: opacity var(--screen-leave) ease;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12px;
  p {
    color: var(--muted);
    font-size: 10px;
    margin: 0;
  }
}
.task-dock {
  width: 340px;
  max-width: 100%;
  height: 38px;
  gap: 12px;
  backdrop-filter: blur(12px);
  padding-inline: 16px;
  font-size: 11px;
  background: #ffffff04;
  .dock-duration {
    margin-left: auto;
    color: var(--muted);
  }
}
@media (max-width: 600px) {
  header {
    padding-inline: 24px;
  }
  main {
    padding-inline: 16px;
  }
}
footer.workspace-hidden {
  opacity: 0;
}
.focus-dock {
  width: 380px;
  height: 56px;
  padding: 0 18px;
  gap: 16px;
  border-radius: 999px;
  border-color: #ffffff14;
  background: linear-gradient(115deg, #28202070, #181316a3);
  backdrop-filter: blur(18px);
  box-shadow:
    inset 0 1px 0 #ffffff05,
    0 8px 24px #00000018;

  > svg {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
  }
}
.dock-content {
  flex: 1;
  min-width: 0;
}
.dock-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.dock-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  font-size: 12px;
}
.dock-time {
  flex-shrink: 0;
  color: #c3b7b9;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
progress {
  appearance: none;
  border: 0;
  border-radius: 2px;
  overflow: hidden;
  display: block;
  width: 100%;
  height: 2px;
  margin-top: 8px;
  background: #ffffff17;

  &::-webkit-progress-bar {
    background: #ffffff17;
    border-radius: 2px;
  }
  &::-webkit-progress-value {
    background: linear-gradient(90deg, #ff7143, #f34b35);
    border-radius: 2px;
  }
  &::-moz-progress-bar {
    background: linear-gradient(90deg, #ff7143, #f34b35);
    border-radius: 2px;
  }
}

.task-panel {
  // Preserve the list's sampling boundary during its opacity transition.
  will-change: opacity;
  width: 420px;
  max-width: 100%;
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 12px;
  .task-count {
    color: var(--muted);
    font-size: 11px;
    span {
      margin-left: 8px;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
  }
  > button {
    height: 28px;
    padding: 0 10px;
    font-size: 11px;
    border-radius: var(--control-radius);
    svg {
      width: 14px;
      height: 14px;
    }
  }
}
.start-focus {
  position: relative;
  margin-top: 20px;
  width: 100%;
  height: 36px;
  border-radius: var(--control-radius);
  border-color: #ffffff24;
  background: var(--glass-fill);
  backdrop-filter: blur(var(--surface-blur));
  box-shadow: var(--glass-highlight);
  &:hover {
    background: var(--glass-hover);
  }
  justify-content: center;
  svg {
    position: absolute;
    right: 16px;
  }
}
</style>
