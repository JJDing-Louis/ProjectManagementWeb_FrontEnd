import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/types/models'
import ProjectDetailView from '@/views/projects/ProjectDetailView.vue'

const projectService = vi.hoisted(() => ({
  get: vi.fn(),
  memberCandidates: vi.fn(),
  roles: vi.fn(),
  addMember: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/services', () => ({
  services: { projects: projectService },
}))

const roles = [
  { id: 'member', code: 'Member' as const, name: 'Member' },
  { id: 'frontend', code: 'FrontendDeveloper' as const, name: 'FrontendDeveloper' },
]

const project = {
  id: 'project-1',
  code: 'PRJ-001',
  name: '測試專案',
  description: '測試',
  ownerId: 'user-1',
  timeZoneId: 'Asia/Taipei',
  status: 'Pending' as const,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T00:00:00Z',
  versionNumber: 3,
  rowVersion: 'AAAA',
  members: [
    {
      userId: 'user-1',
      account: 'louis',
      displayName: 'Louis Test',
      roles: [roles[0]!],
    },
    {
      userId: 'user-2',
      account: 'member',
      displayName: 'Project Member',
      roles: [roles[1]!],
    },
  ],
}

async function mountView(role: 'Administrator' | 'Admin' | 'User' | 'Viewer' = 'Admin') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = {
    id: 'admin-1',
    account: 'admin',
    displayName: 'Admin',
    email: 'admin@example.test',
    role,
    isVerified: true,
    isEnabled: true,
    functions: ['projects.manage-all'],
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:projectId', name: 'project-detail', component: ProjectDetailView },
      { path: '/projects', name: 'projects', component: { template: '<div />' } },
      {
        path: '/projects/:projectId/edit',
        name: 'project-edit',
        component: { template: '<div />' },
      },
      {
        path: '/projects/:projectId/task-items',
        name: 'task-list',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/projects/project-1')
  await router.isReady()

  const wrapper = mount(ProjectDetailView, {
    global: { plugins: [i18n, pinia, router], stubs: { Teleport: true } },
  })
  await flushPromises()
  return wrapper
}

describe('ProjectDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    projectService.get.mockResolvedValue(project)
    projectService.memberCandidates.mockResolvedValue([])
    projectService.roles.mockResolvedValue(roles)
    projectService.updateMember.mockResolvedValue(undefined)
    projectService.addMember.mockResolvedValue(undefined)
    projectService.removeMember.mockResolvedValue(undefined)
    projectService.remove.mockResolvedValue(undefined)
  })

  // 測試案例：TC-F-MEMBER-001（候選人搜尋與最小揭露）
  // 測試結果：Passed
  // 上次測試時間：2026-09-19 20:08:15 +08:00
  it('在下拉選單輸入帳號或名稱篩選候選人且只顯示最小必要欄位', async () => {
    projectService.memberCandidates.mockResolvedValue([
      { id: 'user-3', account: 'candidate-account', displayName: 'Candidate Name' },
      { id: 'user-4', account: 'another-account', displayName: 'Another Person' },
    ])
    const wrapper = await mountView()

    expect(wrapper.find('#member-search').exists()).toBe(false)
    expect(wrapper.find('button.member-search-button').exists()).toBe(false)

    await wrapper.get('#member').trigger('click')
    await wrapper.get('#member-search').setValue('candidate')

    const options = wrapper.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toContain('Candidate Name')
    expect(options[0]!.text()).toContain('candidate-account')
    expect(wrapper.text()).not.toContain('@')
  })

  // 測試案例：TC-F-MEMBER-002、TC-ST-MEMBER-005
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('新增與修改專案角色皆使用收合式多選 Dropdown', async () => {
    const wrapper = await mountView()

    expect(wrapper.findAll('select[multiple]')).toHaveLength(0)
    expect(wrapper.get('button[aria-label="專案角色"]').attributes('aria-expanded')).toBe('false')

    await wrapper.get('button[aria-label="Louis Test 專案角色"]').trigger('click')
    await wrapper.get('input[value="frontend"]').setValue(true)
    await flushPromises()

    expect(projectService.updateMember).toHaveBeenCalledWith('project-1', 'user-1', [
      'member',
      'frontend',
    ])
  })

  // 測試案例：TC-F-MEMBER-002（加入多角色成員）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('新增成員會送出完整多角色集合', async () => {
    projectService.memberCandidates.mockResolvedValue([
      { id: 'user-3', account: 'candidate', displayName: 'Candidate' },
    ])
    const wrapper = await mountView()

    await wrapper.get('#member').trigger('click')
    await wrapper.get('[role="option"]').trigger('click')
    await wrapper.get('button[aria-label="專案角色"]').trigger('click')
    await wrapper.get('input[value="frontend"]').setValue(true)
    await wrapper.get('form.toolbar').trigger('submit')
    await flushPromises()

    expect(projectService.addMember).toHaveBeenCalledWith('project-1', 'user-3', [
      'member',
      'frontend',
    ])
  })

  // 測試案例：TC-ERR-MEMBER-006（Owner 移除保護）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('Owner 的移除按鈕停用但非 Owner 成員仍可操作', async () => {
    const wrapper = await mountView()
    const buttons = wrapper.findAll('.member-table button.danger')

    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.attributes('disabled')).toBeDefined()
    expect(buttons[1]!.attributes('disabled')).toBeUndefined()
  })

  // 測試案例：TC-ERR-MEMBER-007（未完成 Task 阻擋移除）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('成員移除被阻擋時顯示錯誤且保留原成員', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    projectService.removeMember.mockRejectedValue(
      new ApiError(409, '請先重新指派未完成的 Task。', {}, 'task_reassignment_required'),
    )
    const wrapper = await mountView()

    await wrapper.findAll('.member-table button.danger')[1]!.trigger('click')
    await flushPromises()

    expect(projectService.removeMember).toHaveBeenCalledWith('project-1', 'user-2')
    expect(wrapper.get('[role="alert"]').text()).toBe('請先重新指派未完成的 Task。')
    expect(wrapper.text()).toContain('Project Member')
    vi.unstubAllGlobals()
  })

  // 測試案例：TC-ERR-MEMBER-009（候選人在提交前失效）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('候選人提交時失效會顯示 API 錯誤並保留選擇', async () => {
    projectService.memberCandidates.mockResolvedValue([
      { id: 'user-3', account: 'candidate', displayName: 'Candidate' },
    ])
    projectService.addMember.mockRejectedValue(
      new ApiError(422, '所選帳號已無法使用，請重新選擇。', {}, 'invalid_account'),
    )
    const wrapper = await mountView()
    const candidate = wrapper.get<HTMLButtonElement>('#member')
    await candidate.trigger('click')
    await wrapper.get('[role="option"]').trigger('click')

    await wrapper.get('form.toolbar').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('所選帳號已無法使用，請重新選擇。')
    expect(candidate.text()).toContain('Candidate')
  })

  // 測試案例：TC-F-MEMBER-008（Project 詳情與成員呈現）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('白色內容卡片依序顯示 Description 與 Member 兩個區段', async () => {
    const wrapper = await mountView()
    const contentCard = wrapper.get('.project-content-card')
    const sections = contentCard.findAll('.project-content-section')

    expect(wrapper.find('.page-header p').exists()).toBe(false)
    expect(sections).toHaveLength(2)
    expect(sections[0]?.get('h2').text()).toBe('說明')
    expect(sections[0]?.text()).toContain(project.description)
    expect(sections[1]?.get('h2').text()).toBe('成員')
    expect(sections[1]?.text()).toContain('Louis Test')
    expect(sections[1]?.text()).toContain('louis')
    expect(sections[1]?.text()).toContain('Member')
    expect(sections[1]?.text()).toContain('Project Member')
    expect(sections[1]?.text()).toContain('member')
    expect(sections[1]?.text()).toContain('FrontendDeveloper')
    expect(sections[1]?.text()).not.toContain('@')
  })

  // 測試案例：TC-F-UI-001（成員表格版面）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('成員表格為 Action 保留獨立欄寬', async () => {
    const wrapper = await mountView()
    const memberTable = wrapper.get('.member-table')

    expect(memberTable.findAll('col')).toHaveLength(3)
    expect(memberTable.find('col.member-role-column').exists()).toBe(true)
    expect(memberTable.find('col.member-action-column').exists()).toBe(true)
    expect(memberTable.get('th.member-action-cell').text()).toBe('操作')
  })

  // 測試案例：TC-ST-PRJ-006（可讀版本顯示）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 10:16:48 +08:00
  it('Overview顯示可讀版本且不顯示並行控制權杖', async () => {
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('版本')
    expect(wrapper.text()).toContain('v3')
    expect(wrapper.text()).not.toContain(project.rowVersion)
    expect(wrapper.text()).not.toContain('Concurrency token')
  })

  // 測試案例：TC-ST-PRJ-009、TC-ERR-PRJ-010（軟刪除角色、確認、成功與失敗 UI）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 15:20:57 +08:00
  it.each(['Administrator', 'Admin'] as const)('%s 確認後可軟刪除並返回專案清單', async (role) => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    )
    const wrapper = await mountView(role)

    await wrapper.get('button.project-delete-button').trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('刪除後不會出現在一般清單'))
    expect(projectService.remove).toHaveBeenCalledWith(project)
    expect(wrapper.vm.$router.currentRoute.value.name).toBe('projects')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  // 測試案例：TC-ERR-PRJ-010（User、Viewer 無 UI；取消或 API 失敗不離開詳情）
  // 測試結果：Passed
  // 上次測試時間：2026-09-16 15:20:57 +08:00
  it('User與Viewer不顯示刪除，而取消或衝突會保留詳情', async () => {
    expect((await mountView('User')).find('button.project-delete-button').exists()).toBe(false)
    expect((await mountView('Viewer')).find('button.project-delete-button').exists()).toBe(false)

    const confirmMock = vi.fn(() => false)
    vi.stubGlobal('confirm', confirmMock)
    const cancelled = await mountView('Admin')
    await cancelled.get('button.project-delete-button').trigger('click')
    expect(projectService.remove).not.toHaveBeenCalled()
    expect(cancelled.text()).toContain(project.name)

    confirmMock.mockReturnValue(true)
    projectService.remove.mockRejectedValue(
      new ApiError(409, '資料已被其他人更新，請重新載入。', {}, 'concurrency_conflict'),
    )
    const conflicted = await mountView('Admin')
    await conflicted.get('button.project-delete-button').trigger('click')
    await flushPromises()
    expect(conflicted.get('[role="alert"]').text()).toContain('資料已被其他人更新')
    expect(conflicted.text()).toContain(project.name)
    vi.unstubAllGlobals()
  })
})
