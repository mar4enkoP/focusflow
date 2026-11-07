<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { categories, priorities, validateTask, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ task?: Task }>()
const emit = defineEmits<{ save: [input: TaskInput]; cancel: [] }>()
const input = reactive<TaskInput>({
  title: props.task?.title ?? '',
  duration: props.task?.duration ?? 25,
  category: props.task?.category ?? 'Work',
  priority: props.task?.priority ?? 'Medium',
})
const errors = ref({ title: '', duration: '', category: '', priority: '' })
const titleField = ref<HTMLInputElement>()
const durationField = ref<HTMLInputElement>()
const categoryOpen = ref(false)
const categoryRoot = ref<HTMLElement>()
const categoryButton = ref<HTMLButtonElement>()
const categoryIndex = ref(0)
function closeCategory() {
  categoryOpen.value = false
}
function chooseCategory(index: number) {
  input.category = categories[index]!
  closeCategory()
  categoryButton.value?.focus()
}
async function openCategory() {
  categoryOpen.value = true
  categoryIndex.value = categories.indexOf(input.category)
  await nextTick()
  categoryRoot.value
    ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    [categoryIndex.value]?.focus()
}
function categoryKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeCategory()
    categoryButton.value?.focus()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  categoryIndex.value =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? categories.length - 1
        : (categoryIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + categories.length) %
          categories.length
  categoryRoot.value
    ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    [categoryIndex.value]?.focus()
}
function outsideCategory(event: PointerEvent) {
  if (!categoryRoot.value?.contains(event.target as Node)) closeCategory()
}
onMounted(() => document.addEventListener('pointerdown', outsideCategory))
onUnmounted(() => document.removeEventListener('pointerdown', outsideCategory))
onMounted(() => titleField.value?.focus())
async function submit() {
  errors.value = validateTask(input)
  if (Object.values(errors.value).some(Boolean)) {
    await nextTick()
    if (errors.value.title) titleField.value?.focus()
    else if (errors.value.duration) durationField.value?.focus()
    return
  }
  emit('save', { ...input })
}
</script>
<template>
  <form novalidate @submit.prevent="submit" @keydown.esc.prevent="emit('cancel')">
    <label for="task-title">Task title</label>
    <div class="field">
      <AppIcon :name="input.category" /><input
        id="task-title"
        ref="titleField"
        v-model="input.title"
        placeholder="Task name"
        :aria-invalid="!!errors.title"
        :aria-describedby="errors.title ? 'title-error' : undefined"
      />
    </div>
    <p v-if="errors.title" id="title-error" class="error">{{ errors.title }}</p>
    <div class="details">
      <div>
        <label for="task-duration">Estimated minutes</label>
        <div class="field duration-field">
          <AppIcon name="clock" /><input
            id="task-duration"
            ref="durationField"
            v-model.number="input.duration"
            type="number"
            min="1"
            max="1440"
            step="1"
            :aria-invalid="!!errors.duration"
            :aria-describedby="errors.duration ? 'duration-error' : undefined"
          /><span class="duration-unit" aria-hidden="true">min</span>
        </div>
      </div>
      <div>
        <label for="task-category">Category</label>
        <div
          ref="categoryRoot"
          class="category-picker"
          @focusout="!categoryRoot?.contains($event.relatedTarget as Node) && closeCategory()"
        >
          <button
            id="task-category"
            ref="categoryButton"
            type="button"
            class="field category-trigger"
            aria-label="Category"
            aria-haspopup="listbox"
            :aria-expanded="categoryOpen"
            aria-controls="category-options"
            @click="categoryOpen ? closeCategory() : openCategory()"
            @keydown.down.prevent="openCategory()"
            @keydown.up.prevent="openCategory()"
          >
            <AppIcon :name="input.category" /><span>{{ input.category }}</span
            ><AppIcon name="down" />
          </button>
          <Transition name="panel">
            <div
              v-if="categoryOpen"
              id="category-options"
              class="category-options"
              role="listbox"
              aria-label="Task category"
              @keydown="categoryKey"
            >
              <button
                v-for="(category, index) in categories"
                :key="category"
                type="button"
                role="option"
                :aria-selected="input.category === category"
                :tabindex="categoryIndex === index ? 0 : -1"
                @click="chooseCategory(index)"
              >
                <AppIcon :name="category" /><span>{{ category }}</span>
                <span v-if="input.category === category" class="selected-mark" aria-hidden="true"
                  >&#10003;</span
                >
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <p v-if="errors.duration" id="duration-error" class="error">{{ errors.duration }}</p>
    <p v-if="errors.category" class="error">{{ errors.category }}</p>
    <fieldset class="priority-picker">
      <legend>Priority</legend>
      <div class="priority-options">
        <label v-for="priority in priorities" :key="priority">
          <input v-model="input.priority" type="radio" name="priority" :value="priority" />
          <span>{{ priority }}</span>
        </label>
      </div>
    </fieldset>
    <p v-if="errors.priority" class="error">{{ errors.priority }}</p>
    <div class="actions">
      <button type="submit" class="primary">
        {{ task ? 'Save changes' : 'Add task' }}<AppIcon name="arrow" />
      </button>
      <button type="button" class="quiet" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
<style scoped lang="scss">
form {
  text-align: left;
}
.priority-picker {
  min-width: 0;
  border: 0;
  padding: 0;
  margin: 16px 0 0;
  legend {
    color: var(--muted);
    font-size: 11px;
    margin-bottom: 8px;
  }
}
.priority-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--glass-edge);
  border-radius: var(--control-radius);
  background: var(--glass-fill);
  backdrop-filter: blur(var(--surface-blur));
  box-shadow: var(--glass-highlight);
  label {
    position: relative;
    margin: 0;
    cursor: pointer;
  }
  span {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    border: 1px solid transparent;
    border-radius: 7px;
    color: var(--muted);
    font-size: 12px;
    transition:
      background var(--motion-fast),
      border-color var(--motion-fast),
      color var(--motion-fast);
  }
  label:hover span {
    background: #ffffff08;
    color: var(--text);
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    &:checked + span {
      color: var(--text);
      border-color: #d990703d;
      background: linear-gradient(115deg, #e67d4826, #c44d3820 58%, #ffffff09);
      box-shadow: inset 0 1px 0 #ffffff08;
    }
    &:focus-visible + span {
      outline: 1px solid var(--focus-ring);
      outline-offset: 1px;
    }
  }
  @media (pointer: coarse) {
    span {
      min-height: 44px;
    }
  }
  @media (forced-colors: active) {
    input:checked + span {
      border-color: Highlight;
      color: Highlight;
    }
  }
}
label {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin: 0 0 8px 2px;
}
.field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 34px;
  border: 1px solid var(--glass-edge);
  border-radius: var(--control-radius);
  background: var(--glass-fill);
  backdrop-filter: blur(var(--surface-blur));
  box-shadow: var(--glass-highlight);
  color: var(--muted);
  transition:
    border-color var(--motion-fast),
    box-shadow 200ms ease,
    background var(--motion-fast);
  > svg {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    color: var(--text);
  }
}
input,
select {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  outline: none;
  &:focus-visible {
    outline: none;
  }
}
.duration-field {
  gap: 8px;
  input {
    width: 4ch;
    appearance: textfield;
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      appearance: none;
      margin: 0;
    }
  }
}
.duration-unit {
  margin-left: -6px;
  color: var(--text);
}
select {
  appearance: none;
  padding-right: 18px;
  cursor: pointer;
}
.field > .select-chevron {
  position: absolute;
  right: 14px;
  width: 14px;
  height: 14px;
  pointer-events: none;
}
.field:hover {
  background: var(--glass-hover);
}
.field:focus-within {
  border-color: var(--glass-edge);
  background: var(--glass-hover);
  box-shadow: var(--glass-focus-light);
  outline: none;
}
.category-trigger:focus-visible {
  outline: 1px solid var(--focus-ring);
  outline-offset: 2px;
}
@media (forced-colors: active) {
  .field:focus-within {
    outline: 1px solid Highlight;
  }
}
input::placeholder {
  color: #929097;
}
select option {
  background: #19181b;
}
.details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  .primary {
    position: relative;
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
    padding-inline: 16px;
    svg {
      position: absolute;
      right: 16px;
    }
  }
  .quiet {
    align-self: center;
    border-color: transparent;
    color: var(--muted);
    font-size: 12px;
  }
}
.error {
  color: #ffae9a;
  font-size: 12px;
  margin: 8px 4px 0;
}
@media (max-width: 320px) {
  .details {
    grid-template-columns: 1fr;
  }
}
.category-picker {
  position: relative;
}
.category-trigger {
  width: 100%;
  font-weight: 400;
  text-align: left;
  span {
    flex: 1;
  }
  > svg:last-child {
    width: 14px;
    height: 14px;
    color: var(--muted);
  }
}
.category-options {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 10;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  background: var(--surface);
  box-shadow: var(--surface-shadow);
  backdrop-filter: blur(var(--surface-blur));
  button {
    width: 100%;
    gap: 10px;
    height: 34px;
    padding: 0 9px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    font-size: 12px;
    font-weight: 400;
    justify-content: flex-start;
    svg {
      width: 16px;
      height: 16px;
      color: var(--muted);
    }
    &:hover,
    &:focus-visible {
      background: #ffffff0c;
    }
    &[aria-selected='true'] {
      background: #ffffff10;
    }
  }
}
.selected-mark {
  margin-left: auto;
  color: var(--text);
}
</style>
