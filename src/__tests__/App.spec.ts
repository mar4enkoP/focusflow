import { afterEach, describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import App from '../App.vue'
import { useTasksStore } from '../stores/tasks'
const wrappers: ReturnType<typeof mount>[] = []
function setup() {
  const pinia = createPinia()
  const wrapper = mount(App, { global: { plugins: [pinia] }, attachTo: document.body })
  wrappers.push(wrapper)
  return { wrapper, store: useTasksStore(pinia) }
}
afterEach(() => {
  wrappers.forEach((w) => w.unmount())
  wrappers.length = 0
})
describe('task manager', () => {
  it('validates fields inline and keeps entered values', async () => {
    const { wrapper, store } = setup()
    expect(wrapper.text()).toContain('Add your first task')
    await wrapper.get('#task-title').setValue('   ')
    await wrapper.get('#task-duration').setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Give your task a title.')
    expect(wrapper.text()).toContain('Choose a whole number')
    expect(store.tasks).toHaveLength(0)
    expect(document.activeElement?.id).toBe('task-title')
    await wrapper.get('#task-title').setValue('Read a chapter')
    await wrapper.get('form').trigger('submit')
    expect((wrapper.get('#task-title').element as HTMLInputElement).value).toBe('Read a chapter')
    expect(document.activeElement?.id).toBe('task-duration')
  })
  it('adds, reorders, completes, reopens, edits, cancels and deletes through working controls', async () => {
    const { wrapper, store } = setup()
    await wrapper.get('#task-title').setValue('First')
    await wrapper.get('#task-duration').setValue('40')
    await wrapper.get('#task-category').setValue('Reading')
    await wrapper.get('form').trigger('submit')
    const id = store.tasks[0]!.id
    expect(wrapper.get('[aria-label="Task list"]').text()).toContain('Reading · 40 min')
    await wrapper.get('[aria-label="Add a task"]').trigger('click')
    await wrapper.get('#task-title').setValue('Second')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[aria-label="Move Second up"]').trigger('click')
    expect(store.tasks[0]!.title).toBe('Second')
    expect(wrapper.get('[aria-label="Move Second up"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[aria-label="Complete First"]').setValue(true)
    expect(wrapper.text()).toContain('Completed')
    expect(store.remaining).toBe(1)
    await wrapper.get('[aria-label="Complete First"]').setValue(false)
    expect(store.remaining).toBe(2)
    await wrapper.get('[aria-label="Edit First"]').trigger('click')
    expect((wrapper.get('#task-title').element as HTMLInputElement).value).toBe('First')
    await wrapper.get('#task-title').setValue('Updated')
    await wrapper.get('#task-duration').setValue('15')
    await wrapper.get('#task-category').setValue('Health')
    await wrapper.get('form').trigger('submit')
    expect(store.tasks.find((t) => t.id === id)).toMatchObject({
      title: 'Updated',
      duration: 15,
      category: 'Health',
    })
    await wrapper.get('[aria-label="Edit Updated"]').trigger('click')
    await wrapper.get('#task-title').setValue('Discard')
    await wrapper.get('form').trigger('keydown', { key: 'Escape' })
    expect(wrapper.text()).toContain('Updated')
    expect(wrapper.text()).not.toContain('Discard')
    await wrapper.get('[aria-label="Delete Updated"]').trigger('click')
    expect(store.tasks.map((t) => t.title)).toEqual(['Second'])
    await wrapper.get('[aria-label="Delete Second"]').trigger('click')
    expect(wrapper.text()).toContain('A clear space, a fresh start.')
    expect(wrapper.text()).toContain('0 tasks to do')
  })
})
