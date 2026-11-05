<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from 'vue'
import { categories, validateTask, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
const props = defineProps<{ task?: Task }>()
const emit = defineEmits<{ save: [input: TaskInput]; cancel: [] }>()
const input = reactive<TaskInput>({
  title: props.task?.title ?? '',
  duration: props.task?.duration ?? 25,
  category: props.task?.category ?? 'Work',
})
const errors = ref({ title: '', duration: '', category: '' })
const titleField = ref<HTMLInputElement>()
const durationField = ref<HTMLInputElement>()
const keyboardNavigation = ref(false)
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
  <form
    novalidate
    :class="{ 'keyboard-navigation': keyboardNavigation }"
    @pointerdown="keyboardNavigation = false"
    @keydown.tab="keyboardNavigation = true"
    @submit.prevent="submit"
    @keydown.esc.prevent="emit('cancel')"
  >
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
        <div class="field">
          <AppIcon :name="input.category === 'Work' ? 'layers' : input.category" /><select
            id="task-category"
            v-model="input.category"
          >
            <option v-for="category in categories" :key="category">{{ category }}</option></select
          ><AppIcon class="select-chevron" name="down" />
        </div>
      </div>
    </div>
    <p v-if="errors.duration" id="duration-error" class="error">{{ errors.duration }}</p>
    <p v-if="errors.category" class="error">{{ errors.category }}</p>
    <div class="actions">
      <button type="submit" class="primary">
        {{ task ? 'Save changes' : 'Add task' }}<AppIcon name="arrow" />
      </button>
      <button v-if="task" type="button" class="quiet" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>
<style scoped lang="scss">
form {
  text-align: left;
}
label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  height: 34px;
  border: 1px solid #ffffff0b;
  border-radius: 18px;
  background: linear-gradient(110deg, #ffffff07, #ffffff04);
  color: var(--muted);
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
.keyboard-navigation .field:focus-within {
  outline: 1px solid var(--muted);
  outline-offset: 3px;
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
  gap: 14px;
  margin-top: 10px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  .primary {
    position: relative;
    width: 100%;
    height: 42px;
    border-radius: 24px;
    border-color: #ffffff0d;
    background: linear-gradient(110deg, #ffffff07, #ffffff04);
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
</style>
