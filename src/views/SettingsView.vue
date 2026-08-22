<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services/mockServices'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const skip = ref(false)
onMounted(async () => {
  skip.value = (await services.preferences.get()).skipBatchConfirmation
})
async function save() {
  await services.preferences.update(skip.value)
  localStorage.setItem('project-management-web:locale', locale.value)
  ui.notify(t('message.saved'))
}
async function reset() {
  if (!confirm(t('message.resetConfirm'))) return
  await services.reset()
  await auth.restore()
  ui.notify(t('common.reset'))
  await router.push('/sign-in')
}
</script>
<template>
  <PageHeader eyebrow="Preferences" :title="t('settings.title')" />
  <div class="detail-grid">
    <section class="card">
      <div class="card-header">
        <h2>{{ t('settings.title') }}</h2>
      </div>
      <div class="card-body">
        <div class="field">
          <label for="locale">{{ t('settings.language') }}</label
          ><select id="locale" v-model="locale">
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <label class="check-field"
          ><input v-model="skip" type="checkbox" />{{ t('settings.skipConfirm') }}</label
        >
        <div class="form-actions">
          <button class="button primary" @click="save">{{ t('common.save') }}</button>
        </div>
      </div>
    </section>
    <aside class="card">
      <div class="card-header">
        <h2>{{ t('settings.resetData') }}</h2>
      </div>
      <div class="card-body">
        <p style="color: var(--slate-500); line-height: 1.6">
          {{ t('settings.resetDescription') }}
        </p>
        <button class="button danger" @click="reset">{{ t('settings.resetData') }}</button>
      </div>
    </aside>
  </div>
</template>
