<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { services } from '@/services/mockServices'
import { useAuthStore } from '@/stores/auth'
import type { User } from '@/types/models'
const { t } = useI18n()
const auth = useAuthStore()
const users = ref<User[]>([])
const search = ref('')
const loading = ref(true)
let timer: number | undefined
async function load() {
  loading.value = true
  users.value = await services.users.list(search.value)
  loading.value = false
}
watch(search, () => {
  window.clearTimeout(timer)
  timer = window.setTimeout(load, 180)
})
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
        ><input id="user-search" v-model.trim="search" placeholder="Account, name, email, role" />
      </div>
    </div>
    <div v-if="loading" class="empty-state">{{ t('common.loading') }}</div>
    <EmptyState v-else-if="!users.length" :title="t('common.noData')" />
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
          <tr v-for="user in users" :key="user.id">
            <td class="table-title">{{ user.account }}</td>
            <td>{{ user.displayName }}</td>
            <td>{{ user.email }}</td>
            <td><StatusBadge :value="user.role" /></td>
            <td>{{ user.isVerified ? '✓' : '—' }}</td>
            <td><StatusBadge :value="user.isEnabled ? 'Active' : 'Disabled'" /></td>
            <td>
              <RouterLink class="link" :to="{ name: 'user-detail', params: { userId: user.id } }">{{
                auth.isAdmin ? t('common.edit') : t('user.detail')
              }}</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
