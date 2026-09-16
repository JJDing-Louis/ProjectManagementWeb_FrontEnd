import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/types/models'
import TaskFormView from '@/views/tasks/TaskFormView.vue'

const serviceMocks = vi.hoisted(() => ({
  projects: { get: vi.fn() },
  tasks: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateAssigned: vi.fn(),
  },
}))

const project = {
  id: 'project-1',
  code: 'PRJ-202609150001',
  name: '測試專案',
  description: '',
  ownerId: 'member-1',
  timeZoneId: 'Asia/Taipei',
  status: 'Active' as const,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  versionNumber: 1,
  rowVersion: 'PROJECT-RV',
  members: [
    {
      userId: 'member-1',
      account: 'member',
      displayName: 'Member',
      roles: [{ id: 'member-role', code: 'Member' as const, name: 'Member' }],
    },
  ],
}

const task = {
  id: 'task-1',
  code: 'TASK-202609150001',
  projectId: 'project-1',
  title: '原始 Task',
  description: '原始說明',
  creatorId: 'admin-1',
  assigneeId: 'member-1',
  startAt: '2026-09-16T01:00:00.000Z',
  deadline: '2026-09-17T09:00:00.000Z',
  status: 'Pending' as const,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  rowVersion: 'TASK-RV',
}

vi.mock('@/services', () => ({ services: serviceMocks }))

async function mountView(
  path = '/admin/projects/project-1/task-items/new',
  functions = ['tasks.create', 'tasks.update-any'],
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 'admin-1',
    account: 'admin',
    displayName: 'Admin',
    email: 'admin@example.test',
    role: 'Admin',
    isVerified: true,
    isEnabled: true,
    functions,
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/admin/projects/:projectId/task-items/new',
        name: 'task-new',
        component: TaskFormView,
      },
      {
        path: '/admin/projects/:projectId/task-items/:taskId/edit',
        name: 'task-edit',
        component: TaskFormView,
      },
      {
        path: '/projects/:projectId/task-items/:taskId',
        name: 'task-detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(TaskFormView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return { router, wrapper }
}

describe('TaskFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.projects.get.mockResolvedValue(project)
    serviceMocks.tasks.get.mockResolvedValue(task)
  })

  // 測試案例：TC-F-UI-002（Task 表單 loading／error 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('初始化失敗時顯示錯誤且不顯示未載入的表單', async () => {
    serviceMocks.projects.get.mockRejectedValue(new ApiError(503, 'Task 表單暫時無法載入。'))

    const { wrapper } = await mountView()

    expect(wrapper.get('[role="alert"]').text()).toBe('Task 表單暫時無法載入。')
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('載入中')
  })

  // 測試案例：TC-F-TASK-008、TC-ERR-TASK-009
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('新增 Task 固定使用 Pending 並將合法表單送至詳情頁', async () => {
    serviceMocks.tasks.create.mockResolvedValue({ ...task, id: 'task-new' })
    const { router, wrapper } = await mountView()
    await wrapper.get('#task-title').setValue('  新 Task  ')
    await wrapper.get('#task-form-assignee').setValue('member-1')
    await wrapper.get('#task-start').setValue('2026-09-16T09:00')
    await wrapper.get('#task-deadline').setValue('2026-09-17T17:00')
    await wrapper.get('#task-description').setValue('  說明  ')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(serviceMocks.tasks.create).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        title: '新 Task',
        description: '說明',
        assigneeId: 'member-1',
        status: 'Pending',
      }),
    )
    expect(router.currentRoute.value).toMatchObject({
      name: 'task-detail',
      params: { projectId: 'project-1', taskId: 'task-new' },
    })
  })

  // 測試案例：TC-F-TASK-010、TC-F-TASK-021、TC-ERR-TASK-022
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('後台編輯會預填完整 Task 並連同最新版 rowVersion 更新所有欄位', async () => {
    serviceMocks.tasks.update.mockResolvedValue({ ...task, title: '修改後 Task' })
    const { wrapper } = await mountView('/admin/projects/project-1/task-items/task-1/edit')

    expect(wrapper.get<HTMLInputElement>('#task-title').element.value).toBe('原始 Task')
    expect(wrapper.get<HTMLTextAreaElement>('#task-description').element.value).toBe('原始說明')
    expect(wrapper.get<HTMLSelectElement>('#task-form-assignee').element.value).toBe('member-1')
    expect(wrapper.get<HTMLInputElement>('#task-start').element.value).toBe('2026-09-16T01:00')
    expect(wrapper.get<HTMLInputElement>('#task-deadline').element.value).toBe('2026-09-17T09:00')

    await wrapper.get('#task-title').setValue('修改後 Task')
    await wrapper.get('#task-form-status').setValue('Completed')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(serviceMocks.tasks.update).toHaveBeenCalledWith(
      'project-1',
      'task-1',
      expect.objectContaining({
        title: '修改後 Task',
        status: 'Completed',
        rowVersion: 'TASK-RV',
      }),
    )
  })

  // 測試案例：TC-F-TASK-011、TC-ERR-TASK-012
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('被指派者只能編輯 deadline 與 status 並使用受限更新 API', async () => {
    serviceMocks.tasks.updateAssigned.mockResolvedValue({
      ...task,
      deadline: '2026-09-18T09:00:00.000Z',
      status: 'InProgress',
    })
    const { wrapper } = await mountView('/admin/projects/project-1/task-items/task-1/edit', [
      'tasks.update-assigned',
    ])

    for (const selector of [
      '#task-title',
      '#task-form-assignee',
      '#task-start',
      '#task-description',
    ]) {
      expect(wrapper.get(selector).attributes('disabled')).toBeDefined()
    }
    expect(wrapper.get('#task-deadline').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('#task-form-status').attributes('disabled')).toBeUndefined()

    await wrapper.get('#task-deadline').setValue('2026-09-18T17:00')
    await wrapper.get('#task-form-status').setValue('InProgress')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(serviceMocks.tasks.updateAssigned).toHaveBeenCalledWith(
      'project-1',
      'task-1',
      expect.objectContaining({
        deadline: expect.any(String),
        status: 'InProgress',
        rowVersion: 'TASK-RV',
      }),
    )
    expect(serviceMocks.tasks.update).not.toHaveBeenCalled()
  })

  // 測試案例：TC-F-UI-002（Task 表單 submitting 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Task 儲存期間停用按鈕並禁止重複送出', async () => {
    let resolveUpdate!: (value: typeof task) => void
    serviceMocks.tasks.update.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )
    const { wrapper } = await mountView('/admin/projects/project-1/task-items/task-1/edit')
    const submitButton = wrapper.get('form button.primary')

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(serviceMocks.tasks.update).toHaveBeenCalledOnce()
    expect(submitButton.attributes('disabled')).toBeDefined()
    resolveUpdate(task)
    await flushPromises()
  })

  // 測試案例：TC-ERR-TASK-014、TC-ERR-TASK-022
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Task 更新衝突時保留完整輸入並顯示可重試錯誤', async () => {
    serviceMocks.tasks.update.mockRejectedValue(
      new ApiError(409, '資料已被其他人更新，請重新載入。', {}, 'concurrency_conflict'),
    )
    const { wrapper } = await mountView('/admin/projects/project-1/task-items/task-1/edit')
    const title = wrapper.get<HTMLInputElement>('#task-title')
    await title.setValue('尚未送出的 Task 標題')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('資料已被其他人更新，請重新載入。')
    expect(title.element.value).toBe('尚未送出的 Task 標題')
    expect(wrapper.find('form').exists()).toBe(true)
  })
})
