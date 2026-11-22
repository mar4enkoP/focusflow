<script setup lang="ts">
defineProps<{ themeLocked?: boolean }>()
import { t } from '@/i18n'
import ThemeSettings from './ThemeSettings.vue'
import DataSettings from './DataSettings.vue'
import { language, setLanguage } from '@/i18n'
import AppIcon from './AppIcon.vue'

const section = defineModel<'Appearance' | 'Data' | 'Language' | 'Music' | 'Notifications'>(
  'section',
  { required: true },
)
</script>

<template>
  <div class="settings-layout">
    <aside :aria-label="t('Settings sections')">
      <button
        v-for="item in ['Appearance', 'Language', 'Data', 'Music', 'Notifications'] as const"
        :key="item"
        type="button"
        :aria-pressed="section === item"
        aria-controls="settings-content"
        @click="section = item"
      >
        <AppIcon
          :name="
            {
              Appearance: 'layers',
              Language: 'language',
              Data: 'database',
              Music: 'music',
              Notifications: 'bell',
            }[item]
          "
        />
        {{ t(item === 'Data' ? 'Data & recovery' : item) }}
        <AppIcon v-if="item === 'Appearance' && themeLocked" name="lock" class="section-lock" />
      </button>
    </aside>
    <Transition name="settings-section" mode="out-in">
      <section id="settings-content" :key="section" aria-labelledby="settings-section-title">
        <h3 id="settings-section-title">
          {{
            t(
              {
                Appearance: 'Themes',
                Language: 'Language',
                Data: 'Data & recovery',
                Music: 'Music',
                Notifications: 'Notifications',
              }[section],
            )
          }}
        </h3>
        <template v-if="section === 'Appearance'">
          <ThemeSettings :theme-locked="themeLocked" />
        </template>
        <DataSettings v-else-if="section === 'Data'" />
        <div v-else-if="section === 'Language'" class="language-options">
          <button
            v-for="locale in ['en', 'ru'] as const"
            :key="locale"
            type="button"
            :aria-pressed="language === locale"
            @click="setLanguage(locale)"
          >
            {{ t(locale === 'en' ? 'English' : 'Русский')
            }}<AppIcon v-if="language === locale" name="check" />
          </button>
        </div>
        <div v-else class="coming-soon">
          <AppIcon :name="section === 'Music' ? 'music' : 'bell'" />
          <p>{{ t('In development') }}</p>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.section-lock {
  width: 12px;
  height: 12px;
  margin-left: auto;
  color: var(--muted);
}
.language-options {
  display: grid;
  gap: 8px;
  margin-top: 24px;
  button {
    justify-content: space-between;
    padding: 14px;
    background: var(--glass-fill);
    border-color: var(--glass-edge);
    font-size: 13px;
  }
}
.coming-soon {
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--muted);
  margin-top: 28px;
  p {
    margin: 0;
  }
}
.settings-layout {
  display: grid;
  grid-template-columns: 156px minmax(0, 1fr);
  gap: 28px;
  margin-top: 12px;
  align-items: start;
  align-content: start;
}
aside {
  display: flex;
  flex-direction: column;
  gap: 6px;
  button {
    justify-content: flex-start;
    gap: 9px;
    padding: 12px 10px;
    font-size: 12px;
    text-align: left;
    background: transparent;
    border-color: transparent;
    color: var(--muted);
    &[aria-pressed='true'] {
      color: var(--text);
      background: var(--glass-hover);
      border-color: var(--glass-edge);
    }
    svg {
      flex-shrink: 0;
    }
  }
}
section {
  align-self: start;
  display: block;
  min-width: 0;
}
h3 {
  margin: 0 0 10px;
  font-size: 19px;
  font-weight: 400;
  letter-spacing: -0.4px;
}
h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 500;
}
p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
  margin: 0 0 20px;
}
.recovery-card {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--glass-edge);
}
.settings-section-enter-active,
.settings-section-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms var(--motion-ease);
}
.settings-section-enter-from,
.settings-section-leave-to {
  opacity: 0;
  transform: translateY(5px);
}
@media (max-width: 560px) {
  .settings-layout {
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 20px;
  }
  aside {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
@media (prefers-reduced-motion: reduce) {
  .settings-section-enter-active,
  .settings-section-leave-active {
    transition: none;
  }
}
</style>
