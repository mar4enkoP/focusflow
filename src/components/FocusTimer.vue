<script setup lang="ts">
import { t } from '@/i18n'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import AppIcon from '@/components/AppIcon.vue'
const access = useWorkspaceAccessStore()
const timer = useTimerStore()
const display = computed(() => {
  const seconds = Math.ceil(timer.remaining / 1000)
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
</script>
<template>
  <section class="focus" :aria-label="t('Focus timer')">
    <p class="task-title">{{ timer.task?.title ?? t('Your space is clear') }}</p>
    <div class="countdown" role="timer" :aria-label="t('Time remaining')">{{ t(display) }}</div>
    <p class="status" role="status">
      {{
        t(
          !access.canEdit
            ? 'Read-only · Timer snapshot'
            : !timer.task
              ? 'Choose an unfinished task to begin'
              : timer.state === 'expired'
                ? timer.isFocusing
                  ? 'Time is up · Focus time is still being recorded.'
                  : 'Time is up. Continue focus, add time or complete.'
                : timer.state === 'running'
                  ? 'Focus'
                  : timer.state === 'paused'
                    ? 'Paused · Take your time'
                    : 'Ready when you are',
        )
      }}
    </p>
    <p v-if="timer.task" class="planned">
      {{ t('Planned · ') }}{{ t(timer.task.duration) }}{{ t(' min') }}
    </p>
    <div class="controls">
      <button
        :aria-label="t('Reset timer')"
        :title="t('Reset timer')"
        :disabled="!access.canEdit || !timer.task"
        @click="timer.reset"
      >
        <AppIcon name="reset" />
      </button>
      <button
        class="play"
        :aria-label="t(timer.isFocusing ? 'Pause timer' : 'Start or resume timer')"
        :disabled="!access.canEdit || !timer.task"
        @click="timer.isFocusing ? timer.pause() : timer.continueFocus()"
      >
        <AppIcon :name="timer.isFocusing ? 'pause' : 'play'" />
      </button>
      <button
        :aria-label="t('Complete task and select next')"
        :title="t('Complete task and select next')"
        :disabled="!access.canEdit || !timer.task"
        @click="timer.complete"
      >
        <AppIcon name="next" />
      </button>
    </div>
    <button class="add-time" :disabled="!access.canEdit || !timer.task" @click="timer.addTime">
      {{ t(' +5 min ') }}
    </button>
  </section>
</template>
<style scoped lang="scss">
.focus {
  text-align: center;
  width: 100%;
  margin: 0 auto;
  padding-top: 0;
}
.task-title,
.planned {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.countdown {
  font-size: clamp(72px, 8vw, 112px);
  font-weight: 200;
  letter-spacing: -2px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.status {
  color: var(--muted);
  font-size: 14px;
  margin: 6px auto 0;
  max-width: 380px;
}
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 38px;
  margin-top: 34px;
  button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #17101340;
    border-color: #ffffff0d;
    padding: 0;
    font-size: 18px;
  }
  .play {
    height: 50px;
    width: 50px;
    border-radius: 50%;
    border-color: #f16b4f96;
    background: radial-gradient(circle at 50% 42%, #151013 40%, #6b29245c 78%, #ee4e3680 100%);
    box-shadow:
      inset 0 1px 5px #ffffff16,
      inset 0 -3px 8px #ee4e363d,
      0 2px 8px #0003;
    font-size: 14px;
    svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
      stroke-width: 1;
    }
  }
}
.add-time {
  margin-top: 14px;
  border: 0;
  font-size: 12px;
  background: transparent;
  color: var(--muted);
}
@media (max-height: 600px) {
  .countdown {
    font-size: 72px;
  }
  .controls {
    margin-top: 20px;
  }
}
</style>
