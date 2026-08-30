import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import VerifyEmailView from '@/views/auth/VerifyEmailView.vue'

describe('VerifyEmailView', () => {
  it('驗證信寄送失敗時顯示重新寄送提示', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/verify-email', component: VerifyEmailView },
        { path: '/resend-verification', component: { template: '<div />' } },
        { path: '/sign-in', component: { template: '<div />' } },
      ],
    })
    await router.push('/verify-email?accountId=account-id-1&emailSent=false')
    await router.isReady()

    const wrapper = mount(VerifyEmailView, { global: { plugins: [router] } })

    expect(wrapper.get('[role="alert"]').text()).toContain('帳號已建立，但驗證信寄送失敗')
    expect(wrapper.get('a[href="/resend-verification"]').text()).toBe('重新寄送驗證信')
  })
})
