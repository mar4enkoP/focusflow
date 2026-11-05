<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '@/stores/timer'
import AppIcon from '@/components/AppIcon.vue'
const timer = useTimerStore()
const display = computed(() => {
  const seconds = Math.ceil(timer.remaining / 1000)
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
})
</script>
<template>
  <section class="focus" aria-label="Focus timer">
    <p class="task-title">{{ timer.task?.title ?? 'Your space is clear' }}</p>
    <div class="countdown" role="timer" aria-label="Time remaining">{{ display }}</div>
    <p class="status" role="status">
      {{
        !timer.task
          ? 'Choose an unfinished task to begin'
          : timer.state === 'expired'
            ? 'Time is up. Add time or mark your task complete.'
            : timer.state === 'running'
              ? 'Focus'
              : timer.state === 'paused'
                ? 'Paused · Take your time'
                : 'Ready when you are'
      }}
    </p>
    <p v-if="timer.task" class="planned">Planned · {{ timer.task.duration }} min</p>
    <div class="controls">
      <button
        aria-label="Reset timer"
        title="Reset timer"
        :disabled="!timer.task"
        @click="timer.reset"
      >
        <AppIcon name="reset" />
      </button>
      <button
        class="play"
        :aria-label="timer.state === 'running' ? 'Pause timer' : 'Start or resume timer'"
        :disabled="!timer.task || timer.remaining <= 0"
        @click="timer.state === 'running' ? timer.pause() : timer.start()"
      >
        <AppIcon :name="timer.state === 'running' ? 'pause' : 'play'" />
      </button>
      <button
        aria-label="Complete task and select next"
        title="Complete task and select next"
        :disabled="!timer.task"
        @click="timer.complete"
      >
        <AppIcon name="next" />
      </button>
    </div>
    <button class="add-time" :disabled="!timer.task" @click="timer.addTime">+5 min</button>
  </section>
</template>
<style scoped lang="scss">
.focus {
  text-align: center;
  width: 100%;
  align-self: flex-start;
  padding-top: clamp(64px, 22vh, 240px);
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
  .focus {
    padding-top: 12px;
  }
  .countdown {
    font-size: 72px;
  }
  .controls {
    margin-top: 20px;
  }
}
</style>
