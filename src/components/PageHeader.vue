<script setup lang="ts">
defineProps<{
  eyebrow?: string | undefined
  title: string
  description?: string | undefined
}>()
</script>

<template>
  <header class="page-header">
    <div>
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div class="page-actions"><slot /></div>
  </header>
</template>
