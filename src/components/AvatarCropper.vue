<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { calculateAvatarCrop } from '@/utils/avatarCrop'

defineProps<{ busy: boolean }>()
const emit = defineEmits<{ confirmed: [file: File] }>()
const { t } = useI18n()

const canvas = ref<HTMLCanvasElement | null>(null)
const selectedFile = ref<File | null>(null)
const sourceUrl = ref<string | null>(null)
const image = ref<HTMLImageElement | null>(null)
const zoom = ref(1)
const horizontal = ref(50)
const vertical = ref(50)
const processing = ref(false)
const error = ref('')
const maximumZoom = computed(() =>
  image.value
    ? Math.max(1, Math.min(3, Math.min(image.value.naturalWidth, image.value.naturalHeight) / 1080))
    : 1,
)

function releaseSource() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = null
  image.value = null
  selectedFile.value = null
}

function cancel() {
  releaseSource()
  error.value = ''
}

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  cancel()
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    error.value = t('settings.avatarFormatError')
    return
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    error.value = t('settings.avatarSizeError')
    return
  }

  const url = URL.createObjectURL(file)
  const loaded = new Image()
  loaded.onload = async () => {
    if (sourceUrl.value !== url) return
    if (Math.min(loaded.naturalWidth, loaded.naturalHeight) < 1080) {
      cancel()
      error.value = t('settings.avatarDimensionsError')
      return
    }
    selectedFile.value = file
    image.value = loaded
    zoom.value = 1
    horizontal.value = 50
    vertical.value = 50
    await nextTick()
    drawPreview()
  }
  loaded.onerror = () => {
    if (sourceUrl.value !== url) return
    cancel()
    error.value = t('settings.avatarInvalidError')
  }
  sourceUrl.value = url
  loaded.src = url
}

function draw(context: CanvasRenderingContext2D, side: number) {
  const source = image.value
  if (!source) return
  const crop = calculateAvatarCrop(
    source.naturalWidth,
    source.naturalHeight,
    zoom.value,
    horizontal.value,
    vertical.value,
  )
  context.clearRect(0, 0, side, side)
  context.drawImage(source, crop.left, crop.top, crop.side, crop.side, 0, 0, side, side)
}

function drawPreview() {
  const context = canvas.value?.getContext('2d')
  if (context) draw(context, 320)
}

watch([zoom, horizontal, vertical], drawPreview)

async function confirm() {
  if (!selectedFile.value || processing.value) return
  processing.value = true
  error.value = ''
  try {
    const output = document.createElement('canvas')
    output.width = 1080
    output.height = 1080
    const context = output.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    draw(context, 1080)
    const type = selectedFile.value.type
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, type, type === 'image/jpeg' ? 0.85 : undefined),
    )
    if (!blob || blob.size > 5 * 1024 * 1024) {
      error.value = t('settings.avatarSizeError')
      return
    }
    emit(
      'confirmed',
      new File([blob], type === 'image/jpeg' ? 'avatar.jpg' : 'avatar.png', { type }),
    )
  } catch {
    error.value = t('settings.avatarInvalidError')
  } finally {
    processing.value = false
  }
}

onBeforeUnmount(releaseSource)
</script>

<template>
  <div class="avatar-cropper">
    <div class="field">
      <label for="avatar-file">{{ t('settings.avatarChoose') }}</label>
      <input
        id="avatar-file"
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        :disabled="busy || processing"
        @change="selectFile"
      />
      <small>{{ t('settings.avatarHelp') }}</small>
    </div>
    <div v-if="error" class="alert" role="alert">{{ error }}</div>
    <div v-if="image" class="avatar-crop-controls">
      <canvas ref="canvas" width="320" height="320" :aria-label="t('settings.avatarPreview')" />
      <label for="avatar-zoom">{{ t('settings.avatarZoom') }}</label>
      <input
        id="avatar-zoom"
        v-model.number="zoom"
        type="range"
        min="1"
        :max="maximumZoom"
        step="0.01"
      />
      <label for="avatar-horizontal">{{ t('settings.avatarHorizontal') }}</label>
      <input id="avatar-horizontal" v-model.number="horizontal" type="range" min="0" max="100" />
      <label for="avatar-vertical">{{ t('settings.avatarVertical') }}</label>
      <input id="avatar-vertical" v-model.number="vertical" type="range" min="0" max="100" />
      <div class="form-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="busy || processing"
          @click="cancel"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="button primary"
          type="button"
          :disabled="busy || processing"
          @click="confirm"
        >
          {{ busy || processing ? t('common.loading') : t('settings.avatarUpload') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.avatar-crop-controls {
  display: grid;
  gap: 8px;
  max-width: 420px;
}
.avatar-crop-controls canvas {
  display: block;
  width: min(100%, 320px);
  height: auto;
  border-radius: 12px;
}
.avatar-crop-controls input[type='range'] {
  width: 100%;
}
</style>
