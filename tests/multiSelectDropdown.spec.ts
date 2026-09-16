import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MultiSelectDropdown from '@/components/MultiSelectDropdown.vue'

const options = [
  { id: 'member', name: 'Member' },
  { id: 'frontend', name: 'FrontendDeveloper' },
]

describe('MultiSelectDropdown', () => {
  // 測試案例：TC-F-MEMBER-002、TC-ERR-MEMBER-004（Frontend component；部分覆蓋）
  // 測試結果：Passed（2 tests）
  // 上次測試時間：2026-09-15 15:34:06 +08:00
  it('預設收合並在展開後顯示可複選的角色', async () => {
    const wrapper = mount(MultiSelectDropdown, {
      props: {
        modelValue: ['member'],
        options,
        inputId: 'project-role',
        accessibleLabel: '專案角色',
        required: true,
      },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.get('button').text()).toContain('Member')

    await wrapper.get('button').trigger('click')

    expect(wrapper.get('[role="listbox"]').isVisible()).toBe(true)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)

    await wrapper.findAll('input[type="checkbox"]')[1]?.setValue(true)

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['member', 'frontend']])
  })

  it('必填時不允許取消最後一個角色', async () => {
    const wrapper = mount(MultiSelectDropdown, {
      props: {
        modelValue: ['member'],
        options,
        inputId: 'project-role',
        accessibleLabel: '專案角色',
        required: true,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.findAll('input[type="checkbox"]')[0]?.attributes('disabled')).toBeDefined()
  })
})
