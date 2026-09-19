<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  ApiError,
  type PageResult,
  type RoleOption,
  type SystemRole,
  type User,
  type UserQuery,
} from '@/types/models'
const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const query = reactive<UserQuery>({ search: '', role: '', page: 1, pageSize: 20 })
const result = ref<PageResult<User>>({ items: [], page: 1, pageSize: 20, totalCount: 0 })
const roles: SystemRole[] = ['Admin', 'Administrator', 'User', 'Viewer']
const roleOptions = ref<RoleOption[]>([])
const pages = computed(() => Math.max(1, Math.ceil(result.value.totalCount / query.pageSize)))
const loading = ref(true)
const error = ref('')
const updatingUserIds = ref(new Set<string>())
let timer: number | undefined

function excludeBootstrapAdmin(page: PageResult<User>): PageResult<User> {
  const items = page.items.filter((user) => !user.isBootstrapAdmin)
  const hiddenCount = page.items.length - items.length
  return {
    ...page,
    items,
    totalCount: Math.max(0, page.totalCount - hiddenCount),
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    result.value = excludeBootstrapAdmin(await services.users.list(query))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Load failed'
  } finally {
    loading.value = false
  }
}

async function initialize() {
  loading.value = true
  error.value = ''
  try {
    const [users, availableRoles] = await Promise.all([
      services.users.list(query),
      services.users.roles(),
    ])
    result.value = excludeBootstrapAdmin(users)
    roleOptions.value = availableRoles
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Load failed'
  } finally {
    loading.value = false
  }
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

function roleId(user: User): string {
  return roleOptions.value.find((role) => role.name === user.role)?.id ?? ''
}

function isUpdating(user: User): boolean {
  return updatingUserIds.value.has(user.id)
}

function canManage(user: User): boolean {
  return (
    !user.isBootstrapAdmin &&
    auth.hasFunction('accounts.manage-role') &&
    auth.hasFunction('accounts.manage-status')
  )
}

async function updateAdministration(user: User, selectedRoleId: string, isEnabled: boolean) {
  if (!canManage(user) || isUpdating(user) || !selectedRoleId) return

  updatingUserIds.value = new Set(updatingUserIds.value).add(user.id)
  error.value = ''
  try {
    const updated = await services.users.updateAdministration(user.id, selectedRoleId, isEnabled)
    result.value = {
      ...result.value,
      items: result.value.items.map((item) => (item.id === updated.id ? updated : item)),
    }
    ui.notify(t('message.saved'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Save failed'
  } finally {
    const next = new Set(updatingUserIds.value)
    next.delete(user.id)
    updatingUserIds.value = next
  }
}

function changeRole(user: User, event: Event) {
  const selectedRoleId = (event.target as HTMLSelectElement).value
  void updateAdministration(user, selectedRoleId, user.isEnabled)
}

function toggleStatus(user: User) {
  void updateAdministration(user, roleId(user), !user.isEnabled)
}

onMounted(initialize)
</script>
<template>
  <PageHeader
    eyebrow="Directory"
    :title="t('user.title')"
    description="Manage system roles and account status directly from the user list."
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
    <div v-if="error" class="alert" role="alert">{{ error }}</div>
    <div v-else-if="loading" class="empty-state">{{ t('common.loading') }}</div>
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
            <td>
              <select
                class="table-role-select"
                :value="roleId(user)"
                :aria-label="t('user.roleFor', { account: user.account })"
                :title="user.isBootstrapAdmin ? t('user.bootstrapAdminProtected') : undefined"
                :disabled="!canManage(user) || isUpdating(user)"
                @change="changeRole(user, $event)"
              >
                <option v-for="role in roleOptions" :key="role.id" :value="role.id">
                  {{ role.name }}
                </option>
              </select>
            </td>
            <td>{{ user.isVerified ? '✓' : '—' }}</td>
            <td>
              <button
                type="button"
                class="account-status-toggle"
                :class="{ active: user.isEnabled }"
                :aria-pressed="user.isEnabled"
                :aria-label="t('user.statusFor', { account: user.account })"
                :title="user.isBootstrapAdmin ? t('user.bootstrapAdminProtected') : undefined"
                :disabled="!canManage(user) || isUpdating(user)"
                @click="toggleStatus(user)"
              >
                <span class="toggle-track" aria-hidden="true"><span /></span>
                <span>{{ user.isEnabled ? t('common.active') : t('common.disabled') }}</span>
              </button>
            </td>
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

<style scoped>
.table-role-select {
  width: 142px;
  min-height: 38px;
  border: 1px solid var(--slate-300);
  border-radius: 9px;
  padding: 7px 30px 7px 10px;
  color: var(--slate-950);
  background: white;
  font: inherit;
}

.table-role-select:disabled {
  color: var(--slate-500);
  background: var(--slate-100);
  cursor: not-allowed;
}

.account-status-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 98px;
  min-height: 38px;
  border: 0;
  padding: 0;
  color: var(--slate-500);
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.toggle-track {
  position: relative;
  display: inline-flex;
  width: 42px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--slate-300);
  transition: background-color 0.18s ease;
}

.toggle-track span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgb(15 23 42 / 25%);
  transition: transform 0.18s ease;
}

.account-status-toggle.active {
  color: #0f6d59;
}

.account-status-toggle.active .toggle-track {
  background: #22a17f;
}

.account-status-toggle.active .toggle-track span {
  transform: translateX(18px);
}

.account-status-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.table-role-select:focus-visible,
.account-status-toggle:focus-visible {
  outline: 3px solid rgb(79 70 229 / 22%);
  outline-offset: 2px;
}
</style>
