import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import ProjectDetailView from '@/views/projects/ProjectDetailView.vue'

const projectService = vi.hoisted(() => ({
  get: vi.fn(),
  memberCandidates: vi.fn(),
  roles: vi.fn(),
  addMember: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn(),
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
  status: 'Pending' as const,
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T00:00:00Z',
  rowVersion: 'AAAA',
  members: [
    {
      userId: 'user-1',
      account: 'louis',
      displayName: 'Louis Test',
      roles: [roles[0]!],
    },
  ],
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  auth.user = {
    id: 'admin-1',
    account: 'admin',
    displayName: 'Admin',
    email: 'admin@example.test',
    role: 'Admin',
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
  })

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

  it('白色內容卡片依序顯示 Description 與 Member 兩個區段', async () => {
    const wrapper = await mountView()
    const contentCard = wrapper.get('.project-content-card')
    const sections = contentCard.findAll('.project-content-section')

    expect(wrapper.find('.page-header p').exists()).toBe(false)
    expect(sections).toHaveLength(2)
    expect(sections[0]?.get('h2').text()).toBe('說明')
    expect(sections[0]?.text()).toContain(project.description)
    expect(sections[1]?.get('h2').text()).toBe('成員')
  })

  it('成員表格為 Action 保留獨立欄寬', async () => {
    const wrapper = await mountView()
    const memberTable = wrapper.get('.member-table')

    expect(memberTable.findAll('col')).toHaveLength(3)
    expect(memberTable.find('col.member-role-column').exists()).toBe(true)
    expect(memberTable.find('col.member-action-column').exists()).toBe(true)
    expect(memberTable.get('th.member-action-cell').text()).toBe('操作')
  })
})
