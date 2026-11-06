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
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: min(46vh, 420px);
  overflow-y: auto;
}
li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
  &:last-child {
    border-bottom: 0;
  }
}
input {
  accent-color: #ece5e1;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  cursor: pointer;
}
svg {
  flex-shrink: 0;
  color: var(--muted);
}
.task-info {
  min-width: 0;
  flex: 1;
}
.title {
  display: block;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.metadata {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-top: 3px;
}
.completed .title {
  text-decoration: line-through;
  color: var(--muted);
}
.row-actions {
  display: flex;
  gap: 2px;
}
.delete:hover {
  color: #ffae9a;
}
@media (max-width: 540px) {
  li {
    flex-wrap: wrap;
    gap: 10px;
  }
  .task-info {
    flex-basis: calc(100% - 70px);
  }
  .row-actions {
    margin-left: 48px;
  }
}
.select-task {
  height: auto;
  min-height: 28px;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0;
  justify-content: flex-start;
  overflow-wrap: anywhere;
}
.drag-handle {
  border: 0;
  padding: 0;
  width: 18px;
  flex-shrink: 0;
  background: transparent;
  color: #777278;
  cursor: grab;
  font-size: 20px;
}
.dragging {
  opacity: 0.4;
}
.target {
  box-shadow: inset 0 2px #dc8b73;
}
li {
  padding: 12px 0;
  min-height: 56px;
  gap: 14px;
}
.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.select-task {
  flex: 1;
  font-size: 12px;
}
.metadata {
  white-space: nowrap;
  font-size: 11px;
  margin: 0;
}
.row-actions {
  opacity: 0;
  transition: opacity 150ms;
}
li:hover .row-actions,
li:focus-within .row-actions {
  opacity: 1;
}
.completed .select-task {
  color: var(--muted);
  text-decoration: line-through;
}
@media (hover: none) {
  .row-actions {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .row-actions {
    transition: none;
  }
}
</style>
