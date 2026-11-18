<script setup lang="ts">
import { t } from '@/i18n'
import AppIcon from './AppIcon.vue'
import { useTaskDeletionStore, UNDO_WINDOW_MS } from '@/stores/taskDeletion'
import { useAppearanceStore } from '@/stores/appearance'
const deletion = useTaskDeletionStore()
const appearance = useAppearanceStore()
</script>

<template>
  <Transition name="deletion-toast">
    <div
      v-if="deletion.title"
      class="deletion-toast"
      :class="{ ember: appearance.theme === '1' }"
      role="status"
      aria-live="polite"
    >
      <div class="message">
        <span class="caption">{{ t('Task deleted') }}</span>
        <span class="task-name" :title="deletion.title">{{ deletion.title }}</span>
      </div>
      <button type="button" @click="deletion.undo"><AppIcon name="reset" />{{ t('Undo') }}</button>
      <span
        :key="`glow-${deletion.revision}`"
        class="countdown-glow"
        :style="{ animationDuration: `${UNDO_WINDOW_MS}ms` }"
        aria-hidden="true"
      />
      <span
        :key="deletion.revision"
        class="countdown"
        :style="{ animationDuration: `${UNDO_WINDOW_MS}ms` }"
        aria-hidden="true"
      />
    </div>
  </Transition>
</template>

<style scoped lang="scss">
@property --undo-glow-edge {
  syntax: '<percentage>';
  inherits: true;
  initial-value: 100%;
}
.deletion-toast {
  --toast-progress: linear-gradient(90deg, #763416, #a65421 38%, #bc8035 72%, #cfad69);
  position: fixed;
  right: 24px;
  bottom: 28px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 14px;
  width: min(280px, calc(100vw - 32px));
  padding: 12px 14px 14px;
  overflow: hidden;
  border: 1px solid var(--floating-glass-edge);
  border-radius: 12px;
  background: var(--workspace-glass);
  -webkit-backdrop-filter: blur(24px) saturate(115%);
  backdrop-filter: blur(24px) saturate(115%);
  box-shadow:
    0 8px 28px #0003,
    var(--glass-highlight);
  &.ember {
    --toast-progress: linear-gradient(90deg, #65202b, #a43d29 35%, #bd6534 60%, #a53840);
  }
}
.message {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.caption {
  font-size: 12px;
  color: var(--text);
}
.task-name {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
button {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  gap: 7px;
  padding: 6px 7px;
  font-size: 12px;
  color: var(--muted);
  border-color: transparent;
  background: transparent;
  &:hover {
    color: var(--text);
    background: var(--glass-hover);
  }
}
.countdown {
  position: absolute;
  inset: auto 0 0;
  height: 58px;
  pointer-events: none;
  clip-path: inset(0 0 0 0);
  animation: countdown linear forwards;
  &::after {
    content: '';
    position: absolute;
    inset: auto 0 0;
    background: var(--toast-progress);
  }
  &::after {
    height: 2px;
    opacity: 0.85;
  }
}
.countdown-glow {
  position: absolute;
  inset: auto 0 0;
  height: 58px;
  pointer-events: none;
  filter: blur(4px);
  // Feather around the real endpoint, including a soft tail beyond the bar.
  mask-image: linear-gradient(
    to right,
    #000 calc(var(--undo-glow-edge) - 36px),
    #000b calc(var(--undo-glow-edge) - 12px),
    #0005 calc(var(--undo-glow-edge) + 14px),
    transparent calc(var(--undo-glow-edge) + 52px)
  );
  -webkit-mask-image: linear-gradient(
    to right,
    #000 calc(var(--undo-glow-edge) - 36px),
    #000b calc(var(--undo-glow-edge) - 12px),
    #0005 calc(var(--undo-glow-edge) + 14px),
    transparent calc(var(--undo-glow-edge) + 52px)
  );
  animation: glow-countdown linear forwards;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--toast-progress);
    opacity: 0.27;
    mask-image: linear-gradient(to top, #000, #0009 30%, transparent 95%);
    -webkit-mask-image: linear-gradient(to top, #000, #0009 30%, transparent 95%);
  }
}
@keyframes glow-countdown {
  to {
    --undo-glow-edge: 0%;
  }
}
@keyframes countdown {
  to {
    clip-path: inset(0 100% 0 0);
  }
}
.deletion-toast-enter-active,
.deletion-toast-leave-active {
  transition:
    opacity 400ms ease,
    transform 400ms cubic-bezier(0.22, 1, 0.36, 1);
}
.deletion-toast-enter-from,
.deletion-toast-leave-to {
  opacity: 0;
  transform: translateX(14px);
}
@media (max-width: 480px) {
  .deletion-toast {
    right: 16px;
    bottom: 20px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .deletion-toast-enter-active,
  .deletion-toast-leave-active {
    transition: none;
  }
  .countdown,
  .countdown-glow {
    animation-timing-function: steps(10);
  }
}
</style>
