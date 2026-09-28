<script setup lang="ts">
import { storeToRefs } from 'pinia'
import AppSidebar from '@/components/AppSidebar.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
const { sidebarOpen } = storeToRefs(ui)
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <button
      v-if="sidebarOpen"
      class="sidebar-backdrop"
      aria-label="Close navigation"
      @click="sidebarOpen = false"
    />
    <div class="app-content">
      <header class="mobile-header">
        <button class="icon-button" aria-label="Open navigation" @click="sidebarOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <strong>ProjectManagementWeb</strong>
        <UserAvatar
          :account-id="auth.user?.id"
          :display-name="auth.user?.displayName ?? ''"
          :refresh-key="auth.avatarVersion"
          size="small"
        />
      </header>
      <main class="page-container"><RouterView /></main>
    </div>
  </div>
</template>
