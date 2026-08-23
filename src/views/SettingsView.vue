<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services'
import { useUiStore } from '@/stores/ui'
const { t, locale } = useI18n()
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
  </div>
</template>
