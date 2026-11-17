import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ScreenHeading from '../components/ScreenHeading.vue'

const wrappers: ReturnType<typeof mount>[] = []
function setup(reducedMotion = false) {
  vi.useFakeTimers()
  const wrapper = mount(ScreenHeading, {
    props: { text: 'Your tasks', id: 'screen-title', reducedMotion },
    global: { stubs: { transition: false } },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers.length = 0
  vi.useRealTimers()
})

describe('screen heading transitions', () => {
  it('holds the old position until the outgoing welcome heading has disappeared', async () => {
    const wrapper = setup()
    await vi.advanceTimersByTimeAsync(500)
    Object.defineProperty(wrapper.get('h1').element, 'offsetTop', { value: 280 })
    wrapper.vm.holdPosition()
    await wrapper.setProps({ text: 'Set up your first task.', relocate: true })
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.get('h1').element.style.top).toBe('280px')
    expect(wrapper.text()).toBe('Your tasks')
    await vi.advanceTimersByTimeAsync(300)
    expect(wrapper.get('h1').element.style.top).toBe('')
    expect(wrapper.text()).toBe('Set up your first task.')
    await vi.advanceTimersByTimeAsync(1100)
    expect(wrapper.findAll('.heading-copy')).toHaveLength(1)
  })

  it('overlaps the outgoing and incoming copy without replacing the heading anchor', async () => {
    const wrapper = setup()
    const anchor = wrapper.get('h1').element
    await vi.advanceTimersByTimeAsync(500)
    await wrapper.setProps({ text: 'Make time for a task.' })
    await vi.advanceTimersByTimeAsync(50)
    expect(wrapper.findAll('.heading-copy')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(450)
    expect(wrapper.findAll('.heading-copy')).toHaveLength(1)
    expect(wrapper.text()).toBe('Make time for a task.')
    expect(wrapper.get('h1').element).toBe(anchor)
  })

  it('finishes the current transition and then shows only the latest navigation request', async () => {
    const wrapper = setup()
    await vi.advanceTimersByTimeAsync(500)
    await wrapper.setProps({ text: 'Make time for a task.' })
    await vi.advanceTimersByTimeAsync(100)
    await wrapper.setProps({ text: 'Planner' })
    await wrapper.setProps({ text: 'Analytics' })
    expect(wrapper.text()).not.toContain('Planner')
    expect(wrapper.text()).not.toContain('Analytics')
    await vi.advanceTimersByTimeAsync(1400)
    expect(wrapper.text()).toBe('Analytics')
    expect(wrapper.findAll('.heading-copy')).toHaveLength(1)
  })

  it('switches immediately without a queue when reduced motion is enabled', async () => {
    const wrapper = setup(true)
    await wrapper.setProps({ text: 'Planner' })
    await wrapper.setProps({ text: 'Analytics' })
    expect(wrapper.text()).toBe('Analytics')
    expect(wrapper.findAll('.heading-copy')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
