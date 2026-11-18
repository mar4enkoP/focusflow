<script setup lang="ts">
import { t } from '@/i18n'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { categories, priorities, validateTask, type Task, type TaskInput } from '@/stores/tasks'
import AppIcon from './AppIcon.vue'
import FloatingMenu from './FloatingMenu.vue'
import TaskTitleInput from './TaskTitleInput.vue'
import WelcomeIntro from './WelcomeIntro.vue'
import { normalizeTitle, useTaskMemoryStore, type TaskMemoryEntry } from '@/stores/taskMemory'
import { useFocusHistoryStore } from '@/stores/focusHistory'
import { estimateDuration } from '@/estimation'
const access = useWorkspaceAccessStore()
const props = defineProps<{ task?: Task; welcome?: boolean }>()
const compact = ref(!!props.welcome && !props.task)
const revealing = ref(false)
let revealTimer: ReturnType<typeof setTimeout> | undefined
let welcomeErrorTimer: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => {
  clearTimeout(revealTimer)
  clearTimeout(welcomeErrorTimer)
})
function dismissWelcomeError() {
  clearTimeout(welcomeErrorTimer)
  welcomeErrorTimer = undefined
  errors.value.title = ''
}
async function finishReveal() {
  revealing.value = false
  emit('revealed')
  await nextTick()
  durationField.value?.focus({ preventScroll: true })
  durationField.value?.select()
}
async function reveal() {
  clearTimeout(welcomeErrorTimer)
  errors.value.title = validateTask(input).title
  if (errors.value.title) {
    welcomeErrorTimer = setTimeout(dismissWelcomeError, 2500)
    return
  }
  compact.value = false
  emit('expand')

  revealing.value = true
  await nextTick()
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finishReveal()
  else revealTimer = setTimeout(finishReveal, 1000)
}
function titleKey(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.defaultPrevented) return
  if (compact.value || revealing.value) {
    event.preventDefault()
    if (!event.isComposing && !event.repeat && compact.value && access.canEdit) void reveal()
  }
}
const emit = defineEmits<{ save: [input: TaskInput]; cancel: []; expand: []; revealed: [] }>()
const input = reactive<TaskInput>({
  title: props.task?.title ?? '',
  duration: props.task?.duration ?? 25,
  category: props.task?.category ?? 'Work',
  priority: props.task?.priority ?? 'Medium',
})
const errors = ref({ title: '', duration: '', category: '', priority: '' })
watch(
  () => input.title,
  (title) => {
    if (compact.value && title.trim()) dismissWelcomeError()
  },
)
const titleField = ref<InstanceType<typeof TaskTitleInput>>()
const memory = useTaskMemoryStore()
const history = useFocusHistoryStore()
const durationEdited = ref(!!props.task)
const estimate = computed(() => {
  const preferred = memory.entries.find(
    (e) => normalizeTitle(e.title) === normalizeTitle(input.title),
  )
  return preferred
    ? estimateDuration(input.title, preferred.duration, history.observations)
    : undefined
})
function applyEstimate() {
  if (!estimate.value?.learned) return
  input.duration = estimate.value.minutes
  durationEdited.value = true
}
function reuse(entry: TaskMemoryEntry) {
  Object.assign(input, {
    title: entry.title,
    duration: durationEdited.value ? input.duration : entry.duration,
    category: entry.category,
    priority: entry.priority,
  })
  errors.value = { title: '', duration: '', category: '', priority: '' }
}
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
  categoryButton.value?.focus({ preventScroll: true })
}
async function openCategory() {
  categoryOpen.value = true
  categoryIndex.value = categories.indexOf(input.category)
  await nextTick()
  categoryRoot.value
    ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    [categoryIndex.value]?.focus({ preventScroll: true })
}
function categoryKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeCategory()
    categoryButton.value?.focus({ preventScroll: true })
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
    [categoryIndex.value]?.focus({ preventScroll: true })
}
function outsideCategory(event: PointerEvent) {
  if (!categoryRoot.value?.contains(event.target as Node)) closeCategory()
}
onMounted(() => {
  document.addEventListener('pointerdown', outsideCategory)
  if (props.welcome) titleField.value?.focus()
})
onUnmounted(() => document.removeEventListener('pointerdown', outsideCategory))
defineExpose({
  focusTitle: () => titleField.value?.focus({ suggestions: false }),
  closeMenus: () => {
    closeCategory()
    titleField.value?.close()
  },
})
async function submit() {
  if (!access.canEdit || revealing.value) return
  if (compact.value) {
    await reveal()
    return
  }
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
    class="task-form"
    :class="{ 'welcome-form': welcome, 'is-compact': compact }"
    novalidate
    @submit.prevent="submit"
    @keydown.esc.prevent="!welcome && emit('cancel')"
  >
    <WelcomeIntro v-if="welcome" :compact="compact" />
    <div class="title-stage" @keydown="titleKey">
      <TaskTitleInput
        ref="titleField"
        v-model="input.title"
        :category="input.category"
        :error="errors.title"
        :minimal="compact"
        :hint-id="compact ? 'welcome-hint' : undefined"
        @reuse="reuse"
      />
      <p
        v-if="compact"
        id="welcome-hint"
        class="welcome-hint"
        data-form-part
        aria-live="polite"
        aria-atomic="true"
      >
        <Transition name="hint" mode="out-in">
          <span v-if="errors.title" key="error" class="welcome-error">{{
            t(errors.title.replace(/\.$/, ''))
          }}</span>
          <span v-else key="guidance" class="welcome-guidance"
            >{{ t(' Type a task name, then press ')
            }}<kbd :aria-label="t('Enter')"
              ><span>{{ t('Enter') }}</span
              ><span aria-hidden="true">↵</span></kbd
            >
          </span>
        </Transition>
      </p>
    </div>
    <div
      class="form-remainder"
      :inert="compact || revealing ? true : undefined"
      :aria-hidden="compact || undefined"
    >
      <div class="details">
        <div>
          <label for="task-duration" data-form-part>{{ t('Estimated minutes') }}</label>
          <div class="field duration-field" data-form-part>
            <AppIcon name="clock" /><input
              :disabled="!access.canEdit"
              id="task-duration"
              ref="durationField"
              v-model.number="input.duration"
              @input="durationEdited = true"
              type="number"
              min="1"
              max="1440"
              step="1"
              :aria-invalid="!!errors.duration"
              :aria-describedby="errors.duration ? 'duration-error' : undefined"
            /><span class="duration-unit" aria-hidden="true">{{ t('min') }}</span>
          </div>
        </div>
        <div>
          <label for="task-category" data-form-part>{{ t('Category') }}</label>
          <div
            ref="categoryRoot"
            class="category-picker"
            @focusout="!categoryRoot?.contains($event.relatedTarget as Node) && closeCategory()"
          >
            <button
              :disabled="!access.canEdit"
              id="task-category"
              ref="categoryButton"
              type="button"
              class="field category-trigger"
              data-form-part
              :aria-label="t('Category')"
              aria-haspopup="listbox"
              :aria-expanded="categoryOpen"
              aria-controls="category-options"
              @click="categoryOpen ? closeCategory() : openCategory()"
              @keydown.down.prevent="openCategory()"
              @keydown.up.prevent="openCategory()"
            >
              <AppIcon :name="input.category" /><span>{{ t(input.category) }}</span
              ><AppIcon name="down" />
            </button>
            <Transition name="panel">
              <FloatingMenu
                v-if="categoryOpen"
                placement="below"
                id="category-options"
                class="category-options"
                role="listbox"
                :aria-label="t('Task category')"
                @keydown="categoryKey"
              >
                <button
                  :disabled="!access.canEdit"
                  v-for="(category, index) in categories"
                  :key="category"
                  type="button"
                  role="option"
                  :aria-selected="input.category === category"
                  :tabindex="categoryIndex === index ? 0 : -1"
                  @click="chooseCategory(index)"
                >
                  <AppIcon :name="category" /><span>{{ t(category) }}</span>
                  <span v-if="input.category === category" class="selected-mark" aria-hidden="true"
                    >&#10003;</span
                  >
                </button>
              </FloatingMenu>
            </Transition>
          </div>
        </div>
      </div>
      <p v-if="errors.duration" id="duration-error" class="error" data-form-part>
        {{ t(errors.duration) }}
      </p>
      <p v-if="estimate?.learned" class="estimate-help" data-form-part>
        {{ t(' Suggested: ') }}{{ t(estimate.minutes) }}{{ t(' min · Based on ')
        }}{{ t(estimate.count) }}{{ t(' completed sessions. ')
        }}<button :disabled="!access.canEdit" type="button" class="quiet" @click="applyEstimate">
          {{ t(' Use estimate ') }}
        </button>
      </p>
      <p v-if="errors.category" class="error" data-form-part>{{ t(errors.category) }}</p>
      <fieldset class="priority-picker">
        <legend data-form-part>{{ t('Priority') }}</legend>
        <div class="priority-options" data-form-part>
          <label v-for="priority in priorities" :key="priority">
            <input
              :disabled="!access.canEdit"
              v-model="input.priority"
              type="radio"
              name="priority"
              :value="priority"
            />
            <span>{{ t(priority) }}</span>
          </label>
        </div>
      </fieldset>
      <p v-if="errors.priority" class="error" data-form-part>{{ t(errors.priority) }}</p>
      <div class="actions" :class="{ 'single-action': welcome }">
        <button :disabled="!access.canEdit" type="submit" class="primary" data-form-part>
          {{ t(task ? 'Save changes' : 'Add task') }}<AppIcon name="arrow" />
        </button>
        <button v-if="!welcome" type="button" class="quiet" data-form-part @click="emit('cancel')">
          {{ t(' Cancel ') }}
        </button>
      </div>
      <p v-if="welcome" class="completion-hint" data-form-part>
        <span>{{ t('Choose your details, then press') }}</span>
        <span class="hint-action">{{ t('Add task') }}<AppIcon name="arrow" /></span>
      </p>
    </div>
  </form>
</template>
<style scoped lang="scss">
.task-form {
  --surface-blur: 28px;
  --glass-fill: linear-gradient(115deg, #ffffff09, #ffffff02), rgb(18 16 20 / 10%);
  --glass-hover: linear-gradient(115deg, #ffffff0e, #ffffff04), rgb(18 16 20 / 8%);
  --glass-edge: #ffffff1c;
  --glass-highlight: inset 0 1px 0 #ffffff0b, inset 0 -1px 0 #ffffff03;
  --floating-glass-fill: linear-gradient(115deg, #ffffff09, #ffffff02), rgb(18 16 20 / 48%);
  &.welcome-form {
    min-height: 390px;
    padding-top: 70px;
  }
  .title-stage {
    transition: transform 650ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  &.welcome-form:not(.is-compact) {
    .details > div {
      --arrival-delay: 240ms;
      &:nth-child(2) {
        --arrival-delay: 320ms;
      }
    }
    .details label,
    .details .field {
      animation: detail-arrive 480ms cubic-bezier(0.22, 1, 0.36, 1) var(--arrival-delay) backwards;
    }
    .priority-picker legend,
    .priority-options {
      animation: detail-arrive 480ms cubic-bezier(0.22, 1, 0.36, 1) 400ms backwards;
    }
    .actions > button {
      animation: detail-arrive 480ms cubic-bezier(0.22, 1, 0.36, 1) 480ms backwards;
    }
    .completion-hint {
      animation: welcome-field 850ms ease 920ms backwards;
    }
  }
  .details {
    margin-top: 20px;
  }
  .priority-picker {
    margin-top: 20px;
  }
  .priority-options {
    padding: 3px;
    gap: 3px;
    span {
      min-height: 28px;
      font-size: 11px;
    }
    input:checked + span {
      border-color: #ffffff24;
      background: #ffffff0a;
      box-shadow: inset 0 1px 0 #ffffff08;
    }
  }
  @media (pointer: coarse) {
    .priority-options span {
      min-height: 38px;
    }
    .actions > button {
      height: 44px;
    }
  }
  &.is-compact {
    .title-stage {
      transform: translateY(100px);
    }
    // Fade the glass itself, not its ancestor: ancestor opacity creates a
    // temporary backdrop root and changes blur sampling when the fade ends.
    :deep(.title-field),
    .welcome-hint {
      animation: welcome-field 850ms ease 760ms backwards;
    }
    .form-remainder {
      visibility: hidden;
    }
  }
}
.completion-hint {
  margin: 16px 0 0;
  min-height: 25px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
  line-height: 17px;
}
@keyframes detail-arrive {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.welcome-hint {
  position: absolute;
  top: 100%;
  width: 100%;
  margin: 16px 0 0;
  min-height: 25px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 11px;
  text-align: center;
  .welcome-guidance {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .welcome-error {
    color: #c8a59d;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  kbd > span:last-child {
    font-size: 16px;
  }
}
.welcome-hint kbd,
.completion-hint .hint-action {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 0 8px;
  height: 25px;
  border-radius: 5px;
  border: 1px solid #ffffff40;
  background: #ffffff06;
  color: var(--text);
  font: 11px/1 system-ui;
  box-shadow: inset 0 -2px 0 #ffffff0a;
  svg {
    width: 13px;
    height: 13px;
  }
}
.hint-enter-active,
.hint-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.hint-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.hint-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@keyframes welcome-field {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .task-form .title-stage,
  .task-form .form-remainder,
  .task-form :deep(.title-field),
  .task-form .welcome-hint,
  .task-form .form-remainder *,
  .hint-enter-active,
  .hint-leave-active {
    transition: none;
    animation: none !important;
  }
}
.estimate-help {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 11px;
  button {
    height: 26px;
    font-size: inherit;
  }
}
form {
  position: relative;
  isolation: isolate;
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
  -webkit-backdrop-filter: blur(var(--surface-blur));
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
      border-color: rgb(var(--ambient-warm) / 24%);
      background: linear-gradient(
        115deg,
        rgb(var(--ambient-warm) / 13%),
        rgb(var(--ambient-rose) / 7%) 70%,
        #ffffff04
      );
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
  -webkit-backdrop-filter: blur(var(--surface-blur));
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
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(88px, 1fr);
  gap: 8px;
  margin-top: 24px;
  &.single-action {
    grid-template-columns: minmax(0, 1fr);
  }
  > button {
    height: 38px;
    border-radius: var(--control-radius);
    border-color: var(--glass-edge);
    background: var(--glass-fill);
    -webkit-backdrop-filter: blur(var(--surface-blur));
    backdrop-filter: blur(var(--surface-blur));
    box-shadow: var(--glass-highlight);
    &:hover:not(:disabled) {
      background: var(--glass-hover);
    }
  }
  .primary {
    position: relative;
    width: 100%;
    justify-content: center;
    padding-inline: 16px 40px;
    svg {
      position: absolute;
      right: 16px;
    }
  }
  .quiet {
    min-width: 88px;
    padding-inline: 16px;
    color: var(--text);
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
  padding: 5px;
  border-radius: var(--panel-radius);
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
