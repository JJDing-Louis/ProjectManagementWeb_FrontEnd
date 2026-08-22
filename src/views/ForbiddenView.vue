<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <div class="empty-state">
    <span class="empty-icon">!</span>
    <h1>403</h1>
    <h3>{{ t('message.forbidden') }}</h3>
    <RouterLink class="button primary" to="/projects">{{ t('nav.projects') }}</RouterLink>
  </div>
</template>
