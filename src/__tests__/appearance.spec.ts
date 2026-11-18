import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { APPEARANCE_KEY, useAppearanceStore } from '@/stores/appearance'
import WorkspaceTools from '@/components/WorkspaceTools.vue'

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn<(key: string) => string | null>((key) => data.get(key) ?? null),
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      data.set(key, value)
    }),
  })
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('appearance preferences', () => {
  it('defaults to the current theme and ignores invalid saved values', () => {
    localStorage.setItem(APPEARANCE_KEY, 'invalid')
    expect(useAppearanceStore().theme).toBe('2')
  })
  it('restores the selected theme in a new application instance', () => {
    useAppearanceStore().selectTheme('1')
    setActivePinia(createPinia())
    expect(useAppearanceStore().theme).toBe('1')
    useAppearanceStore().selectTheme('2')
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('2')
  })
  it('keeps switching usable when storage is unavailable', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const store = useAppearanceStore()
    store.selectTheme('1')
    expect(store.theme).toBe('1')
    expect(store.notice).toContain('сохранить')
  })
  it('offers both themes in settings and restores focus on Escape', async () => {
    const wrapper = mount(WorkspaceTools, { attachTo: document.body })
    try {
      const opener = wrapper.get('button[aria-label="Settings"]')
      await opener.trigger('click')
      expect(wrapper.emitted('active')?.slice(-1)[0]).toEqual([true, 'Appearance'])
      await wrapper.get('input[value="1"]').setValue(true)
      expect(useAppearanceStore().theme).toBe('1')
      expect(wrapper.get('input[value="1"]').element).toHaveProperty('checked', true)
      await wrapper
        .findAll('aside button')
        .find((button) => button.text() === 'Data & recovery')!
        .trigger('click')
      expect(wrapper.emitted('active')?.slice(-1)[0]).toEqual([true, 'Data'])
      expect(wrapper.text()).toContain('Export JSON')
      expect(wrapper.find('input[name="light-theme"]').exists()).toBe(false)
      await wrapper.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(document.activeElement).toBe(opener.element)
    } finally {
      wrapper.unmount()
    }
  })
})
