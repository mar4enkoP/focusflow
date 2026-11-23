<script setup lang="ts">
defineProps<{ themeLocked?: boolean }>()
import AppIcon from './AppIcon.vue'
import { t } from '@/i18n'
import { useId } from 'vue'
import { useAppearanceStore } from '@/stores/appearance'
const id = useId()
const appearance = useAppearanceStore()
</script>

<template>
  <div class="theme-choice">
    <div v-if="themeLocked" class="theme-lock" :aria-label="t('Themes locked')">
      <span class="lock-message"><AppIcon name="lock" />{{ t('Themes locked') }}</span>
    </div>
    <fieldset
      class="theme-options"
      :disabled="themeLocked"
      :aria-describedby="themeLocked ? id + '-lock' : undefined"
    >
      <legend class="sr-only">{{ t('Lighting') }}</legend>
      <label v-for="option in ['2', '1'] as const" :key="option" class="theme-option">
        <input
          type="radio"
          name="light-theme"
          :value="option"
          :aria-label="t(option === '2' ? 'Classic' : 'Ember')"
          :checked="appearance.theme === option"
          @change="appearance.selectTheme(option)"
        />
        <span class="theme-card">
          <span class="theme-preview" :data-theme="option" aria-hidden="true">
            <svg viewBox="0 0 200 120" fill="none">
              <defs>
                <linearGradient
                  :id="id + option"
                  gradientUnits="userSpaceOnUse"
                  x1="10"
                  y1="0"
                  x2="190"
                  y2="0"
                >
                  <stop stop-color="#ef3340" stop-opacity="0" />
                  <stop offset=".3" stop-color="#ff6736" />
                  <stop offset=".55" stop-color="#ffe2a8" />
                  <stop offset=".8" stop-color="#ff7635" />
                  <stop offset="1" stop-color="#ef3340" stop-opacity="0" />
                </linearGradient>
              </defs>
              <g :stroke="`url(#${id + option})`">
                <path
                  class="preview-glow"
                  :d="option === '1' ? 'M10 84H190' : 'M18 44C25 104 161 110 182 34'"
                />
                <path
                  class="preview-core"
                  :d="option === '1' ? 'M10 84H190' : 'M18 44C25 104 161 110 182 34'"
                />
              </g>
            </svg>
          </span>
          <span class="theme-label"
            >{{ t(option === '2' ? 'Classic' : 'Ember')
            }}<span class="selection" aria-hidden="true">
              <template v-if="appearance.theme === option">
                <span v-if="appearance.applying" class="applying"
                  >{{ t('Applying') }}<span class="progress"
                /></span>
                <span v-else class="applied">{{ t('✓ Active') }}</span>
              </template>
            </span></span
          >
        </span>
      </label>
    </fieldset>
  </div>
  <p v-if="themeLocked" :id="id + '-lock'" class="theme-hint" role="status">
    {{ t('Finish creating your first task to unlock themes.') }}
  </p>
  <p v-else class="theme-hint" role="status">
    {{ t(appearance.applying ? 'Applying your light…' : 'Your theme is saved on this device.') }}
  </p>
  <p v-if="appearance.notice" class="theme-notice" role="status">{{ t(appearance.notice) }}</p>
</template>

<style scoped lang="scss">
.theme-choice {
  position: relative;
  margin-top: 20px;
  isolation: isolate;
}
.theme-lock {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--text);
  background: rgb(18 16 20 / 22%);
  border: 1px solid #ffffff14;
  backdrop-filter: blur(5px);
  box-shadow: inset 0 1px 0 #ffffff08;
  cursor: not-allowed;
}
.lock-message {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--muted);
  svg {
    width: 15px;
    height: 15px;
  }
}
.theme-options:disabled {
  .theme-card {
    opacity: 0.5;
  }
  input,
  .theme-option {
    cursor: not-allowed;
  }
}
.theme-options {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
legend {
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 12px;
}
.theme-option {
  position: relative;
  cursor: pointer;
  min-width: 0;
}
input {
  position: absolute;
  opacity: 0;
  inset: 0;
  z-index: 1;
  margin: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}
.theme-card {
  display: block;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--glass-fill);
  transition: border-color 160ms;
}
input:checked + .theme-card {
  border-color: #d18d64;
}
input:focus-visible + .theme-card {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}
.theme-option:hover .theme-card {
  border-color: #bca397;
}
.theme-preview {
  display: block;
  height: 132px;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 80%, #a4311714, transparent 70%);
  svg {
    width: 100%;
    height: 100%;
  }
  .preview-glow {
    stroke-width: 15px;
    filter: blur(10px);
    opacity: 0.65;
  }
  .preview-core {
    stroke-width: 1.5px;
    filter: blur(0.5px);
  }
  &[data-theme='2'] .preview-glow {
    stroke-width: 23px;
    filter: blur(12px);
  }
}
.theme-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  font-size: 12px;
}
.selection {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 16px;
  height: 16px;
}
.applied {
  font-size: 10px;
  color: #e7b38d;
  white-space: nowrap;
}
.applying {
  position: relative;
  font-size: 10px;
  color: var(--muted);
  padding-bottom: 5px;
}
.progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 1px;
  width: 100%;
  background: #e7b38d;
  transform-origin: left;
  animation: apply-progress 2.4s ease-in-out both;
}
@keyframes apply-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress {
    animation: none;
  }
}
.theme-hint,
.theme-notice {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  margin: 16px 0 0;
}
</style>
