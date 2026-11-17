import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import FocusBackdrop from '@/components/FocusBackdrop.vue'

const Scene = defineComponent({
  components: { FocusBackdrop },
  props: { mode: { type: String, default: 'form' }, compact: Boolean },
  template: `<div class="scene"><FocusBackdrop :mode="mode" :compact="compact" />
    <section v-if="mode === 'form'" class="creation"><form /></section>
    <section v-else class="task-panel" /></div>`,
})
let wrapper: ReturnType<typeof mount> | undefined
let reduced = false
let onMotionChange: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return reduced
    },
    addEventListener: (_: string, callback: () => void) => {
      onMotionChange = callback
    },
    removeEventListener: vi.fn<MediaQueryList['removeEventListener']>(),
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('scene')) return new DOMRect(0, 0, 1000, 800)
    if (this.tagName === 'FORM') return new DOMRect(322, 200, 356, 390)
    return new DOMRect(290, 130, 420, 400)
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('persistent task light', () => {
  it('fades in at its resting anchor while the welcome form slides into place', async () => {
    let slideY = 28
    const computedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
      element.classList.contains('creation')
        ? ({ transform: `matrix(1, 0, 0, 1, 0, ${slideY})` } as CSSStyleDeclaration)
        : computedStyle(element),
    )
    vi.stubGlobal(
      'DOMMatrixReadOnly',
      class {
        m42: number
        constructor(matrix: string) {
          this.m42 = Number(matrix.slice(7, -1).split(',')[5])
        }
      },
    )
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
      if (this.classList.contains('scene')) return new DOMRect(0, 0, 1000, 800)
      return new DOMRect(322, 200 + slideY, 356, 390)
    })
    wrapper = mount(Scene, { props: { compact: true } })
    await vi.advanceTimersByTimeAsync(80)
    const anchor = wrapper.get('svg > g').attributes('transform')
    const initialPower = Number(wrapper.get('svg > g').attributes('opacity'))
    expect(initialPower).toBeGreaterThan(0)
    expect(initialPower).toBeLessThan(1)
    slideY = 12
    await vi.advanceTimersByTimeAsync(400)
    expect(wrapper.get('svg > g').attributes('transform')).toBe(anchor)
    slideY = 0
    window.dispatchEvent(new Event('resize'))
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.get('svg > g').attributes('transform')).toBe(anchor)
    expect(Number(wrapper.get('svg > g').attributes('opacity'))).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('morphs through interrupted navigation and stops requesting idle frames', async () => {
    wrapper = mount(Scene, { props: { compact: true } })
    await vi.advanceTimersByTimeAsync(4000)
    const source = wrapper.get('svg').element
    const initial = wrapper.get('svg > g').attributes('transform')
    expect(vi.getTimerCount()).toBe(0)
    await wrapper.setProps({ compact: false })
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.get('svg > g').attributes('transform')).not.toBe(initial)
    await wrapper.setProps({ mode: 'list' })
    await vi.advanceTimersByTimeAsync(120)
    await wrapper.setProps({ mode: 'form' })
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.get('svg').element).toBe(source)
    expect(wrapper.get('svg > g').attributes('transform')).not.toMatch(/NaN|Infinity/)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('settles immediately when reduced motion is enabled during a transition', async () => {
    wrapper = mount(Scene, { props: { compact: true } })
    await vi.advanceTimersByTimeAsync(4000)
    await wrapper.setProps({ compact: false })
    await vi.advanceTimersByTimeAsync(200)
    reduced = true
    onMotionChange?.()
    await vi.advanceTimersByTimeAsync(500)
    const settled = wrapper.get('svg > g').attributes('transform')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('svg > g').attributes('transform')).toBe(settled)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels animation and layout work when removed', async () => {
    wrapper = mount(Scene)
    await vi.advanceTimersByTimeAsync(100)
    wrapper.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
