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
defineProps<{
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
const composing = ref(false)
const atEnd = ref(true)
const scrollLeft = ref(0)
const listId = useId()
const completion = computed(() => {
  if (!opened.value || managing.value || composing.value || !atEnd.value || !title.value.trim())
    return
  return memory
    .matches(title.value)
    .find(
      (entry) =>
        entry.title.length > title.value.length &&
        entry.title.toLocaleLowerCase().startsWith(title.value.toLocaleLowerCase()),
    )
})
function syncCaret() {
  const input = field.value
  atEnd.value =
    !!input &&
    input.selectionStart === input.value.length &&
    input.selectionEnd === input.value.length
  scrollLeft.value = input?.scrollLeft ?? 0
}
const allEntries = computed(() => memory.matches(''))
function close() {
  opened.value = false
  managing.value = false
  syncCaret()
}
function focusInput() {
  opened.value = true
  syncCaret()
}
function compositionEnd() {
  composing.value = false
  syncCaret()
}
function typed() {
  managing.value = false
  opened.value = true
  syncCaret()
}
function toggleManagement() {
  managing.value = !managing.value
  opened.value = false
}
async function forget(title: string) {
  // Move focus before removing its button, so focusout stays inside the menu.
  root.value?.querySelector<HTMLButtonElement>('.memory-toggle')?.focus({ preventScroll: true })
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
function keydown(event: KeyboardEvent) {
  if (event.isComposing || composing.value) return
  if (event.key === 'Escape' && (completion.value || managing.value)) {
    event.preventDefault()
    event.stopPropagation()
    close()
    field.value?.focus({ preventScroll: true })
    opened.value = false
    return
  }
  if (event.target !== field.value) return
  if (event.key === 'Tab' && !event.shiftKey && completion.value && access.canEdit) {
    event.preventDefault()
    choose(completion.value)
    return
  }
  if (event.key === 'Tab' || event.key === 'Enter') close()
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
    </div>
    <div class="title-anchor">
      <div class="title-field" data-form-part>
        <AppIcon :name="category" />
        <div class="title-completion">
          <span v-if="completion" class="ghost-title" aria-hidden="true"
            ><span :style="{ transform: `translateX(${-scrollLeft}px)` }"
              ><span class="ghost-prefix">{{ title }}</span
              >{{ completion.title.slice(title.length) }}</span
            ></span
          >
          <input
            :disabled="!access.canEdit"
            id="task-title"
            ref="field"
            v-model="title"
            placeholder="Task name"
            autocomplete="off"
            aria-autocomplete="inline"
            :aria-invalid="!!error"
            :aria-describedby="
              [
                minimal ? hintId : error ? 'title-error' : hintId,
                completion ? `${listId}-completion` : undefined,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            "
            @input="typed"
            @focus="focusInput"
            @select="syncCaret"
            @click="syncCaret"
            @keyup="syncCaret"
            @scroll="syncCaret"
            @compositionstart="composing = true"
            @compositionend="compositionEnd"
          />
        </div>
        <button
          :disabled="!access.canEdit"
          v-if="!minimal && (memory.entries.length || memoryNotice || managing)"
          type="button"
          class="memory-toggle"
          aria-label="Remembered tasks"
          title="Remembered tasks"
          data-form-part
          :aria-expanded="managing"
          :aria-controls="`${listId}-management`"
          @click="toggleManagement"
        >
          <AppIcon name="clock" />
        </button>
        <span v-if="completion" :id="`${listId}-completion`" class="sr-only"
          >Press Tab to complete: {{ completion.title }}</span
        >
      </div>
      <Transition name="panel">
        <FloatingMenu v-if="managing">
          <div
            :id="`${listId}-management`"
            class="memory-menu"
            role="region"
            aria-label="Remembered tasks"
          >
            <p class="memory-help">Choose a remembered task, or forget it.</p>
            <div v-for="entry in allEntries" :key="entry.title" class="memory-row">
              <AppIcon :name="entry.category" /><button
                type="button"
                class="entry-title memory-choice"
                :disabled="!access.canEdit"
                @click="choose(entry)"
              >
                {{ entry.title }}
              </button>
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
label {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.memory-toggle {
  height: 24px;
  width: 24px;
  flex-shrink: 0;
  padding: 0;
  margin-right: -8px;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--muted);
  &:hover:not(:disabled) {
    background: #ffffff08;
    color: var(--text);
  }
}

.title-completion {
  position: relative;
  flex: 1;
  min-width: 0;
}
.ghost-title {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  overflow: hidden;
  pointer-events: none;
  color: var(--muted);
  opacity: 0.65;
  white-space: pre;
  > span {
    display: block;
  }
}
.ghost-prefix {
  visibility: hidden;
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
    padding: 0;
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
.memory-row {
  position: relative;
  transition:
    background 160ms ease,
    box-shadow 160ms ease;
  &:hover {
    background: var(--glass-hover);
    box-shadow: inset 0 0 0 1px var(--glass-edge);
  }
  &:has(.memory-choice:focus-visible) {
    outline: 1px solid var(--focus-ring);
    outline-offset: -1px;
  }
  > .icon-button {
    position: relative;
    z-index: 1;
  }
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

.entry-title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.memory-choice {
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 7px;
  }
  &:hover:not(:disabled) {
    background: transparent;
    box-shadow: none;
  }
  &:focus-visible {
    outline: none;
  }
  height: auto;
  text-align: left;
  justify-content: flex-start;
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
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
  .memory-row:has(.memory-choice:focus-visible) {
    outline: 1px solid Highlight;
  }
}
</style>
