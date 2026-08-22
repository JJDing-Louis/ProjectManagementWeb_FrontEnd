<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services/mockServices'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError, type Project, type ProjectRole, type User } from '@/types/models'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()
const project = ref<Project>()
const users = ref<User[]>([])
const error = ref('')
const selectedUser = ref('')
const selectedRole = ref<ProjectRole>('Member')
const roles: ProjectRole[] = [
  'ProjectManager',
  'FrontendDeveloper',
  'BackendDeveloper',
  'SystemAnalyst',
  'Member',
]
const canManage = computed(() => {
  const value = project.value
  const actor = auth.user
  return Boolean(
    value &&
    actor &&
    (auth.isTaskAdministrator ||
      value.ownerId === actor.id ||
      value.members.some((m) => m.userId === actor.id && m.projectRole === 'ProjectManager')),
  )
})
const userById = (id: string) => users.value.find((user) => user.id === id)
async function load() {
  try {
    project.value = await services.projects.get(String(route.params.projectId))
    users.value = await services.users.list()
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed to load project'
  }
}
async function addMember() {
  if (!project.value || !selectedUser.value) return
  try {
    project.value = await services.projects.addMember(
      project.value.id,
      selectedUser.value,
      selectedRole.value,
    )
    selectedUser.value = ''
    ui.notify(t('message.saved'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  }
}
async function changeRole(userId: string, event: Event) {
  if (!project.value) return
  project.value = await services.projects.updateMember(
    project.value.id,
    userId,
    (event.target as HTMLSelectElement).value as ProjectRole,
  )
  ui.notify(t('message.saved'))
}
async function removeMember(userId: string) {
  if (
    !project.value ||
    !confirm(t('message.confirmRemove', { name: userById(userId)?.displayName }))
  )
    return
  try {
    project.value = await services.projects.removeMember(project.value.id, userId)
    ui.notify(t('message.removed'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  }
}
onMounted(load)
</script>
<template>
  <div v-if="error" class="alert">{{ error }}</div>
  <div v-if="!project && !error" class="empty-state">{{ t('common.loading') }}</div>
  <template v-if="project"
    ><PageHeader :eyebrow="project.id" :title="project.name" :description="project.description"
      ><RouterLink class="button secondary" :to="{ name: 'projects' }">{{
        t('common.back')
      }}</RouterLink
      ><RouterLink
        v-if="canManage"
        class="button primary"
        :to="{ name: 'project-edit', params: { projectId: project.id } }"
        >{{ t('common.edit') }}</RouterLink
      ></PageHeader
    >
    <div class="detail-grid">
      <section class="card">
        <div class="card-header">
          <h2>{{ t('project.members') }}</h2>
        </div>
        <div class="card-body">
          <form v-if="canManage" class="toolbar" @submit.prevent="addMember">
            <div class="field grow">
              <label for="member">{{ t('user.name') }}</label
              ><select id="member" v-model="selectedUser" required>
                <option value="">Select a user</option>
                <option
                  v-for="user in users.filter(
                    (u) => u.isEnabled && !project?.members.some((m) => m.userId === u.id),
                  )"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ user.displayName }} ({{ user.account }})
                </option>
              </select>
            </div>
            <div class="field">
              <label for="member-role">{{ t('project.role') }}</label
              ><select id="member-role" v-model="selectedRole">
                <option v-for="role in roles" :key="role">{{ role }}</option>
              </select>
            </div>
            <button class="button primary">{{ t('project.addMember') }}</button>
          </form>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('user.name') }}</th>
                  <th>{{ t('user.email') }}</th>
                  <th>{{ t('project.role') }}</th>
                  <th v-if="canManage">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in project.members" :key="member.userId">
                  <td>
                    <span class="table-title">{{ userById(member.userId)?.displayName }}</span
                    ><span class="table-subtitle">{{ userById(member.userId)?.account }}</span>
                  </td>
                  <td>{{ userById(member.userId)?.email }}</td>
                  <td>
                    <select
                      v-if="canManage"
                      :value="member.projectRole"
                      @change="changeRole(member.userId, $event)"
                    >
                      <option v-for="role in roles" :key="role">{{ role }}</option></select
                    ><span v-else>{{ member.projectRole }}</span>
                  </td>
                  <td v-if="canManage">
                    <button
                      class="button danger"
                      :disabled="member.userId === project.ownerId"
                      @click="removeMember(member.userId)"
                    >
                      {{ t('common.remove') }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <aside class="card">
        <div class="card-header">
          <h2>Overview</h2>
          <StatusBadge :value="project.status" />
        </div>
        <div class="card-body detail-list" style="grid-template-columns: 1fr">
          <div class="detail-item">
            <label>{{ t('project.owner') }}</label
            ><strong>{{ userById(project.ownerId)?.displayName }}</strong>
          </div>
          <div class="detail-item">
            <label>Created</label><span>{{ new Date(project.createdAt).toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <label>Last updated</label
            ><span>{{ new Date(project.updatedAt).toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <label>Version</label><span>v{{ project.version }}</span>
          </div>
          <RouterLink
            class="button primary"
            :to="{ name: 'task-list', params: { projectId: project.id } }"
            >Open Task List →</RouterLink
          >
        </div>
      </aside>
    </div>
  </template>
</template>
