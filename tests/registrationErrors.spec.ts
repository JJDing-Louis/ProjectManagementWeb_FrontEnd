import { describe, expect, it } from 'vitest'
import { mapRegistrationFieldErrors } from '@/features/auth/registrationErrors'

describe('mapRegistrationFieldErrors', () => {
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
