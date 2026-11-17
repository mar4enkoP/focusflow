<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTimerPulse } from './composables/useTimerPulse'
import { useTaskDeletionStore } from './stores/taskDeletion'
const deletion = useTaskDeletionStore()
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
import { persistenceNotice } from './persistence'
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
const workspaceView = ref<'Planner' | 'Analytics'>()
useTimerPulse(timer, access)
function focus(id: string) {
  if (!access.canEdit) return
  timer.select(id)
  view.value = 'focus'
}
const store = useTasksStore()
const view = ref<'list' | 'form' | 'focus'>(access.canEdit && !store.tasks.length ? 'form' : 'list')
function startFocus() {
  const task = timer.task ?? store.tasks.find((task) => !task.completed)
  if (task) focus(task.id)
}
const editing = ref<Task>()
const welcome = ref(access.canEdit && !store.tasks.length)
const welcomeExpanded = ref(false)
const backdrop = ref<InstanceType<typeof FocusBackdrop>>()

let startupChecked = access.canEdit
watch(
  () => [access.canEdit, access.generation],
  () => {
    if (access.canEdit && !startupChecked) {
      welcome.value = !store.tasks.length
      startupChecked = true
    } else if (!access.canEdit) welcome.value = false
    editing.value = undefined
    workspaceOpen.value = false
    view.value = access.canEdit && !store.tasks.length ? 'form' : 'list'
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
  notice.value = editing.value ? 'Task updated.' : 'Task added.'
  void showList()
}
</script>
<template>
  <div
    class="app-shell"
    :class="{
      'is-focus': view === 'focus',
      'is-creating': view === 'form',
      'is-welcome-intro': welcome && !welcomeExpanded && view === 'form' && !workspaceOpen,
      'is-welcome-expanded': welcome && welcomeExpanded && view === 'form' && !workspaceOpen,
    }"
  >
    <Transition v-if="contentReady" name="theme" mode="out-in">
      <LegacyFocusBackdrop
        v-if="appearance.theme === '1'"
        :class="{ 'light-concealed': view === 'form' && !workspaceOpen }"
        :mode="workspaceOpen ? 'workspace' : view"
        :running="timer.isFocusing"
      />
    </Transition>
    <FocusBackdrop
      v-if="contentReady"
      :class="{ 'light-concealed': appearance.theme === '1' && (view !== 'form' || workspaceOpen) }"
      ref="backdrop"
      :mode="workspaceOpen ? 'workspace' : view"
      :compact="welcome && !welcomeExpanded"
      :running="timer.isFocusing"
      :workspace-view="workspaceView"
    />
    <header>
      <a
        class="brand"
        href="./"
        aria-label="FocusFlow home"
        @click.prevent="store.tasks.length ? showList() : create()"
        ><AppIcon name="brand" />FocusFlow</a
      >
      <WorkspaceTools
        anchored
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
      v-if="contentReady"
      ref="heading"
      :id="titleId"
      :text="screenTitle"
      :reduced-motion="reducedMotion"
      :relocate="welcome && welcomeExpanded && view === 'form' && !workspaceOpen"
    />
    <p v-if="showAccessNotice && accessNotice" class="access-notice" role="status">
      {{ accessNotice }}
    </p>
    <main
      :class="{ 'workspace-hidden': workspaceOpen }"
      :inert="workspaceOpen ? true : undefined"
      :aria-hidden="workspaceOpen || undefined"
      @transitionend.self="backdrop?.refresh()"
    >
      <Transition
        v-if="contentReady"
        name="scene"
        mode="out-in"
        :duration="reducedMotion ? 0 : { enter: 700, leave: 360 }"
        appear
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
            @save="save"
            @cancel="showList"
          />
        </section>
        <FocusTimer v-else-if="view === 'focus'" />
        <section v-else class="task-panel" aria-labelledby="list-title">
          <div class="panel-heading">
            <span class="task-count"
              >Tasks <span>{{ store.tasks.length }}</span></span
            >
            <button
              v-if="store.tasks.length"
              :disabled="!access.canEdit"
              aria-label="Add a task"
              title="Add a task"
              @click="create"
            >
              <AppIcon name="plus" /><span>Add task</span>
            </button>
          </div>
          <TaskList v-if="store.tasks.length" @edit="edit" @select="focus" />
          <div v-if="!store.tasks.length" class="empty">
            <AppIcon name="list" />
            <h2>{{ access.canEdit ? 'No tasks yet' : 'Workspace is read-only' }}</h2>
            <button class="primary" :disabled="!access.canEdit" @click="create">
              <AppIcon name="plus" />Create a task
            </button>
          </div>
          <button
            v-if="store.remaining"
            class="primary start-focus"
            :disabled="!access.canEdit"
            @click="startFocus"
          >
            Start Focus<AppIcon name="arrow" />
          </button>
        </section>
      </Transition>
    </main>
    <footer
      v-if="contentReady"
      :class="{ 'workspace-hidden': workspaceOpen }"
      :inert="workspaceOpen ? true : undefined"
      :aria-hidden="workspaceOpen || undefined"
    >
      <button
        v-if="view === 'focus' && timer.task"
        class="task-dock focus-dock"
        aria-label="Open task panel"
        title="Back to tasks"
        @click="showList"
      >
        <AppIcon :name="timer.task.category" />
        <span class="dock-content">
          <span class="dock-row">
            <span class="dock-title">{{ timer.task.title }}</span>
            <span class="dock-time"
              >{{ Math.round(timer.progress) }}% &middot;
              {{ Math.ceil(timer.remaining / 60000) }} min</span
            >
          </span>
          <progress :value="timer.progress" max="100" aria-label="Session progress" />
        </span></button
      ><button
        v-else-if="view !== 'list' && (view === 'focus' || store.tasks.length)"
        class="task-dock"
        aria-label="Back to tasks"
        title="Back to tasks"
        @click="showList"
      >
        <AppIcon name="list" /><span
          >{{ store.remaining }} {{ store.remaining === 1 ? 'task' : 'tasks' }} to do</span
        ><span class="dock-duration">{{ store.totalMinutes }} min</span><span>Tasks</span
        ><AppIcon name="arrow" />
      </button>
      <p v-if="view === 'list'">
        {{ store.remaining }} tasks to do &middot; {{ store.totalMinutes }} min planned
      </p>
      <p v-if="access.canEdit">{{ persistenceNotice }}</p>
    </footer>
    <span class="sr-only" role="status">{{ notice }}</span>
    <div v-if="deletion.title" class="undo-notice" role="status">
      Task deleted. <button type="button" @click="deletion.undo">Undo</button>
    </div>
  </div>
</template>
<style scoped lang="scss">
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
  transition: opacity 900ms ease;
}
:deep(.light-concealed) {
  opacity: 0;
}
.undo-notice {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 100;
  padding: 8px 12px;
  background: #18171a;
  border: 1px solid var(--border);
  border-radius: 12px;
}
.theme-enter-active,
.theme-leave-active {
  transition: opacity 180ms ease;
}
.theme-enter-from,
.theme-leave-to {
  opacity: 0;
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
  &.is-welcome-intro {
    // Center the visible introduction, rather than the hidden expanded form.
    --screen-title-top: max(calc(var(--app-header-height) + 24px), calc(50dvh - 106px));
    --screen-content-top: calc(var(--screen-title-top) + var(--screen-title-height) + 12px);
  }
  &.is-welcome-expanded > main {
    // Enable repositioning only after Enter, never while startup data hydrates.
    transition: top 650ms cubic-bezier(0.22, 1, 0.36, 1);
  }
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
