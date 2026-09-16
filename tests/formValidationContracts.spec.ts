import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import ProjectFormView from '@/views/projects/ProjectFormView.vue'
import TaskFormView from '@/views/tasks/TaskFormView.vue'

const serviceMocks = vi.hoisted(() => ({
  projects: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tasks: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateAssigned: vi.fn(),
  },
  users: {
    listAll: vi.fn(),
  },
}))

vi.mock('@/services', () => ({ services: serviceMocks }))

async function mountAt(path: string, component: typeof ProjectFormView | typeof TaskFormView) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path, component }],
  })
  await router.push(path.replace(':projectId', 'project-1'))
  await router.isReady()

  const wrapper = mount(component, {
    global: { plugins: [i18n, pinia, router] },
  })
  await flushPromises()
  return wrapper
}

describe('表單驗證契約', () => {
  // 測試案例：TC-E-PRJ-005（Frontend attribute contract；部分覆蓋）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:06 +08:00
  it('Project 名稱接受 1 至 200 字且 Description 為選填並限制 4000 字', async () => {
    serviceMocks.users.listAll.mockResolvedValue([])
    const wrapper = await mountAt('/admin/projects/new', ProjectFormView)

    const name = wrapper.get('#project-name')
    const description = wrapper.get('#project-description')
    expect(name.attributes('minlength')).toBe('1')
    expect(name.attributes('maxlength')).toBe('200')
    expect(name.attributes('required')).toBeDefined()
    expect(description.attributes('maxlength')).toBe('4000')
    expect(description.attributes('required')).toBeUndefined()
  })

  // 測試案例：TC-F-PRJ-003（新增狀態固定 Pending）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('新增 Project 不提供狀態欄位以避免繞過固定 Pending 契約', async () => {
    serviceMocks.users.listAll.mockResolvedValue([])
    const wrapper = await mountAt('/admin/projects/new', ProjectFormView)

    expect(wrapper.find('#project-form-status').exists()).toBe(false)
  })

  // 測試案例：TC-ERR-TASK-009、TC-ERR-TASK-022（Title／Description attribute contract）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Task 標題限制 300 字且 Description 為選填並限制 8000 字', async () => {
    serviceMocks.projects.get.mockResolvedValue({ members: [] })
    const wrapper = await mountAt('/admin/projects/:projectId/task-items/new', TaskFormView)

    const title = wrapper.get('#task-title')
    const description = wrapper.get('#task-description')
    expect(title.attributes('maxlength')).toBe('300')
    expect(title.attributes('required')).toBeDefined()
    expect(description.attributes('maxlength')).toBe('8000')
    expect(description.attributes('required')).toBeUndefined()
  })

  // 測試案例：TC-F-TASK-008（新增狀態固定 Pending）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('新增 Task 不提供狀態欄位以避免繞過固定 Pending 契約', async () => {
    serviceMocks.projects.get.mockResolvedValue({ members: [] })
    const wrapper = await mountAt('/admin/projects/:projectId/task-items/new', TaskFormView)

    expect(wrapper.find('#task-form-status').exists()).toBe(false)
  })
})
