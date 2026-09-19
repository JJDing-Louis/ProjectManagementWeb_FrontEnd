<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface SearchableSelectOption {
  id: string
  label: string
  description?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: SearchableSelectOption[]
    inputId: string
    accessibleLabel: string
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '請選擇',
    searchPlaceholder: '輸入關鍵字篩選',
    emptyText: '沒有符合條件的資料',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const trigger = ref<HTMLElement>()
const searchInput = ref<HTMLElement>()
const optionsPanel = ref<HTMLElement>()
const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(-1)
const optionsStyle = ref<Record<string, string>>({})

const selectedOption = computed(() =>
  props.options.find((option) => option.id === props.modelValue),
)
const filteredOptions = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase()
  if (!keyword) return props.options

  return props.options.filter((option) =>
    `${option.label} ${option.description ?? ''}`.toLocaleLowerCase().includes(keyword),
  )
})

async function updateOptionsPosition() {
  const triggerElement = trigger.value
  if (!triggerElement) return

  const triggerRect = triggerElement.getBoundingClientRect()
  const panelHeight = optionsPanel.value?.offsetHeight ?? 0
  const viewportPadding = 8
  const availableBelow = window.innerHeight - triggerRect.bottom
  const openAbove = availableBelow < panelHeight + 12 && triggerRect.top > availableBelow
  const width = Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2)
  const top = openAbove
    ? Math.max(viewportPadding, triggerRect.top - panelHeight - 6)
    : triggerRect.bottom + 6
  const left = Math.min(
    Math.max(viewportPadding, triggerRect.left),
    Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
  )

  optionsStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
}

async function openDropdown() {
  if (props.disabled) return
  isOpen.value = true
  query.value = ''
  activeIndex.value = props.options.findIndex((option) => option.id === props.modelValue)
  await nextTick()
  await updateOptionsPosition()
  searchInput.value?.focus()
}

function closeDropdown() {
  isOpen.value = false
  query.value = ''
  activeIndex.value = -1
}

function selectOption(option: SearchableSelectOption) {
  emit('update:modelValue', option.id)
  closeDropdown()
  nextTick(() => trigger.value?.focus())
}

function moveActiveOption(offset: number) {
  if (!filteredOptions.value.length) return
  const nextIndex = activeIndex.value + offset
  activeIndex.value = (nextIndex + filteredOptions.value.length) % filteredOptions.value.length
}

function selectActiveOption() {
  const option = filteredOptions.value[activeIndex.value]
  if (option) selectOption(option)
}

function closeOnOutsideClick(event: MouseEvent) {
  const target = event.target as Node
  if (!trigger.value?.contains(target) && !optionsPanel.value?.contains(target)) {
    closeDropdown()
  }
}

watch(filteredOptions, (options) => {
  activeIndex.value = options.length ? 0 : -1
})

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
  <div class="searchable-select">
    <button
      :id="inputId"
      ref="trigger"
      type="button"
      class="searchable-select-trigger"
      :aria-label="accessibleLabel"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="`${inputId}-options`"
      :disabled="disabled"
      @click="openDropdown"
      @keydown.down.prevent="openDropdown"
      @keydown.enter.prevent="openDropdown"
      @keydown.space.prevent="openDropdown"
    >
      <span :class="{ placeholder: !selectedOption }">
        {{ selectedOption?.label ?? placeholder }}
        <small v-if="selectedOption?.description">{{ selectedOption.description }}</small>
      </span>
      <span class="searchable-select-chevron" aria-hidden="true">⌄</span>
    </button>

    <Teleport to="body">
      <div v-if="isOpen" ref="optionsPanel" class="searchable-select-panel" :style="optionsStyle">
        <input
          :id="`${inputId}-search`"
          ref="searchInput"
          v-model="query"
          class="searchable-select-search"
          type="search"
          role="combobox"
          autocomplete="off"
          :aria-label="searchPlaceholder"
          aria-autocomplete="list"
          aria-expanded="true"
          :aria-controls="`${inputId}-options`"
          :aria-activedescendant="activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined"
          :placeholder="searchPlaceholder"
          @keydown.down.prevent="moveActiveOption(1)"
          @keydown.up.prevent="moveActiveOption(-1)"
          @keydown.enter.prevent="selectActiveOption"
          @keydown.esc="closeDropdown"
        />
        <div :id="`${inputId}-options`" class="searchable-select-options" role="listbox">
          <button
            v-for="(option, index) in filteredOptions"
            :id="`${inputId}-option-${index}`"
            :key="option.id"
            type="button"
            class="searchable-select-option"
            :class="{ active: index === activeIndex }"
            role="option"
            :aria-selected="option.id === modelValue"
            @mouseenter="activeIndex = index"
            @mousedown.prevent
            @click="selectOption(option)"
          >
            <span>{{ option.label }}</span>
            <small v-if="option.description">{{ option.description }}</small>
          </button>
          <p v-if="!filteredOptions.length" class="searchable-select-empty" role="status">
            {{ emptyText }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.searchable-select {
  min-width: 260px;
}

.searchable-select-trigger {
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

.searchable-select-trigger > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.searchable-select-trigger small {
  margin-left: 5px;
  color: var(--slate-500);
}

.searchable-select-trigger .placeholder {
  color: var(--slate-500);
}

.searchable-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.searchable-select-chevron {
  flex: 0 0 auto;
  color: var(--slate-500);
  font-size: 18px;
  line-height: 1;
}

.searchable-select-panel {
  position: fixed;
  z-index: 100;
  padding: 6px;
  border: 1px solid var(--slate-300);
  border-radius: 9px;
  background: white;
  box-shadow: var(--shadow);
}

.searchable-select-search {
  width: 100%;
  min-height: 40px;
  border: 1px solid var(--slate-300);
  border-radius: 7px;
  padding: 8px 10px;
  color: var(--slate-950);
  background: white;
}

.searchable-select-search:focus {
  border-color: var(--indigo-600);
  outline: 2px solid color-mix(in srgb, var(--indigo-600) 18%, transparent);
}

.searchable-select-options {
  max-height: 220px;
  overflow-y: auto;
  margin-top: 5px;
}

.searchable-select-option {
  width: 100%;
  display: grid;
  gap: 2px;
  padding: 9px 8px;
  border: 0;
  border-radius: 7px;
  color: var(--slate-700);
  background: transparent;
  text-align: left;
}

.searchable-select-option:hover,
.searchable-select-option.active {
  background: var(--slate-100);
}

.searchable-select-option[aria-selected='true'] {
  color: var(--indigo-700);
  background: color-mix(in srgb, var(--indigo-600) 10%, white);
}

.searchable-select-option small {
  color: var(--slate-500);
}

.searchable-select-empty {
  margin: 0;
  padding: 14px 8px;
  color: var(--slate-500);
  font-size: 13px;
  text-align: center;
}
</style>
