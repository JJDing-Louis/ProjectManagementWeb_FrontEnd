<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError } from '@/types/models'
const { t, locale } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const skip = ref(false)
const loading = ref(true)
const loadError = ref('')
const saveError = ref('')
const submitting = ref(false)
const canUpdatePreference = computed(() => auth.hasFunction('preferences.update-own'))
watch(locale, (value) => localStorage.setItem('project-management-web:locale', value))
onMounted(async () => {
  try {
    skip.value = (await services.preferences.get()).skipBatchConfirmation
  } catch (reason) {
    loadError.value = reason instanceof ApiError ? reason.message : 'Load failed'
  } finally {
    loading.value = false
  }
})
async function save() {
  if (!canUpdatePreference.value || submitting.value) return
  saveError.value = ''
  submitting.value = true
  try {
    await services.preferences.update(skip.value)
    ui.notify(t('message.saved'))
  } catch (reason) {
    saveError.value = reason instanceof ApiError ? reason.message : 'Save failed'
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <PageHeader eyebrow="Preferences" :title="t('settings.title')" />
  <div v-if="loadError" class="alert" role="alert">{{ loadError }}</div>
  <div v-else-if="loading" class="empty-state">{{ t('common.loading') }}</div>
  <div v-else class="detail-grid">
    <section class="card">
      <div class="card-header">
        <h2>{{ t('settings.title') }}</h2>
      </div>
      <div class="card-body">
        <div v-if="saveError" class="alert" role="alert">{{ saveError }}</div>
        <div class="field">
          <label for="locale">{{ t('settings.language') }}</label
          ><select id="locale" v-model="locale">
            <option value="zh-TW">繁體中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <label class="check-field"
          ><input v-model="skip" type="checkbox" :disabled="!canUpdatePreference" />{{
            t('settings.skipConfirm')
          }}</label
        >
        <div v-if="canUpdatePreference" class="form-actions">
          <button class="button primary" :disabled="submitting" @click="save">
            {{ submitting ? t('common.loading') : t('common.save') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
