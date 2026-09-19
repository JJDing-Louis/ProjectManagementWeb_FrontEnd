import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { ApiError, type User } from '@/types/models'
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

const filteredUser = {
  ...regularAdministrator,
  id: 'alice-id',
  account: 'alice',
  displayName: 'Alice',
  email: 'alice@example.test',
  role: 'User' as const,
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

async function mountUserDetail(
  target: User = regularAdministrator,
  functions = ['accounts.manage-role'],
) {
  userService.get.mockResolvedValue(target)
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    ...regularAdministrator,
    id: 'operator-id',
    account: 'operator',
    functions,
  }
  const router = createTestRouter()
  await router.push(`/users/${target.id}`)
  await router.isReady()
  const wrapper = mount(UserDetailView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return wrapper
}

async function mountUserList(
  functions = ['accounts.manage-role', 'accounts.manage-status', 'accounts.read'],
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    ...regularAdministrator,
    id: 'operator-id',
    account: 'operator',
    functions,
  }
  const router = createTestRouter()
  await router.push('/users')
  await router.isReady()
  const wrapper = mount(UserListView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('Bootstrap Admin 前端保護', () => {
  // 測試案例：TC-ERR-USER-006（Frontend UI；部分覆蓋）
  // 測試結果：Passed（2 tests）
  // 上次測試時間：2026-09-15 15:34:06 +08:00
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
      { id: 'administrator-role', name: 'Administrator', functions: [] },
      { id: 'user-role', name: 'User', functions: [] },
      { id: 'viewer-role', name: 'Viewer', functions: [] },
    ])
  })

  it('使用者列表鎖定系統預設 Admin 的角色與狀態控制項', async () => {
    const wrapper = await mountUserList()

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]?.find('a').exists()).toBe(false)
    expect(rows[0]?.text()).toContain('系統保護')
    expect(rows[0]?.get('select').attributes('disabled')).toBeDefined()
    expect(rows[0]?.get('button').attributes('disabled')).toBeDefined()
    expect(rows[1]?.get('a').text()).toBe('編輯')
    expect(rows[1]?.get('select').attributes('disabled')).toBeUndefined()
    expect(rows[1]?.get('button').attributes('disabled')).toBeUndefined()
  })

  // 測試案例：TC-F-UI-002（使用者清單 error 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('使用者清單載入失敗時顯示錯誤且不誤顯空狀態', async () => {
    userService.list.mockRejectedValueOnce(new ApiError(503, '使用者服務暫時無法使用。'))
    const wrapper = await mountUserList()

    expect(wrapper.get('[role="alert"]').text()).toBe('使用者服務暫時無法使用。')
    expect(wrapper.text()).not.toContain('沒有符合條件的資料')
    expect(wrapper.text()).not.toContain('載入中')
  })

  // 測試案例：TC-F-USER-001（搜尋、角色篩選、分頁與空狀態合併驗證）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('使用者清單可組合搜尋與角色篩選並正確切換分頁', async () => {
    vi.useFakeTimers()
    const requests: Array<{ search: string; role: string; page: number; pageSize: number }> = []
    userService.list.mockImplementation(async (query) => {
      requests.push({ ...query })
      if (query.search === 'alice' && query.role === 'User') {
        return { items: [filteredUser], page: 1, pageSize: 20, totalCount: 1 }
      }
      if (query.page === 2) {
        return { items: [regularAdministrator], page: 2, pageSize: 20, totalCount: 21 }
      }
      return { items: [bootstrapAdmin], page: 1, pageSize: 20, totalCount: 21 }
    })
    try {
      const wrapper = await mountUserList()

      await wrapper.findAll('.pagination button')[1]!.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('administrator@example.test')
      expect(wrapper.text()).toContain('2/2')

      await wrapper.get('#user-search').setValue('alice')
      await wrapper.get('#user-role').setValue('User')
      await vi.advanceTimersByTimeAsync(180)
      await flushPromises()

      expect(wrapper.text()).toContain('alice@example.test')
      expect(wrapper.text()).not.toContain('administrator@example.test')
      expect(requests[requests.length - 1]).toEqual({
        search: 'alice',
        role: 'User',
        page: 1,
        pageSize: 20,
      })
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('使用者列表可用下拉選單與 Toggle 即時更新角色及啟用狀態', async () => {
    userService.updateAdministration
      .mockResolvedValueOnce({ ...regularAdministrator, role: 'User' })
      .mockResolvedValueOnce({ ...regularAdministrator, role: 'User', isEnabled: false })
    const wrapper = await mountUserList()
    const row = wrapper.findAll('tbody tr')[1]!
    const roleSelect = row.get<HTMLSelectElement>('.table-role-select')
    const statusToggle = row.get<HTMLButtonElement>('.account-status-toggle')

    expect(roleSelect.element.value).toBe('administrator-role')
    expect(statusToggle.attributes('aria-pressed')).toBe('true')

    await roleSelect.setValue('user-role')
    await flushPromises()
    expect(userService.updateAdministration).toHaveBeenNthCalledWith(
      1,
      regularAdministrator.id,
      'user-role',
      true,
    )
    expect(roleSelect.element.value).toBe('user-role')

    await statusToggle.trigger('click')
    await flushPromises()
    expect(userService.updateAdministration).toHaveBeenNthCalledWith(
      2,
      regularAdministrator.id,
      'user-role',
      false,
    )
    expect(statusToggle.attributes('aria-pressed')).toBe('false')
    expect(statusToggle.text()).toContain('停用')
  })

  it('缺少完整帳號管理權限時停用列表內的角色與狀態控制項', async () => {
    const wrapper = await mountUserList(['accounts.read'])
    const regularRow = wrapper.findAll('tbody tr')[1]!

    expect(regularRow.get('select').attributes('disabled')).toBeDefined()
    expect(regularRow.get('button').attributes('disabled')).toBeDefined()
    expect(userService.updateAdministration).not.toHaveBeenCalled()
  })

  // 測試案例：TC-ST-USER-003、TC-E-USER-008、TC-F-USER-009
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Admin 只以單一表單更新系統角色與啟用狀態並保留個資唯讀', async () => {
    userService.updateAdministration.mockResolvedValue({
      ...regularAdministrator,
      role: 'User',
      isEnabled: false,
    })
    const wrapper = await mountUserDetail()

    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
    await wrapper.get('#role').setValue('user-role')
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(userService.updateAdministration).toHaveBeenCalledWith(
      regularAdministrator.id,
      'user-role',
      false,
    )
    expect(wrapper.text()).toContain('User')
  })

  // 測試案例：TC-ERR-USER-010
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('缺少帳號管理能力時只顯示唯讀資料且沒有管理表單', async () => {
    const wrapper = await mountUserDetail(regularAdministrator, ['accounts.read'])

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('你沒有執行此操作的權限')
    expect(userService.updateAdministration).not.toHaveBeenCalled()
  })

  // 測試案例：TC-ST-USER-003、TC-F-UI-002（submitting 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('帳號管理送出期間停用按鈕並禁止重複更新', async () => {
    let resolveUpdate!: (value: typeof regularAdministrator) => void
    userService.updateAdministration.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )
    const wrapper = await mountUserDetail()
    const submitButton = wrapper.get('form button')

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(userService.updateAdministration).toHaveBeenCalledOnce()
    expect(submitButton.attributes('disabled')).toBeDefined()
    resolveUpdate(regularAdministrator)
    await flushPromises()
    expect(submitButton.attributes('disabled')).toBeUndefined()
  })

  // 測試案例：TC-ERR-USER-004（未驗證帳號提升角色失敗）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('未驗證帳號提升角色被拒絕時保留表單並顯示業務錯誤', async () => {
    const unverifiedViewer = {
      ...regularAdministrator,
      id: 'viewer-id',
      account: 'viewer',
      role: 'Viewer' as const,
      isVerified: false,
    }
    userService.updateAdministration.mockRejectedValue(
      new ApiError(422, 'Email 尚未驗證，無法提升系統角色。'),
    )
    const wrapper = await mountUserDetail(unverifiedViewer)
    const roleSelect = wrapper.get<HTMLSelectElement>('#role')
    await roleSelect.setValue('admin-role')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Email 尚未驗證，無法提升系統角色。')
    expect(roleSelect.element.value).toBe('admin-role')
    expect(wrapper.find('form').exists()).toBe(true)
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
