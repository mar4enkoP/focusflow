<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted, onUnmounted } from 'vue'
import { useTasksStore, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from '@/components/AppIcon.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskList from '@/components/TaskList.vue'
import FocusTimer from '@/components/FocusTimer.vue'
import FocusBackdrop from '@/components/FocusBackdrop.vue'
import WorkspaceTools from '@/components/WorkspaceTools.vue'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { persistenceNotice } from './persistence'
import { useTimerStore } from '@/stores/timer'
const access = useWorkspaceAccessStore()
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
const timer = useTimerStore()
const workspaceOpen = ref(false)
let pulse: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  pulse = setInterval(timer.sync, 250)
  document.addEventListener('visibilitychange', timer.sync)
})
onUnmounted(() => {
  clearInterval(pulse)
  document.removeEventListener('visibilitychange', timer.sync)
})
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
watch(
  () => [access.canEdit, access.generation],
  () => {
    editing.value = undefined
    workspaceOpen.value = false
    view.value = access.canEdit && !store.tasks.length ? 'form' : 'list'
  },
)
const heading = ref<HTMLElement>()
const notice = ref('')
const title = computed(() =>
  editing.value ? 'Edit task' : store.tasks.length ? 'Add a task' : 'Add your first task',
)
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
async function showList() {
  editing.value = undefined
  view.value = 'list'
  await nextTick()
  heading.value?.focus()
}
function save(input: TaskInput) {
  if (!store.save(input, editing.value?.id)) return
  notice.value = editing.value ? 'Task updated.' : 'Task added.'
  void showList()
}
</script>
<template>
  <div class="app-shell" :class="{ 'is-focus': view === 'focus', 'is-creating': view === 'form' }">
    <FocusBackdrop :mode="workspaceOpen ? 'workspace' : view" :running="timer.isFocusing" />
    <header>
      <a
        class="brand"
        href="./"
        aria-label="FocusFlow home"
        @click.prevent="store.tasks.length ? showList() : create()"
        ><AppIcon name="brand" />FocusFlow</a
      >
      <WorkspaceTools
        :key="access.generation + String(access.canEdit)"
        @focus="focus"
        @active="workspaceOpen = $event"
        @tasks="showList"
      />
    </header>
    <p v-if="accessNotice" class="access-notice" role="status">{{ accessNotice }}</p>
    <main
      :class="{ 'workspace-hidden': workspaceOpen }"
      :inert="workspaceOpen ? true : undefined"
      :aria-hidden="workspaceOpen || undefined"
    >
      <Transition
        name="panel"
        mode="out-in"
        appear
        @after-enter="view === 'list' && heading?.focus()"
        @before-leave="(element) => element.setAttribute('inert', '')"
      >
        <section v-if="view === 'form'" class="creation" aria-labelledby="creation-title">
          <div class="orb" aria-hidden="true"><AppIcon :name="editing ? 'edit' : 'plus'" /></div>
          <h1 id="creation-title">{{ title }}</h1>
          <p class="intro">
            Choose what you'd like to focus on,<br />and how much time to give it.
          </p>
          <TaskForm :key="editing?.id ?? 'new'" :task="editing" @save="save" @cancel="showList" />
        </section>
        <FocusTimer v-else-if="view === 'focus'" />
        <section v-else class="task-panel" aria-labelledby="list-title">
          <div class="orb" aria-hidden="true"><AppIcon name="list" /></div>
          <h1 id="list-title" ref="heading" tabindex="-1">Your tasks</h1>
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
  </div>
</template>
<style scoped lang="scss">
.access-notice {
  margin: 0 24px;
  color: var(--muted);
  text-align: center;
  font-size: 12px;
}

.workspace-hidden {
  // Descendants (including checked-task marks) can override visibility, but
  // cannot escape the opacity of their containing screen.
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.app-shell {
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  &.is-focus {
    main {
      padding-top: 0;
    }
    footer {
      padding-bottom: 16px;
      gap: 16px;
    }
  }
}

header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px 40px;
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
  position: relative;
  isolation: isolate;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 64px;
  // Keep the light mounted outside the transitioning panels so it never restarts
  // or changes its bounds when one panel leaves and the next one enters.
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 60%;
    width: min(620px, 96vw);
    height: min(460px, 70svh);
    transform: translate(-50%, -35%);
    z-index: -1;
    pointer-events: none;
    mask-image: radial-gradient(ellipse 50% 50% at center, #000 20%, transparent 100%);
    background:
      radial-gradient(ellipse at 30% 65%, rgb(var(--ambient-warm) / 10%), transparent 65%),
      radial-gradient(ellipse at 80% 45%, rgb(var(--ambient-rose) / 5%), transparent 60%);
    transition: opacity 200ms ease;
  }
}
.is-focus main::before {
  opacity: 0;
}
.creation,
.task-panel {
  position: relative;
  isolation: isolate;
  // Preserve the same backdrop sampling boundary during and after opacity transitions.
  will-change: opacity;
  width: 356px;
  max-width: 100%;
  text-align: center;
  h1 {
    font-size: 20px;
    line-height: 26px;
    font-weight: 400;
    letter-spacing: -0.4px;
  }
}
.orb {
  position: relative;
  isolation: isolate;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 47% 54%, #0c0b0e 53%, #171116 62%, transparent 69%),
    conic-gradient(
      from 210deg,
      #191a2a,
      #29141c 26%,
      #a82e29 42%,
      #ff6548 54%,
      #d83e2d 66%,
      #43171e 80%,
      #15131d
    );
  box-shadow:
    inset 0 0 0 1px #ffffff06,
    -5px 8px 18px #252b4b18;
  &::before {
    content: '';
    position: absolute;
    inset: -5px;
    z-index: -1;
    border-radius: inherit;
    background: conic-gradient(from 210deg, transparent 30%, #f4472c99 55%, transparent 80%);
    mask-image: radial-gradient(circle, transparent 49%, #000 65%, transparent 74%);
    filter: blur(8px);
  }
  &::after {
    content: '';
    position: absolute;
    inset: 9px;
    border: 1px solid #ffffff04;
    border-radius: inherit;
    box-shadow: inset 0 0 8px #0008;
    pointer-events: none;
  }
  svg {
    width: 24px;
    height: 24px;
  }
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--muted);
  margin: 0 0 12px;
}
h1 {
  font-size: 26px;
  font-weight: 450;
  letter-spacing: -0.6px;
  margin: 0;
}
.intro {
  color: var(--muted);
  line-height: 18px;
  font-size: 13px;
  margin: 8px 0 24px;
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
  padding: 0 24px 24px;
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
    padding: 24px;
  }
  main {
    padding: 28px 16px 40px;
  }
  h1 {
    font-size: 20px;
  }
}
@media (max-height: 700px) {
  main {
    padding-top: 24px;
    padding-bottom: 32px;
  }
  .orb {
    margin-bottom: 20px;
    width: 48px;
    height: 48px;
  }
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
  width: 420px;
  max-width: 100%;
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0 12px;
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
