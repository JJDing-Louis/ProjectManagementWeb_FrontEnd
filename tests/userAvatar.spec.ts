import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UserAvatar from '@/components/UserAvatar.vue'

const avatarGet = vi.hoisted(() => vi.fn())
vi.mock('@/services', () => ({ services: { avatar: { get: avatarGet } } }))

describe('UserAvatar', () => {
  beforeEach(() => {
    avatarGet.mockReset()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:avatar-new'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('沒有圖片時維持姓名首字備援', async () => {
    avatarGet.mockResolvedValue(null)
    const wrapper = mount(UserAvatar, { props: { accountId: 'user-1', displayName: '王小明' } })
    await flushPromises()

    expect(wrapper.text()).toBe('王')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('載入圖片後顯示圖片且刷新時釋放舊網址', async () => {
    avatarGet.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
    const wrapper = mount(UserAvatar, {
      props: { accountId: 'user-1', displayName: '王小明', refreshKey: 0 },
    })
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toBe('blob:avatar-new')

    await wrapper.setProps({ refreshKey: 1 })
    await flushPromises()
    expect(avatarGet).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar-new')
  })
})
