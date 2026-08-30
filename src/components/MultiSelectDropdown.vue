<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

interface MultiSelectOption {
  id: string
  name: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: MultiSelectOption[]
    inputId: string
    accessibleLabel: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
  }>(),
  {
    placeholder: '請選擇',
    required: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const trigger = ref<HTMLElement>()
const optionsPanel = ref<HTMLElement>()
const isOpen = ref(false)
const optionsStyle = ref<Record<string, string>>({})
const selectedNames = computed(() =>
  props.options
    .filter((option) => props.modelValue.includes(option.id))
    .map((option) => option.name),
)
const selectionText = computed(() => selectedNames.value.join(', ') || props.placeholder)

async function updateOptionsPosition() {
  const triggerElement = trigger.value
  if (!triggerElement) return

  const triggerRect = triggerElement.getBoundingClientRect()
  const optionsHeight = optionsPanel.value?.offsetHeight ?? 0
  const availableBelow = window.innerHeight - triggerRect.bottom
  const openAbove = availableBelow < optionsHeight + 12 && triggerRect.top > availableBelow
  const top = openAbove ? Math.max(8, triggerRect.top - optionsHeight - 6) : triggerRect.bottom + 6
  const left = Math.min(
    Math.max(8, triggerRect.left),
    Math.max(8, window.innerWidth - triggerRect.width - 8),
  )

  optionsStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${triggerRect.width}px`,
  }
}

async function toggleDropdown() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    await updateOptionsPosition()
  }
}

function toggleOption(optionId: string) {
  const isSelected = props.modelValue.includes(optionId)
  if (isSelected && props.required && props.modelValue.length === 1) return

  const value = isSelected
    ? props.modelValue.filter((id) => id !== optionId)
    : [...props.modelValue, optionId]
  emit('update:modelValue', value)
}

function closeOnOutsideClick(event: MouseEvent) {
  const target = event.target as Node
  if (!trigger.value?.contains(target) && !optionsPanel.value?.contains(target)) {
    isOpen.value = false
  }
}

function closeDropdown() {
  isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  window.addEventListener('resize', closeDropdown)
  window.addEventListener('scroll', closeDropdown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  window.removeEventListener('resize', closeDropdown)
  window.removeEventListener('scroll', closeDropdown, true)
})
</script>

<template>
  <div class="multi-select">
    <button
      :id="inputId"
      ref="trigger"
      type="button"
      class="multi-select-trigger"
      :aria-label="accessibleLabel"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="`${inputId}-options`"
      :disabled="disabled"
      @click="toggleDropdown"
      @keydown.esc="closeDropdown"
    >
      <span :class="{ placeholder: !selectedNames.length }">{{ selectionText }}</span>
      <span class="multi-select-chevron" aria-hidden="true">⌄</span>
    </button>
    <Teleport to="body">
      <div
        v-if="isOpen"
        :id="`${inputId}-options`"
        ref="optionsPanel"
        class="multi-select-options"
        role="listbox"
        aria-multiselectable="true"
        :style="optionsStyle"
        @keydown.esc="closeDropdown"
      >
        <label
          v-for="option in options"
          :key="option.id"
          class="multi-select-option"
          role="option"
          :aria-selected="modelValue.includes(option.id)"
        >
          <input
            type="checkbox"
            :value="option.id"
            :checked="modelValue.includes(option.id)"
            :disabled="
              disabled || (required && modelValue.length === 1 && modelValue.includes(option.id))
            "
            @change="toggleOption(option.id)"
          />
          <span>{{ option.name }}</span>
        </label>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.multi-select {
  min-width: 190px;
}

.multi-select-trigger {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 11px;
  border: 1px solid var(--slate-300);
  border-radius: 9px;
  color: var(--slate-950);
  background: white;
  text-align: left;
}

.multi-select-trigger > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.multi-select-trigger .placeholder {
  color: var(--slate-500);
}

.multi-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.multi-select-chevron {
  flex: 0 0 auto;
  color: var(--slate-500);
  font-size: 18px;
  line-height: 1;
}

.multi-select-options {
  position: fixed;
  z-index: 100;
  min-width: 190px;
  max-height: 240px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--slate-300);
  border-radius: 9px;
  background: white;
  box-shadow: var(--shadow);
}

.multi-select-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 8px;
  border-radius: 7px;
  color: var(--slate-700);
  cursor: pointer;
  white-space: nowrap;
}

.multi-select-option:hover {
  background: var(--slate-100);
}

.multi-select-option input {
  width: 17px;
  height: 17px;
  margin: 0;
  accent-color: var(--indigo-600);
}

.multi-select-option:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.65;
}
</style>
