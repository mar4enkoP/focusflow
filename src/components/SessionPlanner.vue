<script setup lang="ts">
import { t } from '@/i18n'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { usePlannerStore } from '@/stores/planner'
import { useTimerStore } from '@/stores/timer'
import AppIcon from './AppIcon.vue'
import type { PlanSettings } from '@/planning'
import { planNotice } from '@/persistence'
const access = useWorkspaceAccessStore()
const emit = defineEmits<{ focus: [id: string] }>()
const tasks = useTasksStore(),
  planner = usePlannerStore(),
  timer = useTimerStore()
function setting<K extends keyof PlanSettings>(key: K) {
  return computed({
    get: () => planner.settings[key],
    set: (value: PlanSettings[K]) => planner.updateSettings({ ...planner.settings, [key]: value }),
  })
}
const minutes = setting('minutes')
const breakMinutes = setting('breakMinutes')
const breakEvery = setting('breakEvery')
const selectedIds = setting('selectedIds')
const now = ref(Date.now())
let pulse: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  pulse = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => clearInterval(pulse))
const shown = computed(() => planner.proposal ?? planner.accepted)
const editing = ref(false)
function generate() {
  planner.generate()
  if (planner.proposal) editing.value = false
}
const remaining = computed(() => Math.floor(planner.remaining(now.value)))
function openFocus(id: string) {
  if (!access.canEdit) return
  if (timer.isFocusing && timer.selectedId !== id) {
    planner.error = 'Pause the current task in Focus Mode before switching.'
    return
  }
  if (planner.begin(id)) emit('focus', id)
}
</script>
<template>
  <div class="planner">
    <form v-if="!shown || editing" @submit.prevent="generate">
      <div class="inputs">
        <label
          >{{ t('Time (min)')
          }}<input
            :disabled="!access.canEdit"
            v-model.number="minutes"
            type="number"
            min="1"
            max="1440"
            required
        /></label>
        <label
          >{{ t('Break (min)')
          }}<input
            :disabled="!access.canEdit"
            v-model.number="breakMinutes"
            type="number"
            min="0"
            max="60"
            required
        /></label>
        <label
          >{{ t('Every (tasks)')
          }}<input
            :disabled="!access.canEdit"
            v-model.number="breakEvery"
            type="number"
            min="1"
            max="20"
            required
        /></label>
      </div>
      <fieldset>
        <legend>{{ t('Tasks') }}</legend>
        <p v-if="!tasks.remaining" class="help">{{ t('Add a task to begin.') }}</p>
        <label
          v-for="task in tasks.tasks.filter((t) => !t.completed)"
          :key="task.id"
          class="task-choice"
          :class="{ selected: planner.settings.selectedIds.includes(task.id) }"
        >
          <input
            :disabled="!access.canEdit"
            v-model="selectedIds"
            type="checkbox"
            :value="task.id"
          />
          <AppIcon :name="task.category" /><span>{{ task.title }}</span
          ><small>{{ t(task.priority) }} · {{ t(task.duration) }}{{ t(' min') }}</small>
        </label>
      </fieldset>
      <button
        type="submit"
        class="generate primary"
        :disabled="!access.canEdit || !planner.settings.selectedIds.length"
      >
        {{ t(' Plan session') }}<AppIcon name="arrow" />
      </button>
      <button v-if="shown" type="button" class="quiet" @click="editing = false">
        {{ t('Cancel') }}
      </button>
    </form>
    <p v-if="planner.error || planNotice" role="status" class="help notice">
      {{ t(planner.error || planNotice) }}
    </p>
    <section v-if="shown && !editing" :aria-label="t('Session schedule')">
      <div class="section-heading">
        <h3>{{ t(planner.proposal ? 'Proposed schedule' : 'Accepted session') }}</h3>
        <button
          :disabled="!access.canEdit"
          type="button"
          class="edit-plan"
          @click="editing = true"
          :aria-label="t('Edit plan settings')"
        >
          <AppIcon name="edit" />
        </button>
      </div>
      <div class="plan-summary">
        <div class="metric">
          <span class="metric-label">{{ t('Planned') }}</span
          ><span class="metric-value"
            >{{ t(shown.schedule.total) }} <small>{{ t('min') }}</small></span
          >
        </div>
        <div class="metric">
          <span class="metric-label">{{ t('Breaks') }}</span
          ><span class="metric-value"
            >{{ t(shown.schedule.breaks) }} <small>{{ t('min') }}</small></span
          >
        </div>
        <div class="metric">
          <span class="metric-label">{{ t('Free') }}</span
          ><span class="metric-value"
            >{{ t(shown.schedule.free) }} <small>{{ t('min') }}</small></span
          >
        </div>
      </div>
      <p v-if="shown.startedAt" class="help">{{ t(remaining) }}{{ t(' min left') }}</p>
      <p v-if="planner.overrun" role="status" class="help">
        {{ t(' Over time. Recalculate to reserve 5 more minutes. ') }}
      </p>
      <p v-if="shown.completedIds.length" class="help">
        {{ t(shown.completedIds.length) }}{{ t(' completed') }}
      </p>
      <ol class="schedule">
        <li
          v-for="(slot, index) in shown.schedule.slots"
          :key="index"
          :class="{
            'break-slot': slot.kind === 'break',
            done: slot.taskId && shown.completedIds.includes(slot.taskId),
          }"
        >
          <span class="time"
            >{{ t(shown.offset + slot.start) }}–{{ t(shown.offset + slot.end)
            }}{{ t(' min') }}</span
          >
          <span
            >{{ slot.kind === 'break' ? t(slot.title) : slot.title
            }}<small v-if="slot.learned">{{ t(' · Learned estimate') }}</small
            ><small v-if="slot.taskId && shown.completedIds.includes(slot.taskId)">{{
              t(' · Completed')
            }}</small
            ><small v-else-if="slot.taskId && !tasks.tasks.some((t) => t.id === slot.taskId)">{{
              t(' · Deleted')
            }}</small></span
          >
          <button
            v-if="
              !planner.proposal &&
              slot.taskId &&
              !shown.completedIds.includes(slot.taskId) &&
              tasks.tasks.some((t) => t.id === slot.taskId && !t.completed)
            "
            type="button"
            :disabled="!access.canEdit || remaining <= 0"
            :aria-label="t(`Focus on planned ${slot.title}`)"
            @click="openFocus(slot.taskId)"
          >
            {{ t(' Focus ') }}
          </button>
        </li>
      </ol>
      <p v-if="!shown.schedule.slots.length" class="help">{{ t('No tasks fit this budget.') }}</p>
      <div v-if="shown.schedule.omitted.length" class="unscheduled">
        <h3>{{ t('Unscheduled · ') }}{{ t(shown.schedule.omitted.length) }}</h3>
        <ul>
          <li v-for="item in shown.schedule.omitted" :key="item.taskId">
            {{ item.title }} — {{ t(item.reason) }}
          </li>
        </ul>
      </div>
      <div class="actions" v-if="planner.proposal">
        <button :disabled="!access.canEdit" type="button" class="primary" @click="planner.accept()">
          {{ t(' Accept plan ') }}
        </button>
        <button :disabled="!access.canEdit" type="button" @click="planner.reject">
          {{ t('Discard') }}
        </button>
      </div>
      <div class="actions" v-else>
        <button :disabled="!access.canEdit" type="button" @click="planner.generate(true)">
          {{ t(' Recalculate ') }}
        </button>
      </div>
    </section>
    <section class="method" :aria-label="t('Planning details')">
      <h3>{{ t('Details') }}</h3>
      <p>{{ t('Priority first, then task order. Estimates leave your timer unchanged.') }}</p>
      <p>{{ t('Breaks are manual. Pauses use session time. Open Focus to start.') }}</p>
    </section>
  </div>
</template>
<style scoped lang="scss">
@use '@/assets/workspace' as workspace;
@include workspace.content;
.edit-plan {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
}
.inputs {
  display: grid;
  grid-template-columns: 1.15fr 1fr 1fr;
  gap: 10px;
  label {
    font-size: 11px;
    color: var(--muted);
  }
  input {
    display: block;
    width: 100%;
    margin-top: 8px;
    height: 30px;
    border: 1px solid var(--glass-edge);
    border-radius: 18px;
    background: var(--glass-fill);
    color: var(--text);
    padding: 0 12px;
    font: inherit;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    transition: background var(--motion-fast);
    &:hover,
    &:focus {
      background: var(--form-glass-hover);
    }
  }
}
fieldset {
  border: 0;
  padding: 0;
  margin: 14px 0 12px;
  max-height: 174px;
  overflow: auto;
  scrollbar-width: thin;
  legend {
    font-size: 12px;
    margin-bottom: 10px;
  }
}
.task-choice {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background var(--motion-fast),
    border-color var(--motion-fast);
  &:hover {
    background: var(--glass-fill);
  }
  &.selected {
    background: #ffffff05;
  }
  > span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 12px;
  }
  small {
    flex-shrink: 0;
    font-size: 10px;
  }
  > svg {
    color: var(--muted);
    flex-shrink: 0;
  }
  input {
    appearance: none;
    flex: 0 0 14px;
    width: 14px;
    height: 14px;
    margin: 0;
    border: 1px solid #77717d;
    border-radius: 4px;
    display: grid;
    place-content: center;
    cursor: pointer;
    &:checked {
      background: #e3dfe6;
      border-color: #e3dfe6;
      &::after {
        content: '';
        width: 6px;
        height: 3px;
        border-left: 1.5px solid #19151d;
        border-bottom: 1.5px solid #19151d;
        transform: translateY(-1px) rotate(-45deg);
      }
    }
  }
}
.generate {
  width: 100%;
  justify-content: center;
  position: relative;
  height: 32px;
  border-color: var(--form-glass-edge);
  background: var(--form-glass-fill);
  box-shadow: var(--form-glass-highlight);
  svg {
    position: absolute;
    right: 14px;
  }
}
.plan-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  .metric {
    padding: 12px;
  }
  .metric-value {
    font-size: 20px;
  }
}
.schedule {
  list-style: none;
  margin: 14px 0;
  padding: 0;
  li {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0 12px 14px;
    border-bottom: 1px solid var(--glass-edge);
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 19px;
      width: 4px;
      height: 4px;
      border: 1px solid #a49ca9;
      border-radius: 50%;
    }
    > span:nth-child(2) {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 12px;
      small {
        display: block;
        font-size: 10px;
      }
    }
  }
  .break-slot {
    color: var(--muted);
    background: #ffffff02;
  }
  .done {
    color: var(--muted);
  }
  .time {
    color: var(--muted);
    font-size: 10px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  button {
    height: 26px;
    font-size: 11px;
    padding: 0 10px;
    background: var(--glass-fill);
    border-color: var(--glass-edge);
  }
}
.unscheduled {
  padding: 12px 0;
  border-top: 1px solid var(--glass-edge);
  ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }
  li + li {
    margin-top: 6px;
  }
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  button {
    flex: 1;
    font-size: 12px;
  }
}
@media (max-width: 380px) {
  .inputs {
    gap: 6px;
    input {
      padding: 0 9px;
    }
  }
  .task-choice {
    gap: 6px;
    padding: 8px 6px;
    small {
      max-width: 72px;
      text-align: right;
    }
  }
  .plan-summary .metric {
    padding: 10px;
  }
  .schedule li {
    gap: 7px;
  }
}
</style>
