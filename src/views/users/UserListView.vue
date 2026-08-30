<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services'
import type { PageResult, SystemRole, User, UserQuery } from '@/types/models'
const { t } = useI18n()
const query = reactive<UserQuery>({ search: '', role: '', page: 1, pageSize: 20 })
const result = ref<PageResult<User>>({ items: [], page: 1, pageSize: 20, totalCount: 0 })
const roles: SystemRole[] = ['Admin', 'Administrator', 'User', 'Viewer']
const pages = computed(() => Math.max(1, Math.ceil(result.value.totalCount / query.pageSize)))
const loading = ref(true)
let timer: number | undefined
async function load() {
  loading.value = true
  result.value = await services.users.list(query)
  loading.value = false
}
watch(
  () => [query.search, query.role],
  () => {
    query.page = 1
    window.clearTimeout(timer)
    timer = window.setTimeout(load, 180)
  },
)
function changePage(delta: number) {
  query.page += delta
  void load()
}
onMounted(load)
</script>
<template>
  <PageHeader
    eyebrow="Directory"
    :title="t('user.title')"
    description="A read-only company directory. Admins can open a profile to manage access."
  />
  <section class="card">
    <div class="card-header">
      <div class="field grow">
        <label for="user-search">{{ t('common.search') }}</label
        ><input id="user-search" v-model.trim="query.search" placeholder="Account, name, email" />
      </div>
      <div class="field">
        <label for="user-role">{{ t('user.role') }}</label>
        <select id="user-role" v-model="query.role">
          <option value="">{{ t('common.all') }}</option>
          <option v-for="role in roles" :key="role">{{ role }}</option>
        </select>
      </div>
    </div>
    <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
    <EmptyState v-else-if="!result.items.length" :title="t('common.noData')" />
    <div v-else class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('user.account') }}</th>
            <th>{{ t('user.name') }}</th>
            <th>{{ t('user.email') }}</th>
            <th>{{ t('user.role') }}</th>
            <th>{{ t('user.verified') }}</th>
            <th>{{ t('user.enabled') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in result.items" :key="user.id">
            <td class="table-title">{{ user.account }}</td>
            <td>{{ user.displayName }}</td>
            <td>{{ user.email }}</td>
            <td><StatusBadge :value="user.role" /></td>
            <td>{{ user.isVerified ? '✓' : '—' }}</td>
            <td><StatusBadge :value="user.isEnabled ? 'Active' : 'Disabled'" /></td>
            <td>
              <RouterLink
                v-if="!user.isBootstrapAdmin"
                class="link"
                :to="{ name: 'user-detail', params: { userId: user.id } }"
                >{{ t('common.edit') }}</RouterLink
              >
              <span v-else class="table-subtitle">{{ t('user.protected') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <span>{{ result.totalCount }} users · {{ query.page }}/{{ pages }}</span>
      <button class="button secondary" :disabled="query.page <= 1" @click="changePage(-1)">
        {{ t('common.previous') }}
      </button>
      <button class="button secondary" :disabled="query.page >= pages" @click="changePage(1)">
        {{ t('common.next') }}
      </button>
    </div>
  </section>
</template>
