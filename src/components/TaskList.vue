<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useTasksStore, type Task } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
const store = useTasksStore()
const dragging = ref<string>()
const target = ref<{ id: string; position: 'before' | 'after' }>()
const announcement = ref('')
const list = ref<HTMLOListElement>()
function endDrag() {
  dragging.value = undefined
  target.value = undefined
}
function dragOver(event: DragEvent, id: string) {
  if (!dragging.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  target.value = {
    id,
    position: event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after',
  }
}
async function announce(id: string, restoreFocus = false) {
  const index = store.tasks.findIndex((task) => task.id === id)
  const task = store.tasks[index]
  if (!task) return
  announcement.value = `${task.title}, position ${index + 1} of ${store.tasks.length}.`
  await nextTick()
  if (restoreFocus) {
    const handle = list.value?.querySelectorAll<HTMLButtonElement>('.drag-handle')[index]
    handle?.focus()
    handle?.scrollIntoView?.({ block: 'nearest' })
  }
}
function move(id: string, direction: -1 | 1) {
  store.move(id, direction)
  void announce(id, true)
}
function drop(event: DragEvent, id: string) {
  if (!dragging.value) return
  dragOver(event, id)
  const movedId = dragging.value
  if (target.value && store.reorder(movedId, target.value.id, target.value.position)) {
    void announce(movedId)
  }
  endDrag()
}
function drag(event: DragEvent, id: string) {
  dragging.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}
defineEmits<{ edit: [task: Task]; select: [id: string] }>()
</script>
<template>
  <p class="reorder-status" role="status" aria-live="polite">{{ announcement }}</p>
  <ol
    ref="list"
    class="tasks"
    aria-label="Task list"
    @dragleave="
      !($event.currentTarget as HTMLElement).contains($event.relatedTarget as Node) &&
      (target = undefined)
    "
    @keydown.esc="endDrag"
  >
    <li
      v-for="task in store.tasks"
      :key="task.id"
      :class="{
        completed: task.completed,
        dragging: dragging === task.id,
        'drop-before': target?.id === task.id && target.position === 'before',
        'drop-after': target?.id === task.id && target.position === 'after',
      }"
      :data-task-id="task.id"
      @dragover="dragOver($event, task.id)"
      @drop.prevent="drop($event, task.id)"
      @dragend="endDrag"
    >
      <button
        class="drag-handle"
        draggable="true"
        @dragstart="drag($event, task.id)"
        :aria-label="`Reorder ${task.title}; use arrow keys`"
        title="Drag to reorder; Arrow keys to move"
        @keydown.up.prevent="move(task.id, -1)"
        @keydown.down.prevent="move(task.id, 1)"
      >
        <svg viewBox="0 0 16 20" width="16" height="20" aria-hidden="true">
          <g fill="currentColor">
            <circle cx="5" cy="5" r="1" />
            <circle cx="11" cy="5" r="1" />
            <circle cx="5" cy="10" r="1" />
            <circle cx="11" cy="10" r="1" />
            <circle cx="5" cy="15" r="1" />
            <circle cx="11" cy="15" r="1" />
          </g>
        </svg>
      </button>
      <input
        type="checkbox"
        :checked="task.completed"
        :aria-label="`Complete ${task.title}`"
        @change="store.toggle(task.id)"
      />
      <AppIcon :name="task.category" />
      <div class="task-info">
        <button
          class="select-task"
          :disabled="task.completed"
          :aria-label="`Focus on ${task.title}`"
          @click="$emit('select', task.id)"
        >
          {{ task.title }}</button
        ><span class="metadata"
          >{{ task.duration }} min<span v-if="task.completed"> &middot; Completed</span
          ><span :aria-label="`${task.priority} priority`">
            &middot; {{ task.priority }}</span
          ></span
        >
      </div>
      <div class="row-actions">
        <button
          class="icon-button"
          :aria-label="`Edit ${task.title}`"
          title="Edit task"
          @click="$emit('edit', task)"
        >
          <AppIcon name="edit" />
        </button>
        <button
          class="icon-button delete"
          :aria-label="`Delete ${task.title}`"
          title="Delete task"
          @click="store.remove(task.id)"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </li>
  </ol>
</template>
<style scoped lang="scss">
.tasks {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 -6px;
  padding: 4px 6px;
  list-style: none;
  max-height: min(34vh, 300px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #ffffff30 transparent;
  overscroll-behavior: contain;
}
li {
  position: relative;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 18px 16px 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  min-height: 58px;
  border: 1px solid var(--glass-edge);
  border-radius: var(--control-radius);
  background: var(--glass-fill);
  backdrop-filter: blur(var(--surface-blur));
  box-shadow: var(--glass-highlight);
  text-align: left;
  transition:
    background var(--motion-fast),
    box-shadow 200ms ease,
    border-color var(--motion-fast);
  &:hover,
  &:focus-within {
    background: var(--glass-hover);
    box-shadow: var(--glass-focus-light);
  }
}
input {
  appearance: none;
  display: grid;
  place-content: center;
  border: 1px solid var(--focus-ring);
  border-radius: 5px;
  background: #ffffff04;
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  &::after {
    content: '';
    width: 7px;
    height: 4px;
    border-left: 1px solid var(--text);
    border-bottom: 1px solid var(--text);
    transform: translateY(-1px) rotate(-45deg);
    visibility: hidden;
  }
  &:checked {
    background: #ffffff18;
    &::after {
      visibility: visible;
    }
  }
  @media (forced-colors: active) {
    appearance: auto;
    &::after {
      display: none;
    }
  }
}
svg {
  flex-shrink: 0;
  color: var(--muted);
}
.task-info {
  min-width: 0;
}
.select-task {
  display: block;
  width: 100%;
  height: auto;
  min-height: 24px;
  text-align: left;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
  font-size: 13px;
  &:hover:not(:disabled) {
    background: transparent;
    color: #fff;
  }
}
.metadata {
  display: block;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.completed .select-task {
  opacity: 1;
  color: var(--muted);
  text-decoration: line-through;
}
.row-actions {
  display: flex;
  gap: 4px;
}
.delete:hover {
  color: #ffae9a;
}
.drag-handle {
  border: 0;
  padding: 0;
  width: 18px;
  background: transparent;
  color: var(--muted);
  cursor: grab;
}
.dragging {
  opacity: 0.4;
}
.drop-before::before,
.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--focus-ring);
  pointer-events: none;
}
.drop-before::before {
  top: -5px;
}
.drop-after::after {
  bottom: -5px;
}
.reorder-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (max-width: 420px) {
  li {
    gap: 8px;
  }
  .row-actions {
    flex-direction: column;
    gap: 0;
  }
}
</style>
