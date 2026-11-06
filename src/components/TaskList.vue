<script setup lang="ts">
import { ref } from 'vue'
import { useTasksStore, type Task } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
const store = useTasksStore()
const dragging = ref<string>()
const target = ref<string>()
function endDrag() {
  dragging.value = undefined
  target.value = undefined
}
function drop(id: string) {
  const from = store.tasks.findIndex((t) => t.id === dragging.value)
  const to = store.tasks.findIndex((t) => t.id === id)
  if (from >= 0 && to >= 0) {
    while (store.tasks.findIndex((t) => t.id === dragging.value) !== to)
      store.move(dragging.value!, from < to ? 1 : -1)
  }
  dragging.value = undefined
  target.value = undefined
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
  <ol class="tasks" aria-label="Task list">
    <li
      v-for="task in store.tasks"
      :key="task.id"
      :class="{
        completed: task.completed,
        dragging: dragging === task.id,
        target: target === task.id,
      }"
      :data-task-id="task.id"
      draggable="true"
      @dragstart="drag($event, task.id)"
      @dragover.prevent="target = task.id"
      @drop.prevent="drop(task.id)"
      @dragend="endDrag"
    >
      <button
        class="drag-handle"
        :aria-label="`Reorder ${task.title}; use arrow keys`"
        title="Drag to reorder; Arrow keys to move"
        @keydown.up.prevent="store.move(task.id, -1)"
        @keydown.down.prevent="store.move(task.id, 1)"
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
          >{{ task.duration }} min<span v-if="task.completed"> &middot; Completed</span></span
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
  margin: 0 -6px;
  padding: 4px 6px;
  list-style: none;
  max-height: min(46vh, 420px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #ffffff30 transparent;
  overscroll-behavior: contain;
}
li {
  display: grid;
  grid-template-columns: 18px 16px 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  min-height: 64px;
  border-bottom: 1px solid var(--border);
  transition: background var(--motion-fast);
  &:last-child {
    border-bottom: 0;
  }
  &:hover,
  &:focus-within {
    background: var(--surface-hover);
  }
}
input {
  accent-color: #ece5e1;
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
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
.target {
  box-shadow: inset 0 2px var(--focus-ring);
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
