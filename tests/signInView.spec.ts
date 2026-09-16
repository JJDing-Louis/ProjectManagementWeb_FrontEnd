import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { ApiError } from '@/types/models'
import SignInView from '@/views/auth/SignInView.vue'

const signIn = vi.hoisted(() => vi.fn())

vi.mock('@/services', () => ({ services: { auth: { signIn } } }))

async function mountView(path = '/sign-in') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/sign-in', component: SignInView },
      { path: '/projects', name: 'projects', component: { template: '<div />' } },
      { path: '/sign-up', component: { template: '<div />' } },
      { path: '/resend-verification', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(SignInView, { global: { plugins: [i18n, pinia, router] } })
  return { router, wrapper }
}

describe('SignInView', () => {
  beforeEach(() => signIn.mockReset())

  // 測試案例：TC-ERR-AUTH-008（錯誤帳密與停用帳號相同 UI 語意）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 22:22:17 +08:00
  it('不同無效登入原因都只顯示相同的一般化錯誤', async () => {
    for (const account of ['wrong-password', 'disabled-account']) {
      signIn.mockRejectedValueOnce(
        new ApiError(401, '帳號或密碼不正確。', {}, 'invalid_credentials'),
      )
      const { wrapper } = await mountView()
      await wrapper.get('#account').setValue(account)
      await wrapper.get('#password').setValue('Wrong_password1!')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[role="alert"]').text()).toBe('帳號或密碼不正確。')
      expect(wrapper.text()).not.toContain('停用')
      wrapper.unmount()
    }
  })

  // 測試案例：TC-F-AUTH-020（登入成功與 redirect）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 22:22:17 +08:00
  it('登入成功後保留原始 redirect 並禁止重複送出', async () => {
    let resolveSignIn!: (value: object) => void
    signIn.mockReturnValue(new Promise((resolve) => (resolveSignIn = resolve)))
    const { router, wrapper } = await mountView('/sign-in?redirect=/projects')
    await wrapper.get('#account').setValue('  valid-user  ')
    await wrapper.get('#password').setValue('Valid_password1!')
    const submit = wrapper.get('button.primary')

    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(signIn).toHaveBeenCalledExactlyOnceWith('valid-user', 'Valid_password1!')
    expect(submit.attributes('disabled')).toBeDefined()
    resolveSignIn({})
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/projects')
  })
})
