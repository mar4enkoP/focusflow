<script setup lang="ts">
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { computed, nextTick, ref, useId } from 'vue'
import { useTaskMemoryStore, type TaskMemoryEntry } from '@/stores/taskMemory'
import { memoryNotice } from '@/persistence'
import type { Category } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
import FloatingMenu from './FloatingMenu.vue'

const access = useWorkspaceAccessStore()
const title = defineModel<string>({ required: true })
const props = defineProps<{
  category: Category
  error: string
  minimal?: boolean
  hintId?: string
}>()
const emit = defineEmits<{ reuse: [entry: TaskMemoryEntry] }>()
const memory = useTaskMemoryStore()
const field = ref<HTMLInputElement>()
const root = ref<HTMLElement>()
const opened = ref(false)
const managing = ref(false)
const selected = ref(-1)
const listId = useId()
const suggestions = computed(() => (title.value.trim() ? memory.matches(title.value) : []))
const visible = computed(
  () => !props.minimal && opened.value && !managing.value && suggestions.value.length > 0,
)
const allEntries = computed(() => memory.matches(''))
function close() {
  opened.value = false
  managing.value = false
  selected.value = -1
}
function typed() {
  managing.value = false
  opened.value = true
  selected.value = -1
}
function toggleManagement() {
  managing.value = !managing.value
  opened.value = false
}
async function forget(title: string) {
  memory.forget(title)
  await nextTick()
  root.value?.querySelector<HTMLButtonElement>('.memory-toggle')?.focus()
}
function choose(entry: TaskMemoryEntry) {
  emit('reuse', entry)
  close()
  field.value?.focus({ preventScroll: true })
  // focus can reopen suggestions; explicit selection should leave the form quiet.
  opened.value = false
}
async function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && (visible.value || managing.value)) {
    event.preventDefault()
    event.stopPropagation()
    close()
    field.value?.focus({ preventScroll: true })
    opened.value = false
    return
  }
  if (event.target !== field.value) return
  if (event.key === 'Tab') {
    close()
    return
  }
  if (!props.minimal && ['ArrowDown', 'ArrowUp'].includes(event.key) && suggestions.value.length) {
    event.preventDefault()
    managing.value = false
    opened.value = true
    selected.value =
      selected.value < 0
        ? event.key === 'ArrowDown'
          ? 0
          : suggestions.value.length - 1
        : (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.value.length) %
          suggestions.value.length
    await nextTick()
    document.getElementById(`${listId}-${selected.value}`)?.scrollIntoView?.({ block: 'nearest' })
  } else if (event.key === 'Enter' && visible.value && selected.value >= 0) {
    event.preventDefault()
    const entry = suggestions.value[selected.value]
    if (entry) choose(entry)
  }
}
defineExpose({
  focus: ({ suggestions = true } = {}) => {
    field.value?.focus({ preventScroll: true })
    if (!suggestions) close()
  },
  close,
})
</script>

<template>
  <div
    ref="root"
    class="title-memory"
    @keydown="keydown"
    @focusout="!root?.contains($event.relatedTarget as Node) && close()"
  >
    <div class="title-label" :class="{ 'minimal-label': minimal }">
      <label for="task-title" data-form-part>Task title</label>
      <button
        :disabled="!access.canEdit"
        v-if="!minimal && (memory.entries.length || memoryNotice || managing)"
        type="button"
        class="memory-toggle"
        data-form-part
        :aria-expanded="managing"
        :aria-controls="`${listId}-management`"
        @click="toggleManagement"
      >
        Remembered tasks
      </button>
    </div>
    <div class="title-anchor">
      <div class="title-field" data-form-part>
        <AppIcon :name="category" />
        <input
          :disabled="!access.canEdit"
          id="task-title"
          ref="field"
          v-model="title"
          placeholder="Task name"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="visible"
          :aria-controls="listId"
          :aria-activedescendant="visible && selected >= 0 ? `${listId}-${selected}` : undefined"
          :aria-invalid="!!error"
          :aria-describedby="minimal ? hintId : error ? 'title-error' : hintId"
          @input="typed"
          @focus="opened = true"
        />
      </div>
      <Transition name="panel">
        <FloatingMenu v-if="visible">
          <div
            :id="listId"
            class="memory-menu"
            role="listbox"
            aria-label="Remembered task suggestions"
          >
            <div
              v-for="(entry, index) in suggestions"
              :id="`${listId}-${index}`"
              :key="entry.title"
              :title="entry.title"
              class="suggestion"
              role="option"
              :aria-selected="selected === index"
              @pointerdown.prevent
              @click="choose(entry)"
              @pointermove="selected = index"
            >
              <AppIcon :name="entry.category" /><span class="entry-title">{{ entry.title }}</span>
              <span class="duration">{{ entry.duration }} min</span>
            </div>
          </div>
        </FloatingMenu>
      </Transition>
      <Transition name="panel">
        <FloatingMenu v-if="managing">
          <div
            :id="`${listId}-management`"
            class="memory-menu"
            role="region"
            aria-label="Remembered tasks"
          >
            <p class="memory-help">Forget a suggestion without changing your tasks.</p>
            <div v-for="entry in allEntries" :key="entry.title" class="memory-row">
              <AppIcon :name="entry.category" /><span class="entry-title">{{ entry.title }}</span>
              <button
                :disabled="!access.canEdit"
                type="button"
                class="icon-button"
                :aria-label="`Forget ${entry.title}`"
                title="Forget suggestion"
                @click="forget(entry.title)"
              >
                <AppIcon name="trash" />
              </button>
            </div>
            <p v-if="!allEntries.length" class="memory-help">No remembered tasks.</p>
          </div>
        </FloatingMenu>
      </Transition>
    </div>
    <p v-if="memoryNotice" class="memory-help" role="status" data-form-part>{{ memoryNotice }}</p>
    <p v-if="error && !minimal" id="title-error" class="error" data-form-part>{{ error }}</p>
  </div>
</template>

<style scoped lang="scss">
.minimal-label {
  opacity: 0;
  pointer-events: none;
}
.title-anchor {
  position: relative;
}
.title-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
label,
.memory-toggle {
  color: var(--muted);
  font-size: 11px;
}
.memory-toggle {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--glass-edge);
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(var(--surface-blur));
  backdrop-filter: blur(var(--surface-blur));
  box-shadow: var(--glass-highlight);
  border-radius: 7px;
  &:hover {
    background: var(--glass-hover);
    color: var(--text);
  }
}
.title-field {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--glass-edge);
  border-radius: var(--control-radius);
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(var(--surface-blur));
  backdrop-filter: blur(var(--surface-blur));
  box-shadow: var(--glass-highlight);
  transition:
    box-shadow 200ms ease,
    background var(--motion-fast);
  &:hover {
    background: var(--glass-hover);
  }
  &:focus-within {
    background: var(--glass-hover);
    box-shadow: var(--glass-focus-light);
  }
  > svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }
  input {
    width: 100%;
    min-width: 0;
    background: transparent;
    border: 0;
    outline: none;
    color: var(--text);
    font: inherit;
  }
  input::placeholder {
    color: #929097;
  }
}
.memory-menu {
  padding: 4px;
  max-height: 168px; // Five 32px rows plus padding; the popup owns the border.
  overflow-y: auto;
  border-radius: inherit;
  scrollbar-width: thin;
  overscroll-behavior: contain;
}
.suggestion,
.memory-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 8px;
  border-radius: 7px;
  font-size: 12px;
  > svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--muted);
  }
}
.suggestion {
  height: 32px;
  cursor: pointer;
  transition: background var(--motion-fast);
  .entry-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &:hover,
  &[aria-selected='true'] {
    background: var(--glass-hover);
  }
}
.entry-title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.duration {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.memory-help {
  margin: 6px 8px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}
.error {
  color: #ffae9a;
  font-size: 12px;
  margin: 8px 4px 0;
}
@media (forced-colors: active) {
  .title-field:focus-within {
    outline: 1px solid Highlight;
  }
  .suggestion[aria-selected='true'] {
    outline: 1px solid Highlight;
  }
}
</style>
