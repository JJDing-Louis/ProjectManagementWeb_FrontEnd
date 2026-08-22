<script setup lang="ts">
defineProps<{ value: string }>()
</script>

<template>
  <span class="status-badge" :class="`status-${value.toLowerCase()}`">{{ value }}</span>
</template>
