<script setup lang="ts">
import { t } from '@/i18n'
import { ref } from 'vue'
import { getActivePinia } from 'pinia'
import { downloadEmergencyExport } from '../emergencyExport'
defineProps<{ embedded?: boolean }>()
const pinia = getActivePinia()
const notice = ref('')
function download() {
  try {
    if (!pinia) throw new Error('Workspace state is unavailable')
    downloadEmergencyExport(pinia)
    notice.value =
      'Recovery JSON prepared. It may contain incomplete or damaged data; review before restoring.'
  } catch (error) {
    console.error('[FocusFlow] Recovery export failed', error)
    notice.value = 'Could not prepare the recovery file. Keep this tab open and try again.'
  }
}
</script>
<template>
  <div class="recovery-export" :class="{ embedded }">
    <button type="button" @click="download">{{ t('Export recovery JSON') }}</button>
    <p role="status">{{ t(notice) }}</p>
  </div>
</template>
<style scoped>
.recovery-export {
  position: fixed;
  left: 8px;
  bottom: 8px;
  z-index: 110;
  max-width: min(280px, 45vw);
  text-align: center;
  padding: 8px 16px;
}
p {
  color: var(--muted);
  max-width: 60ch;
  margin: 6px auto;
}
p:empty {
  display: none;
}
.recovery-export.embedded {
  position: static;
  max-width: none;
  padding: 0;
  text-align: left;
}
.embedded p {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 16px;
}
</style>
