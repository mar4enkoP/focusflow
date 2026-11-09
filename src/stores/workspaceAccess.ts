import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type WorkspaceAccessStatus =
  'idle' | 'waiting' | 'owner' | 'unsupported' | 'error' | 'cancelled' | 'disposed'

export const useWorkspaceAccessStore = defineStore('workspaceAccess', () => {
  const status = ref<WorkspaceAccessStatus>('idle')
  const error = ref('')
  // Ownership alone does not authorize editing: persistence must first hydrate
  // the latest workspace under this lock when integration is implemented.
  const ownsLock = computed(() => status.value === 'owner')

  function transition(next: WorkspaceAccessStatus, message = '') {
    error.value = message
    status.value = next
  }

  return { status, error, ownsLock, transition }
})
