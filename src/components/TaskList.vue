<script setup lang="ts">
import { useTasksStore, type Task } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
const store = useTasksStore()
defineEmits<{ edit: [task: Task] }>()
</script>
<template>
  <ol class="tasks" aria-label="Task list">
    <li
      v-for="(task, index) in store.tasks"
      :key="task.id"
      :class="{ completed: task.completed }"
      :data-task-id="task.id"
    >
      <input
        type="checkbox"
        :checked="task.completed"
        :aria-label="`Complete ${task.title}`"
        @change="store.toggle(task.id)"
      />
      <AppIcon :name="task.category" />
      <div class="task-info">
        <span class="title">{{ task.title }}</span
        ><span class="metadata"
          >{{ task.category }} · {{ task.duration }} min<span v-if="task.completed">
            · Completed</span
          ></span
        >
      </div>
      <div class="row-actions">
        <button
          class="icon-button"
          :aria-label="`Move ${task.title} up`"
          title="Move up"
          :disabled="index === 0"
          @click="store.move(task.id, -1)"
        >
          <AppIcon name="up" />
        </button>
        <button
          class="icon-button"
          :aria-label="`Move ${task.title} down`"
          title="Move down"
          :disabled="index === store.tasks.length - 1"
          @click="store.move(task.id, 1)"
        >
          <AppIcon name="down" />
        </button>
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
</style>
