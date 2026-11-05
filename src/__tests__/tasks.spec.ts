import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTasksStore, type TaskInput } from '../stores/tasks'
const input: TaskInput = { title: 'Write proposal', duration: 25, category: 'Work' }
describe('task store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('creates, edits with stable identity, completes, reopens and deletes tasks independently', () => {
    const store = useTasksStore()
    store.save({ ...input, title: '  Write proposal  ' })
    store.save({ ...input, title: 'Read' })
    const id = store.tasks[0]!.id
    expect(store.tasks[0]!.title).toBe('Write proposal')
    expect(store.tasks[1]!.id).not.toBe(id)
    expect(store.save({ title: 'Revised', duration: 40, category: 'Study' }, id)).toBe(true)
    expect(store.tasks[0]).toMatchObject({ id, title: 'Revised', duration: 40, category: 'Study' })
    store.toggle(id)
    expect(store.remaining).toBe(1)
    expect(store.totalMinutes).toBe(25)
    store.toggle(id)
    expect(store.remaining).toBe(2)
    store.remove(id)
    expect(store.tasks.map((t) => t.title)).toEqual(['Read'])
  })
  it.each([0, -1, 1.5, NaN, Infinity, 1441])(
    'rejects invalid duration %s without changing data',
    (duration) => {
      const store = useTasksStore()
      expect(store.save({ ...input, duration })).toBe(false)
      expect(store.tasks).toHaveLength(0)
    },
  )
  it('rejects blank titles and invalid edits', () => {
    const store = useTasksStore()
    expect(store.save({ ...input, title: '   ' })).toBe(false)
    store.save(input)
    expect(store.save({ ...input, duration: 0 }, store.tasks[0]!.id)).toBe(false)
    expect(store.tasks[0]!.duration).toBe(25)
    expect(store.save(input, 'missing')).toBe(false)
  })
  it('moves tasks without losing identity or completion and respects boundaries', () => {
    const store = useTasksStore()
    store.save(input)
    store.save({ ...input, title: 'Second' })
    const id = store.tasks[0]!.id
    store.toggle(id)
    store.move(id, -1)
    expect(store.tasks[0]!.id).toBe(id)
    store.move(id, 1)
    expect(store.tasks[1]).toMatchObject({ id, completed: true })
    store.move(id, 1)
    store.move('missing', 1)
    expect(store.tasks).toHaveLength(2)
    store.move(id, -1)
    expect(store.tasks[0]!.id).toBe(id)
  })
})
