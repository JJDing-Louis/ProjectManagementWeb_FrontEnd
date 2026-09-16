<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  ApiError,
  type PageResult,
  type Project,
  type TaskItem,
  type TaskQuery,
  type TaskStatus,
  type UserPreference,
} from '@/types/models'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const projectId = String(route.params.projectId)
const project = ref<Project>()
const result = ref<PageResult<TaskItem>>({ items: [], page: 1, pageSize: 8, totalCount: 0 })
const loading = ref(true)
const error = ref('')
const selected = ref(new Map<string, TaskItem>())
const targetStatus = ref<TaskStatus>('InProgress')
const preference = ref<UserPreference>()
const query = reactive<TaskQuery>({
  search: String(route.query.search ?? ''),
  status: (route.query.status ?? '') as '' | TaskStatus,
  assigneeId: String(route.query.assigneeId ?? ''),
  mineOnly: route.query.mineOnly === 'true',
  sort: route.query.sort === 'oldest' ? 'oldest' : 'newest',
  page: Number(route.query.page) || 1,
  pageSize: 8,
})
const statuses: TaskStatus[] = ['Pending', 'InProgress', 'Blocked', 'Completed']
const pages = computed(() => Math.max(1, Math.ceil(result.value.totalCount / query.pageSize)))
const canAdmin = computed(() => auth.hasFunction('tasks.update-any'))
const canCreate = computed(() => auth.hasFunction('tasks.create'))
const canEdit = (task: TaskItem) =>
  Boolean(
    auth.user &&
    (canAdmin.value ||
      (auth.hasFunction('tasks.update-assigned') && task.assigneeId === auth.user.id)),
  )
const userName = (id: string) =>
  project.value?.members.find((member) => member.userId === id)?.displayName ?? id
const editableOnPage = computed(() => result.value.items.filter(canEdit))
const allSelected = computed(
  () =>
    editableOnPage.value.length > 0 &&
    editableOnPage.value.every((task) => selected.value.has(task.id)),
)
const batchLimitExceeded = computed(() => selected.value.size > 10)
async function load() {
  loading.value = true
  error.value = ''
  try {
    result.value = await services.tasks.list(projectId, query)
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Load failed'
  } finally {
    loading.value = false
  }
}
async function initialLoad() {
  ;[project.value, preference.value] = await Promise.all([
    services.projects.get(projectId),
    services.preferences.get(),
  ])
  await load()
}
function syncQuery() {
  void router.replace({
    query: {
      ...(query.search && { search: query.search }),
      ...(query.status && { status: query.status }),
      ...(query.assigneeId && { assigneeId: query.assigneeId }),
      ...(query.mineOnly && { mineOnly: 'true' }),
      ...(query.sort !== 'newest' && { sort: query.sort }),
      ...(query.page > 1 && { page: String(query.page) }),
    },
  })
}
let filterTimer: number | undefined
watch(
  () => [query.search, query.status, query.assigneeId, query.mineOnly, query.sort],
  () => {
    query.page = 1
    selected.value = new Map()
    window.clearTimeout(filterTimer)
    filterTimer = window.setTimeout(() => {
      syncQuery()
      void load()
    }, 180)
  },
)
function toggleAll() {
  const next = new Map(selected.value)
  if (allSelected.value) editableOnPage.value.forEach((task) => next.delete(task.id))
  else editableOnPage.value.forEach((task) => next.set(task.id, task))
  selected.value = next
}
function toggle(task: TaskItem) {
  const next = new Map(selected.value)
  if (next.has(task.id)) next.delete(task.id)
  else next.set(task.id, task)
  selected.value = next
}
async function batchUpdate() {
  if (!selected.value.size || batchLimitExceeded.value) return
  if (
    !preference.value?.skipBatchConfirmation &&
    !confirm(`${t('task.selected', { count: selected.value.size })} → ${targetStatus.value}?`)
  )
    return
  try {
    const updatedCount = await services.tasks.batchUpdate(
      projectId,
      [...selected.value.values()],
      targetStatus.value,
    )
    selected.value = new Map()
    ui.notify(t('message.updated', { count: updatedCount }))
    await load()
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Update failed'
  }
}
async function removeTask(task: TaskItem) {
  if (!confirm(t('message.confirmSoftRemove', { name: task.title }))) return
  try {
    error.value = ''
    await services.tasks.remove(projectId, task)
    ui.notify(t('message.removed'))
    await load()
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Delete failed'
  }
}
function changePage(delta: number) {
  query.page += delta
  selected.value = new Map()
  syncQuery()
  void load()
}
onMounted(initialLoad)
</script>
<template>
  <PageHeader
    :eyebrow="project?.code"
    :title="project?.name ?? t('task.title')"
    :description="t('task.title')"
    ><RouterLink class="button secondary" :to="{ name: 'project-detail', params: { projectId } }">{{
      t('project.detail')
    }}</RouterLink
    ><RouterLink
      v-if="canCreate"
      class="button primary"
      :to="{ name: 'task-new', params: { projectId } }"
      >＋ {{ t('task.new') }}</RouterLink
    ></PageHeader
  >
  <div v-if="error" class="alert" role="alert">{{ error }}</div>
  <section class="card">
    <div class="card-header">
      <div class="toolbar" style="margin: 0; width: 100%">
        <div class="field grow">
          <label for="task-search">{{ t('common.search') }}</label
          ><input
            id="task-search"
            v-model="query.search"
            placeholder="Task ID, title, description"
          />
        </div>
        <div class="field">
          <label for="task-status">{{ t('common.status') }}</label
          ><select id="task-status" v-model="query.status">
            <option value="">{{ t('common.all') }}</option>
            <option v-for="status in statuses" :key="status">{{ status }}</option>
          </select>
        </div>
        <div class="field">
          <label for="task-assignee">{{ t('task.assignee') }}</label
          ><select id="task-assignee" v-model="query.assigneeId">
            <option value="">{{ t('common.all') }}</option>
            <option v-for="member in project?.members" :key="member.userId" :value="member.userId">
              {{ member.displayName }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="task-sort">{{ t('task.sort') }}</label
          ><select id="task-sort" v-model="query.sort">
            <option value="newest">{{ t('task.newest') }}</option>
            <option value="oldest">{{ t('task.oldest') }}</option>
          </select>
        </div>
        <label class="check-field"
          ><input v-model="query.mineOnly" type="checkbox" />{{ t('task.mine') }}</label
        >
      </div>
    </div>
    <div class="card-body" style="padding-bottom: 12px">
      <div class="toolbar">
        <div class="field">
          <label for="target-status">{{ t('task.batch') }}</label
          ><select id="target-status" v-model="targetStatus">
            <option v-for="status in statuses" :key="status">{{ status }}</option>
          </select>
        </div>
        <button
          class="button primary"
          :disabled="!selected.size || batchLimitExceeded"
          @click="batchUpdate"
        >
          {{ t('common.confirm') }} · {{ selected.size }}
        </button>
      </div>
      <p v-if="batchLimitExceeded" class="alert" role="alert">{{ t('task.batchLimit') }}</p>
    </div>
    <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
    <EmptyState
      v-else-if="!result.items.length"
      :title="t('common.noData')"
      description="Try changing the filters."
    />
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                :checked="allSelected"
                :disabled="!editableOnPage.length"
                aria-label="Select all editable tasks"
                @change="toggleAll"
              />
            </th>
            <th>{{ t('task.id') }}</th>
            <th>{{ t('task.name') }}</th>
            <th>{{ t('task.deadline') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('task.creator') }}</th>
            <th>{{ t('task.assignee') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in result.items" :key="task.id">
            <td>
              <input
                type="checkbox"
                :checked="selected.has(task.id)"
                :disabled="!canEdit(task)"
                :aria-label="`Select ${task.title}`"
                @change="toggle(task)"
              />
            </td>
            <td>{{ task.code }}</td>
            <td>
              <RouterLink
                class="table-title"
                :to="{
                  name: 'task-detail',
                  params: { projectId, taskId: task.id },
                  query: route.query,
                }"
                >{{ task.title }}</RouterLink
              ><span class="table-subtitle">{{ task.description }}</span>
            </td>
            <td>{{ new Date(task.deadline).toLocaleDateString() }}</td>
            <td><StatusBadge :value="task.status" /></td>
            <td>{{ userName(task.creatorId) }}</td>
            <td>{{ userName(task.assigneeId) }}</td>
            <td>
              <div class="row-actions">
                <RouterLink
                  class="link"
                  :to="{
                    name: 'task-detail',
                    params: { projectId, taskId: task.id },
                    query: route.query,
                  }"
                  >{{ t('task.detail') }}</RouterLink
                ><RouterLink
                  v-if="canEdit(task)"
                  class="link"
                  :to="{ name: 'task-edit', params: { projectId, taskId: task.id } }"
                  >{{ t('common.edit') }}</RouterLink
                ><button
                  v-if="canAdmin"
                  class="link"
                  style="border: 0; background: none"
                  @click="removeTask(task)"
                >
                  {{ t('common.remove') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <span>{{ result.totalCount }} tasks · {{ query.page }}/{{ pages }}</span
      ><button class="button secondary" :disabled="query.page <= 1" @click="changePage(-1)">
        {{ t('common.previous') }}</button
      ><button class="button secondary" :disabled="query.page >= pages" @click="changePage(1)">
        {{ t('common.next') }}
      </button>
    </div>
  </section>
</template>
