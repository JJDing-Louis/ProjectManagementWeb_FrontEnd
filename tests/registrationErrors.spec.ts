import { describe, expect, it } from 'vitest'
import { mapRegistrationFieldErrors } from '@/features/auth/registrationErrors'

describe('mapRegistrationFieldErrors', () => {
  // 測試案例：TC-ERR-AUTH-003（Frontend 欄位映射；與 Backend Unit/API 共同覆蓋）
  // 測試結果：Passed
  // 上次測試時間：2026-09-15 15:34:06 +08:00
  it('將後端 name 欄位錯誤映射至前端 displayName 並保留其他訊息', () => {
    expect(
      mapRegistrationFieldErrors({
        account: '帳號格式不正確。',
        name: '請輸入顯示名稱。',
        email: 'Email 格式不正確。',
      }),
    ).toEqual({
      account: '帳號格式不正確。',
      displayName: '請輸入顯示名稱。',
      email: 'Email 格式不正確。',
    })
  })
})
