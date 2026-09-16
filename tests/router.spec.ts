import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router } from '@/router'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/services', () => ({
  services: {
    auth: { restore: vi.fn().mockResolvedValue(null) },
  },
}))

describe('Router guards', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // 測試案例：TC-F-UI-001（未登入 redirect；部分覆蓋）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('未登入時導向登入頁並保留原路徑', async () => {
    await router.push('/projects/PRJ-1001/task-items?status=Pending')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('sign-in')
    expect(router.currentRoute.value.query.redirect).toBe(
      '/projects/PRJ-1001/task-items?status=Pending',
    )
  })

  // 測試案例：TC-F-UI-001、TC-ERR-USER-002（requiredFunction 路由矩陣合併測試）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:32 +08:00
  it('登入後缺少 requiredFunction 時導向 forbidden 且具備權限時可進入', async () => {
    const auth = useAuthStore()
    auth.initialized = true
    auth.user = {
      id: 'viewer-1',
      account: 'viewer',
      displayName: 'Viewer',
      email: 'viewer@example.test',
      role: 'Viewer',
      isVerified: true,
      isEnabled: true,
      functions: ['projects.read', 'tasks.read'],
    }

    await router.push('/users')
    expect(router.currentRoute.value.name).toBe('forbidden')
    await router.push('/admin/projects/new')
    expect(router.currentRoute.value.name).toBe('forbidden')
    await router.push('/admin/projects/project-1/task-items/new')
    expect(router.currentRoute.value.name).toBe('forbidden')

    auth.user.functions.push('accounts.read', 'projects.create', 'tasks.create')
    await router.push('/users')
    expect(router.currentRoute.value.name).toBe('users')
    await router.push('/admin/projects/new')
    expect(router.currentRoute.value.name).toBe('project-new')
    await router.push('/admin/projects/project-1/task-items/new')
    expect(router.currentRoute.value.name).toBe('task-new')
  })
})
