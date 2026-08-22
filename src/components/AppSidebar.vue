<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { services } from '@/services/mockServices'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Project } from '@/types/models'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()
const { locale, t } = useI18n()
const { sidebarOpen } = storeToRefs(ui)
const projects = ref<Project[]>([])
const projectsOpen = ref(true)
const expandedProjects = ref(new Set<string>())
const activeProjectId = computed(() => String(route.params.projectId ?? ''))

onMounted(async () => {
  projects.value = await services.projects.listAccessible()
  if (activeProjectId.value) expandedProjects.value.add(activeProjectId.value)
})

function toggleProject(id: string) {
  const next = new Set(expandedProjects.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedProjects.value = next
}

function navigate() {
  sidebarOpen.value = false
}

function switchLocale() {
  locale.value = locale.value === 'zh-TW' ? 'en' : 'zh-TW'
  localStorage.setItem('project-management-web:locale', locale.value)
}

async function logout() {
  await auth.signOut()
  sidebarOpen.value = false
  await router.push({ name: 'sign-in' })
}
</script>

<template>
  <aside class="sidebar" :class="{ open: sidebarOpen }">
    <div class="brand">
      <span class="brand-mark">PM</span>
      <span><strong>ProjectManagement</strong><small>Web workspace</small></span>
    </div>
    <nav class="sidebar-nav" aria-label="Primary navigation">
      <button
        class="nav-button"
        :class="{ active: route.name === 'projects' }"
        @click="projectsOpen = !projectsOpen"
      >
        <span class="nav-icon">▦</span><span>{{ t('nav.projects') }}</span
        ><span class="chevron">{{ projectsOpen ? '⌄' : '›' }}</span>
      </button>
      <div v-if="projectsOpen" class="project-tree">
        <RouterLink :to="{ name: 'projects' }" class="tree-link all-projects" @click="navigate"
          >{{ t('common.all') }} {{ t('nav.projects') }}</RouterLink
        >
        <div v-for="project in projects" :key="project.id" class="project-node">
          <button
            class="project-toggle"
            :class="{ active: activeProjectId === project.id }"
            @click="toggleProject(project.id)"
          >
            <span class="project-dot" /> <span class="truncate">{{ project.name }}</span
            ><span>{{ expandedProjects.has(project.id) ? '⌄' : '›' }}</span>
          </button>
          <div v-if="expandedProjects.has(project.id)" class="project-children">
            <RouterLink
              :to="{ name: 'project-detail', params: { projectId: project.id } }"
              @click="navigate"
              >{{ t('nav.overview') }}</RouterLink
            >
            <RouterLink
              :to="{ name: 'task-list', params: { projectId: project.id } }"
              @click="navigate"
              >{{ t('nav.tasks') }}</RouterLink
            >
          </div>
        </div>
      </div>
      <RouterLink :to="{ name: 'users' }" class="nav-button" @click="navigate"
        ><span class="nav-icon">♙</span><span>{{ t('nav.users') }}</span></RouterLink
      >
      <RouterLink :to="{ name: 'settings' }" class="nav-button" @click="navigate"
        ><span class="nav-icon">⚙</span><span>{{ t('nav.settings') }}</span></RouterLink
      >
    </nav>
    <div class="sidebar-footer">
      <button class="language-button" @click="switchLocale">
        文 / EN <span>{{ locale === 'zh-TW' ? '繁中' : 'English' }}</span>
      </button>
      <div class="profile-summary">
        <span class="avatar">{{ auth.user?.displayName.charAt(0) }}</span>
        <span class="profile-copy"
          ><strong>{{ auth.user?.displayName }}</strong
          ><small>{{ auth.user?.role }}</small></span
        >
        <button
          class="logout-button"
          :aria-label="t('nav.logout')"
          :title="t('nav.logout')"
          @click="logout"
        >
          ↪
        </button>
      </div>
    </div>
  </aside>
</template>
