import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VerifyEmailView from '@/views/auth/VerifyEmailView.vue'

const verifyEmail = vi.hoisted(() => vi.fn())

vi.mock('@/services', () => ({ services: { auth: { verifyEmail } } }))

async function mountView(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/verify-email', component: VerifyEmailView },
      { path: '/resend-verification', component: { template: '<div />' } },
      { path: '/sign-in', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  return mount(VerifyEmailView, { global: { plugins: [router] } })
}

describe('VerifyEmailView', () => {
  beforeEach(() => verifyEmail.mockReset())

  // 測試案例：TC-ST-AUTH-006（SMTP 失敗提示）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:06 +08:00
  it('驗證信寄送失敗時顯示重新寄送提示', async () => {
    const wrapper = await mountView('/verify-email?accountId=account-id-1&emailSent=false')

    expect(wrapper.get('[role="alert"]').text()).toContain('帳號已建立，但驗證信寄送失敗')
    expect(wrapper.get('a[href="/resend-verification"]').text()).toBe('重新寄送驗證信')
  })

  // 測試案例：TC-ST-AUTH-009（Email 驗證後仍維持 Viewer）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 22:22:17 +08:00
  it('驗證成功後明確顯示帳號仍為 Viewer', async () => {
    verifyEmail.mockResolvedValue(undefined)
    const wrapper = await mountView('/verify-email?accountId=account-id-1&token=valid-token')

    await wrapper.get('button.primary').trigger('click')
    await flushPromises()

    expect(verifyEmail).toHaveBeenCalledExactlyOnceWith('account-id-1', 'valid-token')
    expect(wrapper.get('[role="status"]').text()).toContain('remains Viewer')
  })
})
