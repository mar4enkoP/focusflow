<script setup lang="ts">
import App from './App.vue'
import AppBoundary from './components/AppBoundary.vue'
import EmergencyExport from './components/EmergencyExport.vue'
import type { ErrorRecovery } from './errorRecovery'
defineProps<{ recovery: ErrorRecovery }>()
defineOptions({ name: 'AppRoot' })
</script>
<template>
  <AppBoundary :recovery="recovery"><App /></AppBoundary>
  <EmergencyExport />
</template>
