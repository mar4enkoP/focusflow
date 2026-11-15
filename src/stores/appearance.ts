import { ref } from 'vue'
import { defineStore } from 'pinia'

export type LightTheme = '1' | '2'
export const APPEARANCE_KEY = 'focusflow.appearance.v1'

export const useAppearanceStore = defineStore('appearance', () => {
  const theme = ref<LightTheme>('2')
  const notice = ref('')
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY)
    if (saved === '1' || saved === '2') theme.value = saved
  } catch {
    notice.value = 'Настройки доступны только до перезагрузки.'
  }
  function selectTheme(value: LightTheme) {
    theme.value = value
    try {
      localStorage.setItem(APPEARANCE_KEY, value)
      notice.value = ''
    } catch {
      notice.value = 'Тема применена, но сохранить выбор не удалось.'
    }
  }
  return { theme, notice, selectTheme }
})
