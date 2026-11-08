<script setup lang="ts">
defineProps<{ name: string }>()
const paths: Record<string, string> = {
  Work: 'M4 4h16v12H4z M2 20h20 M8 16v4m8-4v4',
  Study: 'm3 8 9-5 9 5-9 5-9-5m4 3v6l5 3 5-3v-6',
  Personal: 'M20 21v-2a7 7 0 0 0-14 0v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  Health: 'M3 12h4l3-8 4 16 3-8h4',
  Reading: 'M12 5v16M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1',
  plus: 'M12 5v14M5 12h14',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  list: 'M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 4v5l3 2',
  brand: 'M2 9c6-12 10 12 20 0M2 16c6-12 10 12 20 0',
  reset: 'M8 4v5H3 M8 5a8 8 0 1 1-4 8',
  play: 'm8 4 12 8-12 8Z',
  pause: 'M6 4h4v16H6z M14 4h4v16h-4z',
  next: 'm5 5 11 7-11 7Z M19 5v14',
  layers: 'm3 7 9-5 9 5-9 5-9-5m0 5 9 5 9-5M3 17l9 5 9-5',
  chart: 'M4 20V11M10 20V4M16 20v-7M22 20V8',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
}
</script>
<template>
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.Work" />
  </svg>
</template>
