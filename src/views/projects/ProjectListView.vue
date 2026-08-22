<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services/mockServices'
import { useAuthStore } from '@/stores/auth'
import type { PageResult, Project, ProjectQuery } from '@/types/models'

const { t } = useI18n()
const auth = useAuthStore()
const query = reactive<ProjectQuery>({ search: '', status: '', page: 1, pageSize: 6 })
const result = ref<PageResult<Project>>({ items: [], page: 1, pageSize: 6, total: 0 })
const loading = ref(true)
const canCreate = computed(() => auth.isTaskAdministrator)
const pages = computed(() => Math.max(1, Math.ceil(result.value.total / query.pageSize)))
async function load() {
  loading.value = true
  result.value = await services.projects.list(query)
  loading.value = false
}
function changePage(delta: number) {
  query.page += delta
  void load()
}
watch(
  () => [query.search, query.status],
  () => {
    query.page = 1
    void load()
  },
)
onMounted(load)
</script>
<template>
  <PageHeader
    eyebrow="Workspace"
    :title="t('project.title')"
    description="Browse the projects you can access and open their workspaces."
    ><RouterLink v-if="canCreate" class="button primary" :to="{ name: 'project-new' }"
      >＋ {{ t('project.new') }}</RouterLink
    ></PageHeader
  >
  <section class="card">
    <div class="card-header">
      <div class="toolbar" style="margin: 0; flex: 1">
        <div class="field grow">
          <label for="project-search">{{ t('common.search') }}</label
          ><input
            id="project-search"
            v-model.trim="query.search"
            placeholder="ID, name, description"
          />
        </div>
        <div class="field">
          <label for="project-status">{{ t('common.status') }}</label
          ><select id="project-status" v-model="query.status">
            <option value="">{{ t('common.all') }}</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </div>
      </div>
    </div>
    <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
    <EmptyState
      v-else-if="!result.items.length"
      :title="t('common.noData')"
      description="Try a different keyword or status."
    />
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('project.id') }}</th>
            <th>{{ t('project.name') }}</th>
            <th>{{ t('project.owner') }}</th>
            <th>{{ t('common.status') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in result.items" :key="project.id">
            <td>
              <span class="table-title">{{ project.id }}</span>
            </td>
            <td>
              <span class="table-title">{{ project.name }}</span
              ><span class="table-subtitle">{{ project.description }}</span>
            </td>
            <td>{{ project.ownerId }}</td>
            <td><StatusBadge :value="project.status" /></td>
            <td>
              <div class="row-actions">
                <RouterLink
                  class="link"
                  :to="{ name: 'project-detail', params: { projectId: project.id } }"
                  >{{ t('project.detail') }}</RouterLink
                ><RouterLink
                  class="link"
                  :to="{ name: 'task-list', params: { projectId: project.id } }"
                  >Tasks</RouterLink
                >
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <span>{{ result.total }} projects · {{ query.page }}/{{ pages }}</span
      ><button class="button secondary" :disabled="query.page <= 1" @click="changePage(-1)">
        {{ t('common.previous') }}</button
      ><button class="button secondary" :disabled="query.page >= pages" @click="changePage(1)">
        {{ t('common.next') }}
      </button>
    </div>
  </section>
</template>
