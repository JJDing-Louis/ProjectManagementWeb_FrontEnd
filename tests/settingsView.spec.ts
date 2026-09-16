import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError } from '@/types/models'
import SettingsView from '@/views/SettingsView.vue'

const preferenceService = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))

vi.mock('@/services', () => ({
  services: { preferences: preferenceService },
}))

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
  beforeEach(() => vi.clearAllMocks())

  // 測試案例：TC-F-UI-002（個人設定 error 狀態）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('偏好載入失敗時顯示錯誤且不顯示未載入的預設表單', async () => {
    preferenceService.get.mockRejectedValue(new ApiError(503, '偏好服務暫時無法使用。'))

    const wrapper = await mountView()

    expect(wrapper.get('[role="alert"]').text()).toBe('偏好服務暫時無法使用。')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('載入中')
  })

  // 測試案例：TC-ERR-PREF-002
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('Viewer 可讀取偏好但不顯示可修改控制', async () => {
    preferenceService.get.mockResolvedValue({ skipBatchConfirmation: true })

    const wrapper = await mountView(['preferences.read-own'])

    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(true)
    expect(wrapper.get('input[type="checkbox"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').exists()).toBe(false)
  })

  // 測試案例：TC-F-PREF-001、TC-F-UI-002（成功與 submitting 狀態合併驗證）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 16:20:04 +08:00
  it('可更新批次確認偏好且提交中禁止重複送出', async () => {
    preferenceService.get.mockResolvedValue({ skipBatchConfirmation: false })
    let resolveUpdate!: (value: { skipBatchConfirmation: boolean }) => void
    preferenceService.update.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )
    const wrapper = await mountView()
    const checkbox = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    await checkbox.setValue(true)
    const saveButton = wrapper.get('button')

    await saveButton.trigger('click')
    await saveButton.trigger('click')

    expect(preferenceService.update).toHaveBeenCalledExactlyOnceWith(true)
    expect(saveButton.attributes('disabled')).toBeDefined()
    resolveUpdate({ skipBatchConfirmation: true })
    await flushPromises()
    expect(useUiStore().toast).toBe('資料已儲存')
    expect(saveButton.attributes('disabled')).toBeUndefined()
  })
})
