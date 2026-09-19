<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import MultiSelectDropdown from '@/components/MultiSelectDropdown.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import SearchableSelectDropdown from '@/features/projects/components/SearchableSelectDropdown.vue'
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
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const project = ref<Project>()
const candidates = ref<MemberCandidate[]>([])
const roles = ref<ProjectRoleOption[]>([])
const error = ref('')
const selectedUser = ref('')
const selectedRoleIds = ref<string[]>([])
const memberRoleSelections = ref<Record<string, string[]>>({})
const savingMemberIds = ref(new Set<string>())
const deletingProject = ref(false)
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
const candidateOptions = computed(() =>
  candidates.value.map((candidate) => ({
    id: candidate.id,
    label: candidate.displayName,
    description: candidate.account,
  })),
)
const canDelete = computed(() => auth.user?.role === 'Administrator' || auth.user?.role === 'Admin')
async function load() {
  try {
    project.value = await services.projects.get(String(route.params.projectId))
    memberRoleSelections.value = Object.fromEntries(
      project.value.members.map((member) => [member.userId, member.roles.map((role) => role.id)]),
    )
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
async function changeRoles(userId: string, roleIds: string[]) {
  if (!project.value || savingMemberIds.value.has(userId)) return
  if (!roleIds.length) return
  const previousRoleIds = project.value.members
    .find((member) => member.userId === userId)
    ?.roles.map((role) => role.id)
  memberRoleSelections.value = { ...memberRoleSelections.value, [userId]: roleIds }
  savingMemberIds.value = new Set(savingMemberIds.value).add(userId)
  try {
    await services.projects.updateMember(project.value.id, userId, roleIds)
    await load()
    ui.notify(t('message.saved'))
  } catch (reason) {
    if (previousRoleIds) {
      memberRoleSelections.value = {
        ...memberRoleSelections.value,
        [userId]: previousRoleIds,
      }
    }
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  } finally {
    const nextSavingMemberIds = new Set(savingMemberIds.value)
    nextSavingMemberIds.delete(userId)
    savingMemberIds.value = nextSavingMemberIds
  }
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
async function removeProject() {
  if (
    !project.value ||
    deletingProject.value ||
    !confirm(t('message.confirmSoftRemove', { name: project.value.name }))
  )
    return
  deletingProject.value = true
  error.value = ''
  try {
    await services.projects.remove(project.value)
    ui.notify(t('message.removed'))
    await router.push({ name: 'projects' })
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Failed'
  } finally {
    deletingProject.value = false
  }
}
onMounted(load)
</script>
<template>
  <div v-if="error" class="alert" role="alert">{{ error }}</div>
  <div v-if="!project && !error" class="empty-state">{{ t('common.loading') }}</div>
  <template v-if="project"
    ><PageHeader :eyebrow="project.code" :title="project.name"
      ><RouterLink class="button secondary" :to="{ name: 'projects' }">{{
        t('common.back')
      }}</RouterLink
      ><RouterLink
        v-if="canManage"
        class="button primary"
        :to="{ name: 'project-edit', params: { projectId: project.id } }"
        >{{ t('common.edit') }}</RouterLink
      ><button
        v-if="canDelete"
        class="button danger project-delete-button"
        type="button"
        :disabled="deletingProject"
        @click="removeProject"
      >
        {{ t('common.remove') }}
      </button></PageHeader
    >
    <div class="detail-grid">
      <section class="card project-content-card">
        <section class="project-content-section" aria-labelledby="project-description-heading">
          <div class="card-header">
            <h2 id="project-description-heading">{{ t('project.description') }}</h2>
          </div>
          <div class="card-body project-description">
            <p>{{ project.description || '—' }}</p>
            <p>
              <strong>{{ t('project.timeZone') }}：</strong>{{ project.timeZoneId }}
            </p>
          </div>
        </section>
        <section class="project-content-section" aria-labelledby="project-member-heading">
          <div class="card-header">
            <h2 id="project-member-heading">{{ t('project.members') }}</h2>
          </div>
          <div class="card-body">
            <form v-if="canManage" class="toolbar" @submit.prevent="addMember">
              <div class="field grow">
                <label for="member">{{ t('project.selectMember') }}</label>
                <SearchableSelectDropdown
                  v-model="selectedUser"
                  input-id="member"
                  :accessible-label="t('project.selectMember')"
                  :options="candidateOptions"
                  :placeholder="t('project.selectMember')"
                  :search-placeholder="t('project.memberSearchPlaceholder')"
                  :empty-text="t('common.noData')"
                />
              </div>
              <div class="field">
                <label for="member-role">{{ t('project.role') }}</label>
                <MultiSelectDropdown
                  v-model="selectedRoleIds"
                  input-id="member-role"
                  :accessible-label="t('project.role')"
                  :options="roles"
                  :placeholder="t('project.selectRole')"
                  required
                />
              </div>
              <button class="button primary" :disabled="!selectedUser || !selectedRoleIds.length">
                {{ t('project.addMember') }}
              </button>
            </form>
            <div class="table-wrap">
              <table class="data-table member-table">
                <colgroup>
                  <col class="member-name-column" />
                  <col class="member-role-column" />
                  <col v-if="canManage" class="member-action-column" />
                </colgroup>
                <thead>
                  <tr>
                    <th>{{ t('user.name') }}</th>
                    <th>{{ t('project.role') }}</th>
                    <th v-if="canManage" class="member-action-cell">
                      {{ t('common.actions') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="member in project.members" :key="member.userId">
                    <td class="member-role-cell">
                      <span class="table-title">{{ member.displayName }}</span
                      ><span class="table-subtitle">{{ member.account }}</span>
                    </td>
                    <td>
                      <MultiSelectDropdown
                        v-if="canManage"
                        :model-value="memberRoleSelections[member.userId] ?? []"
                        :input-id="`member-roles-${member.userId}`"
                        :accessible-label="`${member.displayName} ${t('project.role')}`"
                        :options="roles"
                        :placeholder="t('project.selectRole')"
                        :disabled="savingMemberIds.has(member.userId)"
                        required
                        @update:model-value="changeRoles(member.userId, $event)"
                      />
                      <span v-else>{{ member.roles.map((role) => role.name).join(', ') }}</span>
                    </td>
                    <td v-if="canManage" class="member-action-cell">
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
            <label>{{ t('project.version') }}</label
            ><span>v{{ project.versionNumber }}</span>
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

<style scoped>
.project-content-section + .project-content-section .card-header {
  border-top: 1px solid var(--slate-200);
}

.project-description p {
  margin: 0;
  color: var(--slate-700);
  line-height: 1.7;
  white-space: pre-wrap;
}

.member-table {
  min-width: 640px;
  table-layout: fixed;
}

.member-name-column {
  width: 24%;
}

.member-role-column {
  width: 56%;
}

.member-action-column {
  width: 20%;
}

.member-role-cell {
  overflow: hidden;
}

.member-role-cell :deep(.multi-select) {
  width: 100%;
  min-width: 0;
}

.member-action-cell {
  white-space: nowrap;
}
</style>
