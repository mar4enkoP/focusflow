<script setup lang="ts">
import { useAppearanceStore } from '@/stores/appearance'
const appearance = useAppearanceStore()
</script>

<template>
  <fieldset class="theme-options">
    <legend>Освещение</legend>
    <label v-for="option in ['1', '2'] as const" :key="option" class="theme-option">
      <input
        type="radio"
        name="light-theme"
        :value="option"
        :checked="appearance.theme === option"
        @change="appearance.selectTheme(option)"
      />
      <span class="theme-card">
        <span class="theme-preview" :data-theme="option" aria-hidden="true"><span /></span>
        <span class="theme-label"
          >{{ option }} — {{ option === '1' ? 'Старая' : 'Новая'
          }}<span class="selection" aria-hidden="true"
        /></span>
      </span>
    </label>
  </fieldset>
  <p class="theme-hint">Изменения видны сразу. Выбор сохраняется на этом устройстве.</p>
  <p v-if="appearance.notice" class="theme-notice" role="status">{{ appearance.notice }}</p>
</template>

<style scoped lang="scss">
.theme-options {
  border: 0;
  padding: 0;
  margin: 20px 0 0;
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
  background: #0a090c;
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
  position: relative;
  display: block;
  height: 92px;
  overflow: hidden;
  span {
    position: absolute;
    width: 110px;
    height: 48px;
    left: 50%;
    bottom: 17px;
    transform: translateX(-50%);
    border-radius: 50%;
  }
  &[data-theme='1'] span {
    border-bottom: 2px solid #ff9b42;
    box-shadow: 0 10px 16px -8px #e9421c;
  }
  &[data-theme='2'] span {
    background: linear-gradient(transparent, #d8420d70 30%, #ffab34 82%, #ffe5a1);
    box-shadow: 0 0 20px #f95a223b;
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
  width: 10px;
  height: 10px;
  border: 1px solid #777079;
  border-radius: 50%;
}
input:checked + .theme-card .selection {
  background: #e7b38d;
  border-color: #e7b38d;
  box-shadow: inset 0 0 0 2px #251b16;
}
.theme-hint,
.theme-notice {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.6;
  margin: 16px 0 0;
}
</style>
