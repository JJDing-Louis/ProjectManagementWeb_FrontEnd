import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import ResendVerificationView from '@/views/auth/ResendVerificationView.vue'

const resendVerification = vi.hoisted(() => vi.fn())

vi.mock('@/services', () => ({
  services: { auth: { resendVerification } },
}))

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/resend-verification', component: ResendVerificationView },
      { path: '/sign-in', component: { template: '<div />' } },
    ],
  })
  await router.push('/resend-verification')
  await router.isReady()
  return mount(ResendVerificationView, { global: { plugins: [i18n, router] } })
}

describe('ResendVerificationView', () => {
  beforeEach(() => resendVerification.mockReset())

  // 測試案例：TC-F-AUTH-011、TC-ERR-AUTH-022、TC-F-UI-005
  // 測試結果：Passed（中英文皆採不承諾寄送成功的 status 訊息）
  // 上次測試時間：2026-09-15 15:57:36 +08:00
  it('重寄後顯示不洩漏帳號存在性的狀態訊息', async () => {
    resendVerification.mockResolvedValue(true)
    for (const [locale, expectedMessage] of [
      ['zh-TW', '若帳號存在且符合條件，系統已受理重寄請求。'],
      ['en', 'If the account exists and is eligible, the resend request has been accepted.'],
    ] as const) {
      i18n.global.locale.value = locale
      const wrapper = await mountView()
      await wrapper.get('#resend-account').setValue('viewer@example.test')
      await wrapper.get('button').trigger('click')
      await flushPromises()

      expect(wrapper.get('[role="status"]').text()).toBe(expectedMessage)
      wrapper.unmount()
    }
    expect(resendVerification).toHaveBeenCalledTimes(2)
    expect(resendVerification).toHaveBeenNthCalledWith(1, 'viewer@example.test')
    expect(resendVerification).toHaveBeenNthCalledWith(2, 'viewer@example.test')
    i18n.global.locale.value = 'zh-TW'
  })
})
