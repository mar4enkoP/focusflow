import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type WorkspaceAccessStatus =
  'idle' | 'waiting' | 'owner' | 'unsupported' | 'error' | 'cancelled' | 'disposed'

export const useWorkspaceAccessStore = defineStore('workspaceAccess', () => {
  const status = ref<WorkspaceAccessStatus>('idle')
  const error = ref('')
  const hydrated = ref(false)
  const hydrating = ref(false)
  const generation = ref(0)
  const mutationDepth = ref(0)
  const revision = ref(0)
  // Synchronous batching, not rollback; publish once at the outer boundary.
  function batch<T>(action: () => T): T {
    mutationDepth.value += 1
    try {
      return action()
    } finally {
      mutationDepth.value -= 1
      if (!mutationDepth.value) revision.value += 1
    }
  }
  // Ownership alone does not authorize editing: persistence must first hydrate
  // the latest workspace under this lock.
  const ownsLock = computed(() => status.value === 'owner')

  const canEdit = computed(() => ownsLock.value && hydrated.value && !hydrating.value)
  // Only synchronous persistence recovery may mutate during hydration.
  const canMutate = computed(() => canEdit.value || (ownsLock.value && hydrating.value))

  function transition(next: WorkspaceAccessStatus, message = '') {
    if (next !== 'owner') {
      hydrated.value = false
      hydrating.value = false
    }
    error.value = message
    status.value = next
  }

  return {
    status,
    error,
    ownsLock,
    hydrated,
    hydrating,
    generation,
    mutationDepth,
    revision,
    batch,
    canEdit,
    canMutate,
    transition,
  }
})
