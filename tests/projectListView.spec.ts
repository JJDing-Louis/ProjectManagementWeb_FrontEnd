import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/types/models'
import ProjectListView from '@/views/projects/ProjectListView.vue'

const projectService = vi.hoisted(() => ({ list: vi.fn() }))

const project = {
  id: 'project-1',
  code: 'PRJ-202609150001',
  name: 'Alpha',
  description: '第一個專案',
  ownerId: 'owner-1',
  timeZoneId: 'Asia/Taipei',
  status: 'Active' as const,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  versionNumber: 1,
  rowVersion: 'AAAA',
  members: [],
}

vi.mock('@/services', () => ({
  services: { projects: projectService },
}))

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 'user-1',
    account: 'reader',
    displayName: 'Reader',
    email: 'reader@example.test',
    role: 'User',
    isVerified: true,
    isEnabled: true,
    functions: ['projects.read'],
  }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects', name: 'projects', component: ProjectListView },
      { path: '/projects/new', name: 'project-new', component: { template: '<div />' } },
      {
        path: '/projects/:projectId',
        name: 'project-detail',
        component: { template: '<div />' },
      },
      {
        path: '/projects/:projectId/task-items',
        name: 'task-list',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push('/projects')
  await router.isReady()
  const wrapper = mount(ProjectListView, { global: { plugins: [i18n, pinia, router] } })
  await flushPromises()
  return wrapper
}

describe('ProjectListView', () => {
  beforeEach(() => vi.clearAllMocks())

  // 測試案例：TC-F-UI-002（Project 清單 error 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Project 清單載入失敗時顯示錯誤且不誤顯空狀態', async () => {
    projectService.list.mockRejectedValue(new ApiError(503, 'Project 服務暫時無法使用。'))

    const wrapper = await mountView()

    expect(wrapper.get('[role="alert"]').text()).toBe('Project 服務暫時無法使用。')
    expect(wrapper.text()).not.toContain('沒有符合條件的資料')
    expect(wrapper.text()).not.toContain('載入中')
  })

  // 測試案例：TC-F-PRJ-001、TC-F-PRJ-002（資料範圍、搜尋、狀態與分頁合併驗證）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('只呈現 API 可存取 Project 並可組合查詢及切換分頁', async () => {
    const requests: Array<{ search: string; status: string; page: number; pageSize: number }> = []
    projectService.list.mockImplementation(async (query) => {
      requests.push({ ...query })
      if (query.search === 'Alpha' && query.status === 'Active') {
        return { items: [project], page: 1, pageSize: 6, totalCount: 1 }
      }
      if (query.page === 2) {
        return {
          items: [{ ...project, id: 'project-2', code: 'PRJ-202609150002', name: 'Beta' }],
          page: 2,
          pageSize: 6,
          totalCount: 7,
        }
      }
      return { items: [project], page: 1, pageSize: 6, totalCount: 7 }
    })

    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).not.toContain('＋ 新增專案')

    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Beta')
    expect(wrapper.text()).toContain('2/2')

    await wrapper.get('#project-search').setValue('Alpha')
    await wrapper.get('#project-status').setValue('Active')
    await flushPromises()
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).not.toContain('Beta')
    expect(requests[requests.length - 1]).toEqual({
      search: 'Alpha',
      status: 'Active',
      page: 1,
      pageSize: 6,
    })
  })
})
