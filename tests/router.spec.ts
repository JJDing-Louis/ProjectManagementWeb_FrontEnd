import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router } from '@/router'

vi.mock('@/services', () => ({
  services: {
    auth: { restore: vi.fn().mockResolvedValue(null) },
  },
}))

describe('Router guards', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('未登入時導向登入頁並保留原路徑', async () => {
    await router.push('/projects/PRJ-1001/task-items?status=Pending')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('sign-in')
    expect(router.currentRoute.value.query.redirect).toBe(
      '/projects/PRJ-1001/task-items?status=Pending',
    )
  })
})
