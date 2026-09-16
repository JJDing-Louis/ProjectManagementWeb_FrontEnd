import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { ApiError } from '@/types/models'
import ProjectFormView from '@/views/projects/ProjectFormView.vue'

const serviceMocks = vi.hoisted(() => ({
  projects: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  users: { listAll: vi.fn() },
}))

const project = {
  id: 'project-1',
  code: 'PRJ-202609150001',
  name: '原始 Project',
  description: '原始說明',
  ownerId: 'owner-1',
  timeZoneId: 'Asia/Taipei',
  status: 'Active' as const,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  versionNumber: 2,
  rowVersion: 'PROJECT-RV',
  members: [
    {
      userId: 'owner-1',
      account: 'owner',
      displayName: '原 Owner',
      roles: [{ id: 'pm-role', code: 'ProjectManager' as const, name: 'ProjectManager' }],
    },
    {
      userId: 'owner-2',
      account: 'owner2',
      displayName: '新 Owner',
      roles: [{ id: 'member-role', code: 'Member' as const, name: 'Member' }],
    },
  ],
}

vi.mock('@/services', () => ({ services: serviceMocks }))

async function mountView(path = '/admin/projects/new') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/projects/new', name: 'project-new', component: ProjectFormView },
      {
        path: '/admin/projects/:projectId/edit',
        name: 'project-edit',
        component: ProjectFormView,
      },
      {
        path: '/projects/:projectId',
        name: 'project-detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(ProjectFormView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return { router, wrapper }
}

describe('ProjectFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.projects.get.mockResolvedValue(project)
    serviceMocks.users.listAll.mockResolvedValue([])
  })

  // 測試案例：TC-F-UI-002（Project 表單 loading／error 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('初始化失敗時顯示錯誤且不顯示未載入的表單', async () => {
    serviceMocks.users.listAll.mockRejectedValue(new ApiError(503, 'Project 表單暫時無法載入。'))

    const { wrapper } = await mountView()

    expect(wrapper.get('[role="alert"]').text()).toBe('Project 表單暫時無法載入。')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('載入中')
  })

  // 測試案例：TC-F-PRJ-003、TC-ERR-PRJ-004（Owner 候選資格）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('新增 Project 只列出已啟用且已驗證的 Administrator Owner', async () => {
    const baseUser = {
      id: 'eligible',
      account: 'eligible',
      displayName: '合格 Owner',
      email: 'eligible@example.test',
      role: 'Administrator' as const,
      isVerified: true,
      isEnabled: true,
    }
    serviceMocks.users.listAll.mockResolvedValue([
      baseUser,
      { ...baseUser, id: 'admin', displayName: 'Admin 不合格', role: 'Admin' },
      { ...baseUser, id: 'user', displayName: 'User 不合格', role: 'User' },
      { ...baseUser, id: 'unverified', displayName: '未驗證', isVerified: false },
      { ...baseUser, id: 'disabled', displayName: '已停用', isEnabled: false },
    ])

    const { wrapper } = await mountView()
    const options = wrapper.findAll('#project-owner option')

    expect(options.map((option) => option.text())).toEqual(['Select owner', '合格 Owner'])
  })

  // 測試案例：TC-F-PRJ-003（建立 Project）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('新增 Project 固定使用 Pending 並在成功後導向詳情頁', async () => {
    serviceMocks.users.listAll.mockResolvedValue([
      {
        id: 'owner-1',
        account: 'owner',
        displayName: 'Owner',
        email: 'owner@example.test',
        role: 'Administrator',
        isVerified: true,
        isEnabled: true,
      },
    ])
    serviceMocks.projects.create.mockResolvedValue({ ...project, status: 'Pending' })
    const { router, wrapper } = await mountView()

    await wrapper.get('#project-name').setValue('  新 Project  ')
    await wrapper.get('#project-owner').setValue('owner-1')
    await wrapper.get('#project-time-zone').setValue('Asia/Taipei')
    await wrapper.get('#project-description').setValue('  新說明  ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(serviceMocks.projects.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '新 Project',
        description: '新說明',
        ownerId: 'owner-1',
        timeZoneId: 'Asia/Taipei',
        status: 'Pending',
      }),
    )
    expect(router.currentRoute.value).toMatchObject({
      name: 'project-detail',
      params: { projectId: 'project-1' },
    })
  })

  // 測試案例：TC-ST-PRJ-006、TC-ERR-PRJ-007
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('編輯 Project 預填完整資料並連同最新版 rowVersion 更新', async () => {
    serviceMocks.projects.update.mockResolvedValue({ ...project, name: '修改後 Project' })
    const { wrapper } = await mountView('/admin/projects/project-1/edit')

    expect(wrapper.get<HTMLInputElement>('#project-name').element.value).toBe('原始 Project')
    expect(wrapper.get<HTMLTextAreaElement>('#project-description').element.value).toBe('原始說明')
    expect(wrapper.get<HTMLSelectElement>('#project-owner').element.value).toBe('owner-1')
    expect(wrapper.get<HTMLSelectElement>('#project-time-zone').element.value).toBe('Asia/Taipei')
    expect(wrapper.get<HTMLSelectElement>('#project-form-status').element.value).toBe('Active')

    await wrapper.get('#project-name').setValue('修改後 Project')
    await wrapper.get('#project-owner').setValue('owner-2')
    await wrapper.get('#project-time-zone').setValue('America/New_York')
    await wrapper.get('#project-form-status').setValue('Completed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(serviceMocks.projects.update).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        name: '修改後 Project',
        ownerId: 'owner-2',
        timeZoneId: 'America/New_York',
        status: 'Completed',
        rowVersion: 'PROJECT-RV',
      }),
    )
  })

  // 測試案例：TC-F-UI-002（Project 表單 submitting 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Project 儲存期間停用按鈕並禁止重複送出', async () => {
    let resolveUpdate!: (value: typeof project) => void
    serviceMocks.projects.update.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )
    const { wrapper } = await mountView('/admin/projects/project-1/edit')
    const submitButton = wrapper.get('form button.primary')

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(serviceMocks.projects.update).toHaveBeenCalledOnce()
    expect(submitButton.attributes('disabled')).toBeDefined()
    resolveUpdate(project)
    await flushPromises()
  })

  // 測試案例：TC-ERR-PRJ-007（Project rowVersion 衝突）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Project 更新衝突時保留完整輸入並顯示可重試錯誤', async () => {
    serviceMocks.projects.update.mockRejectedValue(
      new ApiError(409, '資料已被其他人更新，請重新載入。', {}, 'concurrency_conflict'),
    )
    const { wrapper } = await mountView('/admin/projects/project-1/edit')
    const name = wrapper.get<HTMLInputElement>('#project-name')
    await name.setValue('尚未送出的 Project 名稱')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('資料已被其他人更新，請重新載入。')
    expect(name.element.value).toBe('尚未送出的 Project 名稱')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
