import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusBadge from '@/components/StatusBadge.vue'

describe('StatusBadge', () => {
  it('顯示狀態並提供對應樣式', () => {
    const wrapper = mount(StatusBadge, { props: { value: 'InProgress' } })
    expect(wrapper.text()).toBe('InProgress')
    expect(wrapper.classes()).toContain('status-inprogress')
  })
})
