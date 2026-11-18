<script setup lang="ts">
import { t } from '@/i18n'
import { ref } from 'vue'
import { getActivePinia } from 'pinia'
import AppIcon from './AppIcon.vue'
import { useWorkspaceAccessStore } from '@/stores/workspaceAccess'
import { exportBackup, readBackup, replaceWorkspace } from '@/workspaceTransfer'
const pinia = getActivePinia()!
const access = useWorkspaceAccessStore()
const file = ref<HTMLInputElement>()
const pending = ref<'import' | 'reset'>()
const backup = ref<Record<string, string>>()
const notice = ref('')
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const selected = input.files?.[0]
  input.value = ''
  if (!selected) return
  notice.value = ''
  try {
    if (selected.size > 10_000_000) throw new Error('too large')
    backup.value = readBackup(await selected.text())
    pending.value = 'import'
  } catch {
    notice.value = 'This file is not a valid FocusFlow backup. Your data has not changed.'
  }
}
function download() {
  try {
    exportBackup(pinia)
    notice.value = 'Backup downloaded.'
  } catch {
    notice.value = 'Could not export data. Please try again.'
  }
}
function confirm() {
  try {
    replaceWorkspace(pinia, pending.value === 'import' ? backup.value : undefined)
  } catch {
    notice.value = 'Could not update storage. Keep this tab open and try again.'
    pending.value = undefined
  }
}
</script>
<template>
  <div class="data-actions">
    <button type="button" :aria-label="t('Export recovery JSON')" @click="download">
      <AppIcon name="down" /><span>{{ t('Export JSON') }}</span
      ><AppIcon name="arrow" />
    </button>
    <button type="button" :disabled="!access.canEdit" @click="file?.click()">
      <AppIcon name="up" /><span>{{ t('Import JSON') }}</span
      ><AppIcon name="arrow" />
    </button>
    <input ref="file" type="file" accept=".json,application/json" hidden @change="choose" />
    <button type="button" :disabled="!access.canEdit" @click="pending = 'reset'">
      <AppIcon name="reset" /><span>{{ t('Reset workspace') }}</span
      ><AppIcon name="arrow" />
    </button>
  </div>
  <div
    v-if="pending"
    class="confirmation"
    role="alertdialog"
    aria-labelledby="confirm-data-title"
    @keydown.esc.stop="pending = undefined"
  >
    <h4 id="confirm-data-title">
      {{ t(pending === 'reset' ? 'Reset this device?' : 'Replace this workspace?') }}
    </h4>
    <p>
      {{
        t(
          pending === 'reset'
            ? 'All tasks, history, remembered tasks and preferences on this device will be removed.'
            : 'Your current tasks, history and preferences will be replaced. Export a copy first if you need them.',
        )
      }}
    </p>
    <div class="confirmation-actions">
      <button type="button" @click="pending = undefined">{{ t('Cancel') }}</button
      ><button type="button" :disabled="!access.canEdit" @click="confirm">
        {{ t(pending === 'reset' ? 'Reset everything' : 'Import backup') }}
      </button>
    </div>
  </div>
  <p v-if="!access.canEdit" class="notice">
    {{ t('Data changes are available in the active tab.') }}
  </p>
  <p class="notice" role="status">{{ t(notice) }}</p>
</template>
<style scoped lang="scss">
.data-actions {
  display: grid;
  gap: 8px;
  margin-top: 24px;
}
.data-actions button {
  justify-content: flex-start;
  gap: 12px;
  padding: 14px 10px;
  background: var(--glass-fill);
  border-color: var(--glass-edge);
  font-size: 12px;
  color: var(--muted);
  span {
    flex: 1;
    text-align: left;
    color: var(--text);
  }
}
.confirmation {
  margin-top: 20px;
  padding: 16px;
  background: var(--glass-fill);
  border: 1px solid var(--glass-edge);
  border-radius: 12px;
}
h4 {
  margin: 0;
  font-weight: 400;
  font-size: 13px;
}
p {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}
.confirmation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  button {
    font-size: 12px;
    padding: 8px 12px;
  }
}
.notice:empty {
  display: none;
}
</style>
