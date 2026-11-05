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
        placeholder="What would you like to work on?"
        :aria-invalid="!!errors.title"
        :aria-describedby="errors.title ? 'title-error' : undefined"
      />
    </div>
    <p v-if="errors.title" id="title-error" class="error">{{ errors.title }}</p>
    <div class="details">
      <div>
        <label for="task-duration">Estimated minutes</label>
        <div class="field">
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
          />
        </div>
      </div>
      <div>
        <label for="task-category">Category</label>
        <div class="field">
          <AppIcon :name="input.category" /><select id="task-category" v-model="input.category">
            <option v-for="category in categories" :key="category">{{ category }}</option>
          </select>
        </div>
      </div>
    </div>
    <p v-if="errors.duration" id="duration-error" class="error">{{ errors.duration }}</p>
    <p v-if="errors.category" class="error">{{ errors.category }}</p>
    <div class="actions">
      <button type="button" class="quiet" @click="emit('cancel')">Cancel</button
      ><button type="submit" class="primary">
        {{ task ? 'Save changes' : 'Add task' }}<AppIcon name="arrow" />
      </button>
    </div>
  </form>
</template>
<style scoped lang="scss">
form {
  text-align: left;
}
label {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin: 0 0 8px 4px;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: #ffffff04;
  color: var(--muted);
  &:focus-within {
    border-color: #b1a7a0;
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
  outline: none;
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
  margin-top: 18px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 24px;
  .primary {
    flex: 1;
    justify-content: space-between;
    padding-inline: 16px;
  }
}
.error {
  color: #ffae9a;
  font-size: 12px;
  margin: 8px 4px 0;
}
@media (max-width: 380px) {
  .details {
    grid-template-columns: 1fr;
  }
}
</style>
