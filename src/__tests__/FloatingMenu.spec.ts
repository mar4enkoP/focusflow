import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FloatingMenu from '@/components/FloatingMenu.vue'

afterEach(() => vi.restoreAllMocks())

it('opens in the browser top layer and follows its anchor on resize', () => {
  const showPopover = vi.fn<(this: HTMLElement) => void>(function () {
    expect(this.style.position).toBe('fixed')
    expect(this.style.top).toBe('240px')
    expect(this.style.width).toBe('356px')
  })
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover')
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    configurable: true,
    value: showPopover,
  })
  let top = 200
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ left: 100, top, bottom: top + 34, width: 356 }) as DOMRect,
  )
  const wrapper = mount(FloatingMenu, { slots: { default: 'Suggestions' } })
  try {
    expect(wrapper.attributes('popover')).toBe('manual')
    expect(showPopover).toHaveBeenCalledOnce()
    expect(wrapper.element.style.top).toBe('240px')
    expect(wrapper.element.style.width).toBe('356px')
    top = 250
    window.dispatchEvent(new Event('resize'))
    expect(wrapper.element.style.top).toBe('290px')
  } finally {
    wrapper.unmount()
    if (original) Object.defineProperty(HTMLElement.prototype, 'showPopover', original)
    else Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  }
})

it('opens above the anchor when the space below is too short', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: window.innerHeight - 100,
    bottom: window.innerHeight - 66,
    width: 356,
  } as DOMRect)
  const wrapper = mount(FloatingMenu)
  expect(wrapper.element.style.top).toBe('auto')
  expect(wrapper.element.style.bottom).toBe('106px')
  wrapper.unmount()
})
