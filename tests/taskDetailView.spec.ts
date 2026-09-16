import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  ApiError,
  type CurrentUser,
  type Project,
  type TaskComment,
  type TaskItem,
} from '@/types/models'
import TaskDetailView from '@/views/tasks/TaskDetailView.vue'

const serviceMocks = vi.hoisted(() => ({
  projects: { get: vi.fn() },
  tasks: {
    get: vi.fn(),
    listComments: vi.fn(),
    addComment: vi.fn(),
    updateComment: vi.fn(),
    removeComment: vi.fn(),
  },
}))

vi.mock('@/services', () => ({ services: serviceMocks }))

const task: TaskItem = {
  id: 'task-1',
  code: 'TASK-001',
  projectId: 'project-1',
  title: '留言測試',
  description: '測試失敗草稿',
  creatorId: 'user-1',
  assigneeId: 'user-1',
  startAt: '2026-09-13T00:00:00Z',
  deadline: '2026-09-14T00:00:00Z',
  status: 'Pending',
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  rowVersion: 'TASK-V1',
}

const comment: TaskComment = {
  id: 'comment-1',
  taskId: task.id,
  authorId: 'user-1',
  content: '編輯前內容',
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  rowVersion: 'COMMENT-V1',
}

const project: Project = {
  id: 'project-1',
  code: 'PRJ-001',
  name: '留言測試專案',
  description: '',
  ownerId: 'user-1',
  timeZoneId: 'Asia/Taipei',
  status: 'Active',
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
  versionNumber: 1,
  rowVersion: 'PROJECT-V1',
  members: [{ userId: 'user-1', account: 'user1', displayName: 'User One', roles: [] }],
}

const user: CurrentUser = {
  id: 'user-1',
  account: 'user1',
  displayName: 'User One',
  email: 'user1@example.test',
  role: 'User',
  isVerified: true,
  isEnabled: true,
  functions: ['projects.read', 'tasks.read', 'comments.create'],
}

async function mountView(
  currentUser: CurrentUser = user,
  initialPath = '/projects/project-1/task-items/task-1',
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = currentUser
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/projects/:projectId/task-items/:taskId',
        name: 'task-detail',
        component: TaskDetailView,
      },
      {
        path: '/projects/:projectId/task-items',
        name: 'task-list',
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
  const wrapper = mount(TaskDetailView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return { wrapper, ui: useUiStore(), router }
}

describe('TaskDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.tasks.get.mockResolvedValue(task)
    serviceMocks.projects.get.mockResolvedValue(project)
    serviceMocks.tasks.listComments.mockResolvedValue([comment])
  })

  // 測試案例：TC-ERR-CMT-009（新增／編輯失敗保留草稿，使用者明確重送才成功）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('留言儲存失敗保留原始草稿且明確重送後才重新載入', async () => {
    serviceMocks.tasks.addComment
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ...comment, id: 'comment-2', content: '新增第一行\n新增第二行' })
    serviceMocks.tasks.updateComment
      .mockRejectedValueOnce(new Error('server error'))
      .mockResolvedValueOnce({ ...comment, content: '修改第一行\n修改第二行' })
    const { wrapper, ui } = await mountView()
    const addDraft = '新增第一行\n新增第二行'
    const addTextarea = wrapper.get<HTMLTextAreaElement>('#comment')
    await addTextarea.setValue(addDraft)

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(addTextarea.element.value).toBe(addDraft)
    expect(serviceMocks.tasks.listComments).toHaveBeenCalledTimes(1)
    expect(ui.toast).toBe('')

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(serviceMocks.tasks.addComment).toHaveBeenCalledTimes(2)
    expect(addTextarea.element.value).toBe('')
    expect(serviceMocks.tasks.listComments).toHaveBeenCalledTimes(2)
    expect(ui.toast).toBe('資料已儲存')

    await wrapper.findAll('button.link')[0]!.trigger('click')
    const editDraft = '修改第一行\n修改第二行'
    const editTextarea = wrapper.get<HTMLTextAreaElement>('textarea[aria-label="Edit comment"]')
    await editTextarea.setValue(editDraft)
    await wrapper
      .get('textarea[aria-label="Edit comment"] + .row-actions .button.primary')
      .trigger('click')
    await flushPromises()
    expect(
      wrapper.get<HTMLTextAreaElement>('textarea[aria-label="Edit comment"]').element.value,
    ).toBe(editDraft)
    expect(serviceMocks.tasks.listComments).toHaveBeenCalledTimes(2)

    await wrapper
      .get('textarea[aria-label="Edit comment"] + .row-actions .button.primary')
      .trigger('click')
    await flushPromises()
    expect(serviceMocks.tasks.updateComment).toHaveBeenCalledTimes(2)
    expect(wrapper.find('textarea[aria-label="Edit comment"]').exists()).toBe(false)
    expect(serviceMocks.tasks.listComments).toHaveBeenCalledTimes(3)
  })

  // 測試案例：TC-F-TASK-021、TC-ST-TASK-003（詳情欄位、角色控制與返回 query 合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('完整顯示唯讀詳情並依角色控制編輯留言及保留返回條件', async () => {
    const path =
      '/projects/project-1/task-items/task-1?search=留言&status=Pending&sort=oldest&page=2'
    const viewer: CurrentUser = {
      ...user,
      id: 'viewer-1',
      role: 'Viewer',
      functions: ['projects.read', 'tasks.read'],
    }
    const { wrapper, router } = await mountView(viewer, path)

    for (const value of [
      task.code,
      task.title,
      task.description,
      'User One',
      task.status,
      new Date(task.startAt).toLocaleString(),
      new Date(task.deadline).toLocaleString(),
      new Date(task.createdAt).toLocaleString(),
      new Date(task.updatedAt).toLocaleString(),
      comment.content,
    ]) {
      expect(wrapper.text()).toContain(value)
    }
    expect(wrapper.text()).not.toContain(task.rowVersion)
    expect(wrapper.find('a.button.primary').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('button.link')).toHaveLength(0)

    await wrapper.get('button.button.secondary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('task-list')
    expect(router.currentRoute.value.query).toEqual({
      search: '留言',
      status: 'Pending',
      sort: 'oldest',
      page: '2',
    })

    const assignee = await mountView({
      ...user,
      functions: ['projects.read', 'tasks.read', 'tasks.update-assigned', 'comments.create'],
    })
    expect(assignee.wrapper.get('a.button.primary').attributes('href')).toBe(
      '/projects/project-1/task-items/task-1/edit',
    )
  })

  // 測試案例：TC-F-CMT-001、TC-ERR-CMT-005（讀取呈現與角色控制合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('Viewer 可讀留言作者內容時間但看不到新增編輯刪除控制', async () => {
    const viewer: CurrentUser = {
      ...user,
      id: 'viewer-1',
      role: 'Viewer',
      functions: ['projects.read', 'tasks.read'],
    }
    const { wrapper } = await mountView(viewer)

    expect(wrapper.text()).toContain('User One')
    expect(wrapper.text()).toContain(comment.content)
    expect(wrapper.text()).toContain(new Date(comment.createdAt).toLocaleString())
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.findAll('button.link')).toHaveLength(0)
  })

  // 測試案例：TC-ERR-CMT-003、TC-ERR-CMT-006（驗證與 409 草稿復原合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('拒絕空白與超長留言並在 409 時保留編輯草稿', async () => {
    const { wrapper } = await mountView()
    const addTextarea = wrapper.get<HTMLTextAreaElement>('#comment')

    await addTextarea.setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(serviceMocks.tasks.addComment).not.toHaveBeenCalled()
    expect(addTextarea.element.value).toBe('   ')
    expect(wrapper.get('.alert').text()).toContain('1 到 2000')

    await addTextarea.setValue('x'.repeat(2001))
    await wrapper.get('form').trigger('submit')
    expect(serviceMocks.tasks.addComment).not.toHaveBeenCalled()
    expect(addTextarea.element.value).toHaveLength(2001)

    serviceMocks.tasks.updateComment.mockRejectedValue(
      new ApiError(409, '資料已被其他人更新，請重新載入', {}, 'concurrency_conflict'),
    )
    await wrapper.findAll('button.link')[0]!.trigger('click')
    const draft = '尚未送出的修改內容'
    const editTextarea = wrapper.get<HTMLTextAreaElement>('textarea[aria-label="Edit comment"]')
    await editTextarea.setValue(draft)
    await wrapper
      .get('textarea[aria-label="Edit comment"] + .row-actions .button.primary')
      .trigger('click')
    await flushPromises()

    expect(editTextarea.element.value).toBe(draft)
    expect(wrapper.get('.alert').text()).toContain('重新載入')
    expect(serviceMocks.tasks.listComments).toHaveBeenCalledTimes(1)
  })

  // 測試案例：TC-ST-CMT-007（取消不送出、確認成功後重新載入合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('刪除留言取消不送出且確認成功後重新載入留言串', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    serviceMocks.tasks.removeComment.mockResolvedValue(undefined)
    const { wrapper } = await mountView()
    const removeButton = wrapper.findAll('button.link').find((button) => button.text() === '刪除')!

    await removeButton.trigger('click')
    expect(serviceMocks.tasks.removeComment).not.toHaveBeenCalled()
    expect(confirmSpy).toHaveBeenCalledOnce()

    await removeButton.trigger('click')
    await flushPromises()
    expect(serviceMocks.tasks.removeComment).toHaveBeenCalledWith('project-1', 'task-1', comment)
    expect(serviceMocks.tasks.listComments).toHaveBeenCalledTimes(2)
  })

  // 測試案例：TC-SEC-UI-007（Task、Comment 與使用者名稱惡意內容合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('以純文字呈現不受信任內容且不建立可執行元素或事件屬性', async () => {
    const payload = '<script>window.__xss = true</script><img src=x onerror=window.__xss=true>&"\''
    serviceMocks.tasks.get.mockResolvedValue({
      ...task,
      title: payload,
      description: payload,
    })
    serviceMocks.projects.get.mockResolvedValue({
      ...project,
      members: [{ ...project.members[0]!, displayName: payload }],
    })
    serviceMocks.tasks.listComments.mockResolvedValue([{ ...comment, content: payload }])

    const { wrapper } = await mountView()

    expect(wrapper.text()).toContain(payload)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[onerror]').exists()).toBe(false)
    expect((window as Window & { __xss?: boolean }).__xss).toBeUndefined()
  })
})
