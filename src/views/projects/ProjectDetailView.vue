<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  ApiError,
  type MemberCandidate,
  type Project,
  type ProjectRoleOption,
} from '@/types/models'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()
const project = ref<Project>()
const candidates = ref<MemberCandidate[]>([])
const roles = ref<ProjectRoleOption[]>([])
const error = ref('')
const selectedUser = ref('')
const selectedRoleIds = ref<string[]>([])
const canManage = computed(() => {
  const value = project.value
  const actor = auth.user
  return Boolean(
    value &&
    actor &&
    (auth.hasFunction('projects.manage-all') ||
      value.members.some(
        (member) =>
          member.userId === actor.id && member.roles.some((role) => role.code === 'ProjectManager'),
      )),
  )
})
const ownerName = computed(
  () =>
    project.value?.members.find((member) => member.userId === project.value?.ownerId)?.displayName,
)
async function load() {
  try {
    project.value = await services.projects.get(String(route.params.projectId))
    if (canManage.value) {
      ;[candidates.value, roles.value] = await Promise.all([
        services.projects.memberCandidates(project.value.id),
        services.projects.roles(),
      ])
      if (!selectedRoleIds.value.length) {
        const memberRole = roles.value.find((role) => role.code === 'Member')
        if (memberRole) selectedRoleIds.value = [memberRole.id]
      }
    }
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed to load project'
  }
}
async function addMember() {
  if (!project.value || !selectedUser.value || !selectedRoleIds.value.length) return
  try {
    await services.projects.addMember(project.value.id, selectedUser.value, selectedRoleIds.value)
    selectedUser.value = ''
    await load()
    ui.notify(t('message.saved'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  }
}
async function changeRoles(userId: string, event: Event) {
  if (!project.value) return
  const roleIds = [...(event.target as HTMLSelectElement).selectedOptions].map(
    (option) => option.value,
  )
  if (!roleIds.length) return
  await services.projects.updateMember(project.value.id, userId, roleIds)
  await load()
  ui.notify(t('message.saved'))
}
async function removeMember(userId: string) {
  if (
    !project.value ||
    !confirm(
      t('message.confirmRemove', {
        name: project.value.members.find((member) => member.userId === userId)?.displayName,
      }),
    )
  )
    return
  try {
    await services.projects.removeMember(project.value.id, userId)
    await load()
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
    ><PageHeader :eyebrow="project.code" :title="project.name" :description="project.description"
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
                <option v-for="user in candidates" :key="user.id" :value="user.id">
                  {{ user.displayName }} ({{ user.account }})
                </option>
              </select>
            </div>
            <div class="field">
              <label for="member-role">{{ t('project.role') }}</label
              ><select id="member-role" v-model="selectedRoleIds" multiple required>
                <option v-for="role in roles" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </div>
            <button class="button primary">{{ t('project.addMember') }}</button>
          </form>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('user.name') }}</th>
                  <th>{{ t('project.role') }}</th>
                  <th v-if="canManage">{{ t('common.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in project.members" :key="member.userId">
                  <td>
                    <span class="table-title">{{ member.displayName }}</span
                    ><span class="table-subtitle">{{ member.account }}</span>
                  </td>
                  <td>
                    <select
                      v-if="canManage"
                      multiple
                      :value="member.roles.map((role) => role.id)"
                      @change="changeRoles(member.userId, $event)"
                    >
                      <option v-for="role in roles" :key="role.id" :value="role.id">
                        {{ role.name }}
                      </option></select
                    ><span v-else>{{ member.roles.map((role) => role.name).join(', ') }}</span>
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
            ><strong>{{ ownerName }}</strong>
          </div>
          <div class="detail-item">
            <label>Created</label><span>{{ new Date(project.createdAt).toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <label>Last updated</label
            ><span>{{ new Date(project.updatedAt).toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <label>Concurrency token</label><span>{{ project.rowVersion }}</span>
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
