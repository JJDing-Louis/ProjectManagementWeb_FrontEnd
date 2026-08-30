import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import UserDetailView from '@/views/users/UserDetailView.vue'
import UserListView from '@/views/users/UserListView.vue'

const userService = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  roles: vi.fn(),
  updateAdministration: vi.fn(),
}))

vi.mock('@/services', () => ({
  services: { users: userService },
}))

const bootstrapAdmin = {
  id: 'admin-id',
  account: 'admin',
  displayName: 'admin',
  email: 'admin@example.test',
  role: 'Admin' as const,
  isVerified: true,
  isEnabled: true,
  isBootstrapAdmin: true,
}

const regularAdministrator = {
  ...bootstrapAdmin,
  id: 'administrator-id',
  account: 'administrator',
  displayName: 'Administrator',
  email: 'administrator@example.test',
  role: 'Administrator' as const,
  isBootstrapAdmin: false,
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users', name: 'users', component: UserListView },
      { path: '/users/:userId', name: 'user-detail', component: UserDetailView },
    ],
  })
}

describe('Bootstrap Admin 前端保護', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userService.list.mockResolvedValue({
      items: [bootstrapAdmin, regularAdministrator],
      page: 1,
      pageSize: 20,
      totalCount: 2,
    })
    userService.get.mockResolvedValue(bootstrapAdmin)
    userService.roles.mockResolvedValue([
      { id: 'admin-role', name: 'Admin', functions: [] },
      { id: 'user-role', name: 'User', functions: [] },
    ])
  })

  it('使用者列表不顯示系統預設 Admin 的編輯入口', async () => {
    const router = createTestRouter()
    await router.push('/users')
    await router.isReady()
    const wrapper = mount(UserListView, { global: { plugins: [i18n, router] } })
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]?.find('a').exists()).toBe(false)
    expect(rows[0]?.text()).toContain('系統保護')
    expect(rows[1]?.get('a').text()).toBe('編輯')
  })

  it('即使直接開啟詳情頁也只顯示唯讀保護訊息', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.user = { ...bootstrapAdmin, functions: ['accounts.manage-role'] }
    const router = createTestRouter()
    await router.push('/users/admin-id')
    await router.isReady()
    const wrapper = mount(UserDetailView, { global: { plugins: [i18n, pinia, router] } })
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('系統預設 Admin 具備最高權限')
    expect(userService.updateAdministration).not.toHaveBeenCalled()
  })
})
