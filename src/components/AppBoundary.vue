<script setup lang="ts">
import { nextTick, onErrorCaptured, ref, watch } from 'vue'
import type { ErrorRecovery } from '../errorRecovery'
const props = defineProps<{ recovery: ErrorRecovery }>()
const heading = ref<HTMLElement>()
onErrorCaptured((error, _instance, info) => {
  props.recovery.report(error, 'Vue boundary: ' + info)
  return false
})
watch(
  props.recovery.failure,
  async (failed) => {
    if (failed) {
      await nextTick()
      heading.value?.focus()
    }
  },
  { immediate: true },
)
</script>
<template>
  <section
    v-if="recovery.failure.value"
    class="error-fallback"
    aria-labelledby="error-heading"
    role="alert"
  >
    <h1 id="error-heading" ref="heading" tabindex="-1">
      FocusFlow could not display this workspace
    </h1>
    <p>Your workspace data has not been cleared. Keep this tab open if saving has failed.</p>
    <p>
      Try reopening the interface, or export a recovery copy below. An unfinished form may need to
      be entered again.
    </p>
    <button v-if="recovery.attempts.value < 2" type="button" @click="recovery.retry">
      Reopen interface
    </button>
    <p v-else>Recovery did not resolve the error. Export your data before reloading this page.</p>
  </section>
  <slot v-else :key="recovery.attempts.value" />
</template>
<style scoped>
.error-fallback {
  margin: 12vh auto 24px;
  padding: 24px;
  max-width: 620px;
}
h1 {
  font-size: 22px;
}
p {
  line-height: 1.6;
  color: var(--muted);
}
</style>
