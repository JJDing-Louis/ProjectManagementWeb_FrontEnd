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
