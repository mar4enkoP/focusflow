<script setup lang="ts">
import { computed, nextTick, ref, onMounted, onUnmounted } from 'vue'
import { useTasksStore, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from '@/components/AppIcon.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskList from '@/components/TaskList.vue'
import FocusTimer from '@/components/FocusTimer.vue'
import FocusBackdrop from '@/components/FocusBackdrop.vue'
import { persistenceNotice } from './persistence'
import { useTimerStore } from '@/stores/timer'
const timer = useTimerStore()
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
  timer.select(id)
  view.value = 'focus'
}
const store = useTasksStore()
const view = ref<'list' | 'form' | 'focus'>(store.tasks.length ? 'list' : 'form')
function startFocus() {
  const task = timer.task ?? store.tasks.find((task) => !task.completed)
  if (task) focus(task.id)
}
const editing = ref<Task>()
const heading = ref<HTMLElement>()
const notice = ref('')
const title = computed(() =>
  editing.value
    ? 'A little change of plan'
    : store.tasks.length
      ? 'Add a task'
      : 'Add your first task',
)
function create() {
  editing.value = undefined
  view.value = 'form'
}
function edit(task: Task) {
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
    <FocusBackdrop v-if="view === 'focus'" />
    <header>
      <a
        class="brand"
        href="./"
        aria-label="FocusFlow home"
        @click.prevent="store.tasks.length ? showList() : create()"
        ><AppIcon name="brand" />FocusFlow</a
      ><span class="header-note">A little less noise. A little more focus.</span>
    </header>
    <main>
      <section v-if="view === 'form'" class="creation" aria-labelledby="creation-title">
        <div class="orb" aria-hidden="true"><AppIcon :name="editing ? 'edit' : 'plus'" /></div>
        <h1 id="creation-title">{{ title }}</h1>
        <p class="intro">Choose what you'd like to focus on,<br />and how much time to give it.</p>
        <TaskForm :key="editing?.id ?? 'new'" :task="editing" @save="save" @cancel="showList" />
      </section>
      <FocusTimer v-else-if="view === 'focus'" />
      <section v-else class="task-panel" aria-labelledby="list-title">
        <div class="panel-heading">
          <div>
            <h1 id="list-title" ref="heading" tabindex="-1">
              Tasks <span>{{ store.tasks.length }}</span>
            </h1>
          </div>
          <button
            v-if="store.tasks.length"
            aria-label="Add a task"
            title="Add a task"
            @click="create"
          >
            <AppIcon name="plus" />
          </button>
        </div>
        <TaskList v-if="store.tasks.length" @edit="edit" @select="focus" />
        <p v-if="timer.task" class="list-note">
          Switching pauses your timer. Deleting or completing its task ends that session.
        </p>
        <div v-if="!store.tasks.length" class="empty">
          <AppIcon name="list" />
          <h2>A clear space, a fresh start.</h2>
          <p>Add one small thing you'd like to get done.</p>
          <button class="primary" @click="create"><AppIcon name="plus" />Create a task</button>
        </div>
        <button v-if="store.remaining" class="primary start-focus" @click="startFocus">
          Start Focus<AppIcon name="arrow" />
        </button>
        <p v-if="store.tasks.length" class="list-note">
          {{
            store.remaining
              ? 'Small steps. In your own order.'
              : 'All done. Take a moment for yourself.'
          }}
        </p>
      </section>
    </main>
    <footer>
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
      <p>{{ persistenceNotice }}</p>
    </footer>
    <span class="sr-only" role="status">{{ notice }}</span>
  </div>
</template>
<style scoped lang="scss">
.app-shell {
  position: relative;
  isolation: isolate;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  &::before,
  &::after {
    content: '';
    position: absolute;
    z-index: -1;
    pointer-events: none;
    left: 50%;
    bottom: 112px;
    width: min(980px, 94vw);
    height: clamp(170px, 26vh, 290px);
    transform: translateX(-50%);
    border-radius: 50%;
    opacity: 0.28;
    mask-image:
      linear-gradient(transparent 25%, #000 78%),
      linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent);
    mask-composite: intersect;
  }
  &::before {
    background: radial-gradient(
      ellipse at 50% 0%,
      transparent 48%,
      #66101c55 70%,
      #dc241bd0 89%,
      #ff6a20 97%,
      #ffab55 99%,
      transparent 100%
    );
    box-shadow:
      inset 0 -12px 20px -13px #ffd097,
      inset 0 -28px 45px -20px #ff431a;
    filter: blur(2px);
  }
  &::after {
    background: radial-gradient(
      ellipse at 50% 0%,
      transparent 65%,
      #d8241844 85%,
      #ff4c255e 96%,
      transparent 100%
    );
    filter: blur(24px);
    transform: translateX(-50%) scale(1.08, 1.15);
  }
  &.is-focus::before,
  &.is-focus::after {
    display: none;
  }
  &.is-focus {
    main {
      padding-top: 0;
    }
    footer {
      padding-bottom: 16px;
      gap: 16px;
    }
    .header-note {
      display: none;
    }
  }
  &.is-creating {
    &::before {
      bottom: -170px;
      width: min(780px, 110vw);
      height: 340px;
      background: radial-gradient(ellipse, #b8291c42, #57121a1c 40%, transparent 70%);
      box-shadow: none;
      mask-image: none;
      filter: blur(28px);
      opacity: 1;
    }
    &::after,
    .header-note {
      display: none;
    }
  }
}
header {
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
.header-note {
  color: var(--muted);
  font-size: 11px;
}
main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px 64px;
}
.creation {
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
.task-panel {
  width: 520px;
  max-width: 100%;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #19171b65;
  backdrop-filter: blur(16px);
  box-shadow: 0 16px 60px #00000026;
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  h1 {
    font-size: 18px;
  }
  h1 span {
    color: var(--muted);
    font-size: 12px;
    margin-left: 8px;
  }
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
.list-note {
  color: var(--muted);
  font-size: 11px;
  margin: 20px 0 0;
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
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (max-width: 600px) {
  header {
    padding: 24px;
  }
  .header-note {
    display: none;
  }
  main {
    padding: 28px 16px 40px;
  }
  .task-panel {
    padding: 20px;
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
.start-focus {
  margin-top: 20px;
  width: 100%;
  justify-content: space-between;
  border-color: #eb77564d;
}
.task-panel {
  width: 480px;
  padding: 16px 20px;
  background: linear-gradient(120deg, #19171b80, #121113a6);
  border-color: #ffffff09;
  border-radius: 18px;
}
.panel-heading {
  margin-bottom: 8px;
  h1 {
    font-size: 16px;
    font-weight: 400;
  }
  > button {
    border: 0;
    background: transparent;
    width: 28px;
    padding: 0;
  }
}
.start-focus {
  position: relative;
  height: 40px;
  border-radius: 24px;
  border-color: #ffffff12;
  background: linear-gradient(110deg, #ffffff08, #ffffff04);
  justify-content: center;
  font-weight: 400;
  svg {
    position: absolute;
    right: 16px;
  }
}
</style>
