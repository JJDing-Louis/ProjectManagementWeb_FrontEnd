import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import SignUpView from '@/views/auth/SignUpView.vue'

const signUp = vi.hoisted(() => vi.fn())

vi.mock('@/services', () => ({
  services: { auth: { signUp } },
}))

async function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/sign-up', name: 'sign-up', component: SignUpView },
      { path: '/verify-email', name: 'verify-email', component: { template: '<div />' } },
      { path: '/sign-in', name: 'sign-in', component: { template: '<div />' } },
    ],
  })
  await router.push('/sign-up')
  await router.isReady()
  return {
    router,
    wrapper: mount(SignUpView, { global: { plugins: [i18n, router] } }),
  }
}

async function fillForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('#account').setValue('new.user')
  await wrapper.get('#displayName').setValue('新使用者')
  await wrapper.get('#email').setValue('new.user@example.com')
  await wrapper.get('#password').setValue('ValidPass1!')
  await wrapper.get('#confirmPassword').setValue('ValidPass1!')
}

describe('SignUpView', () => {
  beforeEach(() => signUp.mockReset())

  // 測試案例：TC-E-AUTH-002（顯示名稱前端長度契約）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 22:14:01 +08:00
  it('顯示名稱必填且最多接受 100 字', async () => {
    const { wrapper } = await mountView()
    const displayName = wrapper.get('#displayName')

    expect(displayName.attributes('required')).toBeDefined()
    expect(displayName.attributes('maxlength')).toBe('100')
  })

  // 測試案例：TC-F-AUTH-001（成功註冊與驗證信導向）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:06 +08:00
  it('後端成功建立帳號後才跳至驗證信畫面', async () => {
    signUp.mockResolvedValue({ accountId: 'account-id-1', verificationEmailSent: true })
    const { router, wrapper } = await mountView()
    await fillForm(wrapper)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'ValidPass1!',
        confirmPassword: 'ValidPass1!',
      }),
    )
    expect(router.currentRoute.value).toMatchObject({
      name: 'verify-email',
      query: { accountId: 'account-id-1', emailSent: 'true' },
    })
  })

  // 測試案例：TC-ST-AUTH-006（SMTP 失敗但帳號保留）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:06 +08:00
  it('帳號建立但寄信失敗時將狀態帶至驗證信畫面', async () => {
    signUp.mockResolvedValue({ accountId: 'account-id-1', verificationEmailSent: false })
    const { router, wrapper } = await mountView()
    await fillForm(wrapper)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value).toMatchObject({
      name: 'verify-email',
      query: { accountId: 'account-id-1', emailSent: 'false' },
    })
  })
})
