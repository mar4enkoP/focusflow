<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useTasksStore, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from '@/components/AppIcon.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskList from '@/components/TaskList.vue'
const store = useTasksStore()
const view = ref<'list' | 'form'>('form')
const editing = ref<Task>()
const heading = ref<HTMLElement>()
const notice = ref('')
const title = computed(() =>
  editing.value
    ? 'A little change of plan'
    : store.tasks.length
      ? 'Make room for what matters'
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
  <div class="app-shell">
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
        <p class="eyebrow">ONE THING AT A TIME</p>
        <h1 id="creation-title">{{ title }}</h1>
        <p class="intro">
          Give your attention a place to land.<br />Choose a task and a little time for it.
        </p>
        <TaskForm :key="editing?.id ?? 'new'" :task="editing" @save="save" @cancel="showList" />
      </section>
      <section v-else class="task-panel" aria-labelledby="list-title">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">YOUR SPACE TO BEGIN</p>
            <h1 id="list-title" ref="heading" tabindex="-1">
              Tasks <span>{{ store.tasks.length }}</span>
            </h1>
          </div>
          <button aria-label="Add a task" title="Add a task" class="icon-button" @click="create">
            <AppIcon name="plus" />
          </button>
        </div>
        <TaskList v-if="store.tasks.length" @edit="edit" />
        <div v-else class="empty">
          <AppIcon name="list" />
          <h2>A clear space, a fresh start.</h2>
          <p>Add one small thing you'd like to get done.</p>
          <button class="primary" @click="create"><AppIcon name="plus" />Create a task</button>
        </div>
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
      <button class="task-dock" @click="view === 'list' ? create() : showList()">
        <AppIcon name="list" /><span
          >{{ store.remaining }} {{ store.remaining === 1 ? 'task' : 'tasks' }} to do</span
        ><span class="dock-duration">{{ store.totalMinutes }} min</span
        ><AppIcon :name="view === 'list' ? 'plus' : 'arrow'" />
      </button>
      <p>Just for this visit · Tasks reset when you reload</p>
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
  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    pointer-events: none;
    width: min(850px, 95vw);
    height: 220px;
    left: 50%;
    bottom: -100px;
    transform: translateX(-50%);
    background: radial-gradient(ellipse, #ed482323 0%, #b72c1512 40%, transparent 70%);
    filter: blur(35px);
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
  width: 360px;
  max-width: 100%;
  text-align: center;
}
.orb {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin: 0 auto 28px;
  display: grid;
  place-items: center;
  background: radial-gradient(
    circle at 35% 65%,
    #0d0d10 45%,
    #682b2344 68%,
    #d24b3538 85%,
    #09090b
  );
  border: 1px solid #d466452e;
  box-shadow:
    6px -8px 28px #d6401d16,
    inset 0 0 14px #f3522910;
  svg {
    width: 22px;
    height: 22px;
  }
}
.eyebrow {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--muted);
  margin: 0 0 12px;
}
h1 {
  font-size: 22px;
  font-weight: 450;
  letter-spacing: -0.6px;
  margin: 0;
}
.intro {
  color: var(--muted);
  line-height: 1.8;
  font-size: 12px;
  margin: 14px 0 32px;
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
</style>
