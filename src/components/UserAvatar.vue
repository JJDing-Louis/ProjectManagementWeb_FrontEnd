<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { services } from '@/services'

const props = withDefaults(
  defineProps<{
    accountId: string | undefined
    displayName: string
    refreshKey?: number
    size?: 'small' | 'normal' | 'large'
  }>(),
  { refreshKey: 0, size: 'normal' },
)

const imageUrl = ref<string | null>(null)
let currentRequest = 0

function releaseImage() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = null
}

watch(
  () => [props.accountId, props.refreshKey] as const,
  async () => {
    const requestId = ++currentRequest
    releaseImage()
    if (!props.accountId) return
    try {
      const blob = await services.avatar.get(props.accountId)
      if (requestId !== currentRequest || !blob) return
      imageUrl.value = URL.createObjectURL(blob)
    } catch {
      // 圖片載入失敗時保留姓名首字備援，其他頁面資料仍可使用。
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  currentRequest++
  releaseImage()
})
</script>

<template>
  <span class="avatar" :class="size === 'normal' ? undefined : size" :aria-label="displayName">
    <img v-if="imageUrl" :src="imageUrl" alt="" />
    <template v-else>{{ displayName.charAt(0) }}</template>
  </span>
</template>

<style scoped>
.avatar.large {
  width: 96px;
  height: 96px;
  font-size: 30px;
}
.avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
</style>
