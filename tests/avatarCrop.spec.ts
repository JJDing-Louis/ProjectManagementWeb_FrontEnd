import { describe, expect, it } from 'vitest'
import { calculateAvatarCrop } from '@/utils/avatarCrop'

describe('calculateAvatarCrop', () => {
  it('橫向長圖會置中剪裁為正方形', () => {
    expect(calculateAvatarCrop(1600, 1200, 1, 50, 50)).toEqual({
      left: 200,
      top: 0,
      side: 1200,
    })
  })

  it('縮放與位置滑桿決定1080像素的裁切區域', () => {
    expect(calculateAvatarCrop(2160, 2160, 2, 100, 0)).toEqual({
      left: 1080,
      top: 0,
      side: 1080,
    })
  })
})
