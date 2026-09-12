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

  it('Task Description 為選填並限制 8000 字', async () => {
    serviceMocks.projects.get.mockResolvedValue({ members: [] })
    const wrapper = await mountAt('/admin/projects/:projectId/task-items/new', TaskFormView)

    const description = wrapper.get('#task-description')
    expect(description.attributes('maxlength')).toBe('8000')
    expect(description.attributes('required')).toBeUndefined()
  })
})
