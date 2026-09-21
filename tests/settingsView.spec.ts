import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError } from '@/types/models'
import SettingsView from '@/views/SettingsView.vue'

const serviceMocks = vi.hoisted(() => ({
  preferences: { get: vi.fn(), update: vi.fn() },
  profile: { get: vi.fn(), update: vi.fn() },
}))

vi.mock('@/services', () => ({ services: serviceMocks }))

async function mountView(functions = ['preferences.read-own', 'preferences.update-own']) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useAuthStore().user = {
    id: 'user-1',
    account: 'member',
    displayName: 'Member',
    email: 'member@example.test',
    role: functions.includes('preferences.update-own') ? 'User' : 'Viewer',
    isVerified: true,
    isEnabled: true,
    functions,
  }
  const wrapper = mount(SettingsView, { global: { plugins: [i18n, pinia] } })
  await flushPromises()
  return wrapper
}

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.profile.get.mockResolvedValue({ name: 'Member', phoneNumber: '0912-345-678' })
    serviceMocks.preferences.get.mockResolvedValue({ skipBatchConfirmation: false })
  })

  it('個人設定載入失敗時顯示錯誤且不顯示未載入的表單', async () => {
    serviceMocks.profile.get.mockRejectedValue(new ApiError(503, '個人資料服務暫時無法使用。'))

    const wrapper = await mountView()

    expect(wrapper.get('[role="alert"]').text()).toBe('個人資料服務暫時無法使用。')
    expect(wrapper.find('#profile-name').exists()).toBe(false)
  })

  it('Viewer仍可修改自己的名稱與電話但不可修改批次確認偏好', async () => {
    serviceMocks.profile.update.mockResolvedValue({ name: '新名稱', phoneNumber: null })
    const wrapper = await mountView(['preferences.read-own'])

    await wrapper.get('#profile-name').setValue('  新名稱  ')
    await wrapper.get('#profile-phone').setValue('   ')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(serviceMocks.profile.update).toHaveBeenCalledExactlyOnceWith('新名稱', null)
    expect(useAuthStore().user?.displayName).toBe('新名稱')
    expect(
      wrapper.get<HTMLInputElement>('input[type="checkbox"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.find('.preference-save').exists()).toBe(false)
  })

  it('名稱與電話的前端長度驗證失敗時不送出API', async () => {
    const wrapper = await mountView()

    await wrapper.get('#profile-name').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('請輸入顯示名稱。')

    await wrapper.get('#profile-name').setValue('有效名稱')
    await wrapper.get('#profile-phone').setValue('1'.repeat(31))
    await wrapper.get('form').trigger('submit')

    expect(wrapper.text()).toContain('電話號碼不可超過 30 個字元。')
    expect(serviceMocks.profile.update).not.toHaveBeenCalled()
  })

  it('後端欄位錯誤會顯示在對應的個人資料欄位且保留輸入', async () => {
    serviceMocks.profile.update.mockRejectedValue(
      new ApiError(
        400,
        '個人資料欄位驗證失敗。',
        { phoneNumber: '請輸入有效的電話號碼格式。' },
        'validation_error',
      ),
    )
    const wrapper = await mountView()

    await wrapper.get('#profile-phone').setValue('invalid-phone')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('請輸入有效的電話號碼格式。')
    expect(wrapper.get<HTMLInputElement>('#profile-phone').element.value).toBe('invalid-phone')
  })

  it('可更新批次確認偏好且提交中禁止重複送出', async () => {
    let resolveUpdate!: (value: { skipBatchConfirmation: boolean }) => void
    serviceMocks.preferences.update.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )
    const wrapper = await mountView()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    await checkbox.setValue(true)
    const saveButton = wrapper.get('.preference-save')

    await saveButton.trigger('click')
    await saveButton.trigger('click')

    expect(serviceMocks.preferences.update).toHaveBeenCalledExactlyOnceWith(true)
    expect(saveButton.attributes('disabled')).toBeDefined()
    resolveUpdate({ skipBatchConfirmation: true })
    await flushPromises()
    expect(useUiStore().toast).toBe('資料已儲存')
    expect(saveButton.attributes('disabled')).toBeUndefined()
  })
})
