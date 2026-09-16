import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError, type CurrentUser, type Project, type TaskItem } from '@/types/models'
import TaskListView from '@/views/tasks/TaskListView.vue'

const serviceMocks = vi.hoisted(() => ({
  projects: { get: vi.fn() },
  preferences: { get: vi.fn() },
  tasks: { list: vi.fn(), batchUpdate: vi.fn(), remove: vi.fn() },
}))

vi.mock('@/services', () => ({ services: serviceMocks }))

const currentUser: CurrentUser = {
  id: 'user-1',
  account: 'user1',
  displayName: 'User One',
  email: 'user1@example.test',
  role: 'User',
  isVerified: true,
  isEnabled: true,
  functions: ['projects.read', 'tasks.read', 'tasks.update-assigned'],
}

const project: Project = {
  id: 'project-1',
  code: 'PRJ-001',
  name: '測試專案',
  description: '測試',
  ownerId: 'owner-1',
  timeZoneId: 'Asia/Taipei',
  status: 'Active',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  versionNumber: 1,
  rowVersion: 'AAAA',
  members: [
    { userId: 'user-1', account: 'user1', displayName: 'User One', roles: [] },
    { userId: 'user-2', account: 'user2', displayName: 'User Two', roles: [] },
  ],
}

const tasks: TaskItem[] = [
  {
    id: 'task-1',
    code: 'TASK-001',
    projectId: 'project-1',
    title: '自己的 Task',
    description: '可修改',
    creatorId: 'owner-1',
    assigneeId: 'user-1',
    startAt: '2026-09-01T00:00:00Z',
    deadline: '2026-09-05T00:00:00Z',
    status: 'Pending',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    rowVersion: 'AAAA',
  },
  {
    id: 'task-2',
    code: 'TASK-002',
    projectId: 'project-1',
    title: '別人的 Task',
    description: '唯讀',
    creatorId: 'owner-1',
    assigneeId: 'user-2',
    startAt: '2026-09-01T00:00:00Z',
    deadline: '2026-09-06T00:00:00Z',
    status: 'Pending',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    rowVersion: 'BBBB',
  },
]

async function mountView(
  skipBatchConfirmation = false,
  taskRows: TaskItem[] = tasks,
  user: CurrentUser = currentUser,
  initialPath = '/projects/project-1/task-items',
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = user
  serviceMocks.projects.get.mockResolvedValue(project)
  serviceMocks.preferences.get.mockResolvedValue({ skipBatchConfirmation })
  serviceMocks.tasks.list.mockResolvedValue({
    items: taskRows,
    page: 1,
    pageSize: 8,
    totalCount: taskRows.length,
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:projectId/task-items', name: 'task-list', component: TaskListView },
      { path: '/projects/:projectId', name: 'project-detail', component: { template: '<div />' } },
      {
        path: '/projects/:projectId/task-items/new',
        name: 'task-new',
        component: { template: '<div />' },
      },
      {
        path: '/projects/:projectId/task-items/:taskId',
        name: 'task-detail',
        component: { template: '<div />' },
      },
      {
        path: '/projects/:projectId/task-items/:taskId/edit',
        name: 'task-edit',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push(initialPath)
  await router.isReady()
  const wrapper = mount(TaskListView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('TaskListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.tasks.batchUpdate.mockResolvedValue(1)
  })

  // 測試案例：TC-F-TASK-001、TC-F-TASK-002、TC-ERR-TASK-005（欄位、預設查詢、空資料與拒絕存取）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('呈現完整清單欄位與預設排序並安全處理空資料及拒絕存取', async () => {
    const populated = await mountView()

    expect(serviceMocks.tasks.list).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        search: '',
        status: '',
        assigneeId: '',
        mineOnly: false,
        sort: 'newest',
        page: 1,
        pageSize: 8,
      }),
    )
    const headers = populated.findAll('thead th').map((header) => header.text())
    expect(headers).toEqual([
      '',
      'Task 編號',
      '標題',
      '交付期限',
      '狀態',
      '建立者',
      '指派對象',
      '操作',
    ])
    const rows = populated.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('TASK-001')
    expect(rows[0]!.text()).toContain('自己的 Task')
    expect(rows[0]!.text()).toContain('Pending')
    expect(rows[0]!.text()).toContain('User One')
    expect(rows[1]!.text()).toContain('TASK-002')
    expect(populated.text()).toContain('2 tasks · 1/1')
    populated.unmount()

    const empty = await mountView(false, [])
    expect(empty.find('tbody').exists()).toBe(false)
    expect(empty.find('.empty-state').exists()).toBe(true)
    empty.unmount()

    serviceMocks.tasks.list.mockRejectedValueOnce(new ApiError(403, '你沒有讀取此專案的權限'))
    const denied = await mountView()
    expect(denied.get('.alert').text()).toContain('你沒有讀取此專案的權限')
    expect(denied.find('tbody').exists()).toBe(false)
  })

  // 測試案例：TC-F-TASK-006（checkbox 權限、全選、Viewer、切頁與重新掛載後不持久化）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('只允許選取可修改的 Task 並在切頁或重新掛載後清除', async () => {
    const first = await mountView()
    const ownTask = first.get('input[aria-label="Select 自己的 Task"]')
    const otherTask = first.get('input[aria-label="Select 別人的 Task"]')

    expect(ownTask.attributes('disabled')).toBeUndefined()
    expect(otherTask.attributes('disabled')).toBeDefined()
    await first.get('input[aria-label="Select all editable tasks"]').setValue(true)
    expect((ownTask.element as HTMLInputElement).checked).toBe(true)
    expect(first.get('button.button.primary').text()).toContain('1')

    first.unmount()
    const second = await mountView()
    expect(
      (second.get('input[aria-label="Select 自己的 Task"]').element as HTMLInputElement).checked,
    ).toBe(false)

    const viewer = await mountView(false, tasks, {
      ...currentUser,
      id: 'viewer-1',
      role: 'Viewer',
      functions: ['projects.read', 'tasks.read'],
    })
    expect(
      viewer
        .findAll('tbody input[type="checkbox"]')
        .every((input) => input.attributes('disabled') !== undefined),
    ).toBe(true)
    viewer.unmount()

    const twoPageTasks = Array.from({ length: 9 }, (_, index): TaskItem => ({
      ...tasks[0]!,
      id: `page-task-${index + 1}`,
      code: `TASK-PAGE-${index + 1}`,
      title: `分頁 Task ${index + 1}`,
      rowVersion: `PAGE-VERSION-${index + 1}`,
    }))
    const paged = await mountView(false, twoPageTasks)
    await paged.get('input[aria-label="Select 分頁 Task 1"]').setValue(true)
    expect(paged.get('button.button.primary').text()).toContain('1')
    await paged.findAll('.pagination button')[1]!.trigger('click')
    await flushPromises()
    expect(paged.get('button.button.primary').text()).toContain('0')
    expect(paged.get('button.button.primary').attributes('disabled')).toBeDefined()
  })

  // 測試案例：TC-E-TASK-007（0 筆選取時禁止送出，目標狀態預設 InProgress）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('未選取 Task 時停用確認且不送出批次請求', async () => {
    const wrapper = await mountView()

    expect(wrapper.get('#target-status').element).toHaveProperty('value', 'InProgress')
    const confirmButton = wrapper.get('button.button.primary')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    await confirmButton.trigger('click')
    expect(serviceMocks.tasks.batchUpdate).not.toHaveBeenCalled()

    const taskCheckbox = wrapper.get('input[aria-label="Select 自己的 Task"]')
    await taskCheckbox.setValue(true)
    expect(confirmButton.attributes('disabled')).toBeUndefined()
    await taskCheckbox.setValue(false)
    expect(confirmButton.attributes('disabled')).toBeDefined()
  })

  // 測試案例：TC-ST-TASK-018（確認取消與偏好略過合併於同一測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('依批次確認偏好決定取消或直接送出', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const requiringConfirmation = await mountView(false)
    await requiringConfirmation.get('input[aria-label="Select 自己的 Task"]').setValue(true)
    await requiringConfirmation.get('button.button.primary').trigger('click')
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(serviceMocks.tasks.batchUpdate).not.toHaveBeenCalled()
    requiringConfirmation.unmount()

    confirmSpy.mockReset().mockReturnValue(true)
    const confirmed = await mountView(false)
    await confirmed.get('input[aria-label="Select 自己的 Task"]').setValue(true)
    await confirmed.get('button.button.primary').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(serviceMocks.tasks.batchUpdate).toHaveBeenCalledWith(
      'project-1',
      [expect.objectContaining({ id: 'task-1' })],
      'InProgress',
    )
    confirmed.unmount()

    confirmSpy.mockClear()
    serviceMocks.tasks.batchUpdate.mockClear()
    const skippingConfirmation = await mountView(true)
    await skippingConfirmation.get('input[aria-label="Select 自己的 Task"]').setValue(true)
    await skippingConfirmation.get('button.button.primary').trigger('click')
    await flushPromises()

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(serviceMocks.tasks.batchUpdate).toHaveBeenCalledWith(
      'project-1',
      [expect.objectContaining({ id: 'task-1' })],
      'InProgress',
    )
    expect(
      (
        skippingConfirmation.get('input[aria-label="Select 自己的 Task"]')
          .element as HTMLInputElement
      ).checked,
    ).toBe(false)
  })

  // 測試案例：TC-ERR-TASK-016（批次失敗保留畫面、選取與後端錯誤）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('批次更新失敗時保留清單與選取並顯示錯誤', async () => {
    serviceMocks.tasks.batchUpdate.mockRejectedValue(
      new ApiError(409, '資料已被其他人更新，請重新載入。', {}, 'concurrency_conflict'),
    )
    const wrapper = await mountView(true)
    serviceMocks.tasks.list.mockClear()
    const checkbox = wrapper.get('input[aria-label="Select 自己的 Task"]')

    await checkbox.setValue(true)
    await wrapper.get('button.button.primary').trigger('click')
    await flushPromises()

    expect(wrapper.get('.alert').text()).toContain('資料已被其他人更新')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).toContain('自己的 Task')
    expect(serviceMocks.tasks.list).not.toHaveBeenCalled()
  })

  // 測試案例：TC-ERR-TASK-017（超過 10 筆保留選取、停用送出且不得截斷）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('選取超過十筆時保留選取並停用送出直到回到上限內', async () => {
    const elevenTasks = Array.from({ length: 11 }, (_, index): TaskItem => ({
      ...tasks[0]!,
      id: `batch-task-${index + 1}`,
      code: `TASK-BATCH-${index + 1}`,
      title: `批次 Task ${index + 1}`,
      rowVersion: `VERSION-${index + 1}`,
    }))
    serviceMocks.tasks.batchUpdate.mockResolvedValue(10)
    const wrapper = await mountView(true, elevenTasks)

    for (const checkbox of wrapper.findAll('tbody input[type="checkbox"]')) {
      await checkbox.setValue(true)
    }
    const confirmButton = wrapper.get('button.button.primary')
    expect(confirmButton.text()).toContain('11')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('10')
    await confirmButton.trigger('click')
    expect(serviceMocks.tasks.batchUpdate).not.toHaveBeenCalled()

    await wrapper.get('input[aria-label="Select 批次 Task 1"]').setValue(false)
    expect(confirmButton.text()).toContain('10')
    expect(confirmButton.attributes('disabled')).toBeUndefined()
    await confirmButton.trigger('click')
    await flushPromises()

    expect(serviceMocks.tasks.batchUpdate).toHaveBeenCalledOnce()
    const submittedTasks = serviceMocks.tasks.batchUpdate.mock.calls[0]![1] as TaskItem[]
    expect(submittedTasks).toHaveLength(10)
    expect(submittedTasks.map((task) => task.id)).not.toContain('batch-task-1')
  })

  // 測試案例：TC-F-TASK-002、TC-ST-TASK-003（交集 query、詳情返回與重新掛載合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('由 URL 還原清單條件且詳情連結完整保留 query', async () => {
    const path =
      '/projects/project-1/task-items?search=自己&status=Pending&assigneeId=user-1&mineOnly=true&sort=oldest&page=2'
    const wrapper = await mountView(false, tasks, currentUser, path)

    expect(wrapper.get<HTMLInputElement>('#task-search').element.value).toBe('自己')
    expect(wrapper.get<HTMLSelectElement>('#task-status').element.value).toBe('Pending')
    expect(wrapper.get<HTMLSelectElement>('#task-assignee').element.value).toBe('user-1')
    expect(wrapper.get<HTMLInputElement>('.check-field input').element.checked).toBe(true)
    expect(wrapper.get<HTMLSelectElement>('#task-sort').element.value).toBe('oldest')
    expect(serviceMocks.tasks.list).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        search: '自己',
        status: 'Pending',
        assigneeId: 'user-1',
        mineOnly: true,
        sort: 'oldest',
        page: 2,
      }),
    )

    const detailHref = wrapper.get('a.table-title').attributes('href')
    expect(detailHref).toContain('/projects/project-1/task-items/task-1?')
    for (const pair of [
      'search=%E8%87%AA%E5%B7%B1',
      'status=Pending',
      'assigneeId=user-1',
      'mineOnly=true',
      'sort=oldest',
      'page=2',
    ]) {
      expect(detailHref).toContain(pair)
    }

    wrapper.unmount()
    const reloaded = await mountView(false, tasks, currentUser, path)
    expect(reloaded.get<HTMLInputElement>('#task-search').element.value).toBe('自己')
    expect(reloaded.text()).toContain('2/1')
  })

  // 測試案例：TC-ST-TASK-020（取消、403／409／5xx 失敗與成功流程合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:13:34 +08:00
  it('刪除 Task 取消不送出、各類失敗保留清單且成功才重新載入', async () => {
    const admin: CurrentUser = {
      ...currentUser,
      role: 'Admin',
      functions: ['projects.read', 'tasks.read', 'tasks.update-any', 'tasks.delete'],
    }
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const cancelled = await mountView(false, tasks, admin)
    const cancelledButton = cancelled
      .findAll('button.link')
      .find((button) => button.text() === '刪除')!

    await cancelledButton.trigger('click')
    expect(serviceMocks.tasks.remove).not.toHaveBeenCalled()
    expect(confirmSpy.mock.calls[0]![0]).toContain('自己的 Task')
    expect(confirmSpy.mock.calls[0]![0]).toContain('一般清單')
    cancelled.unmount()

    confirmSpy.mockReturnValue(true)
    for (const [status, message] of [
      [403, '你沒有執行此操作的權限'],
      [409, '資料已被其他人更新，請重新載入'],
      [500, '伺服器暫時無法處理'],
    ] as const) {
      serviceMocks.tasks.remove.mockRejectedValueOnce(new ApiError(status, message))
      const failed = await mountView(false, tasks, admin)
      const removeButton = failed.findAll('button.link').find((button) => button.text() === '刪除')!
      await removeButton.trigger('click')
      await flushPromises()
      expect(failed.text()).toContain('自己的 Task')
      expect(failed.get('.alert').text()).toContain(message)
      failed.unmount()
    }

    serviceMocks.tasks.remove.mockResolvedValueOnce(undefined)
    const succeeded = await mountView(false, tasks, admin)
    serviceMocks.tasks.list.mockClear()
    const removeButton = succeeded
      .findAll('button.link')
      .find((button) => button.text() === '刪除')!
    await removeButton.trigger('click')
    await flushPromises()
    expect(serviceMocks.tasks.list).toHaveBeenCalledOnce()
    expect(useUiStore().toast).toBe('資料已刪除')
  })
})
