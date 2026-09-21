<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/PageHeader.vue'
import { services } from '@/services'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiError } from '@/types/models'

const { t, locale } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const profile = reactive({ name: '', phoneNumber: '' })
const skip = ref(false)
const loading = ref(true)
const loadError = ref('')
const profileSaveError = ref('')
const preferenceSaveError = ref('')
const profileFieldErrors = ref<Record<string, string>>({})
const profileSubmitting = ref(false)
const preferenceSubmitting = ref(false)
const canUpdatePreference = computed(() => auth.hasFunction('preferences.update-own'))

watch(locale, (value) => localStorage.setItem('project-management-web:locale', value))

onMounted(async () => {
  try {
    const [loadedProfile, preference] = await Promise.all([
      services.profile.get(),
      services.preferences.get(),
    ])
    profile.name = loadedProfile.name
    profile.phoneNumber = loadedProfile.phoneNumber ?? ''
    skip.value = preference.skipBatchConfirmation
  } catch (reason) {
    loadError.value = reason instanceof ApiError ? reason.message : t('settings.loadFailed')
  } finally {
    loading.value = false
  }
})

async function saveProfile() {
  if (profileSubmitting.value) return
  profileSaveError.value = ''
  profileFieldErrors.value = {}
  const name = profile.name.trim()
  const phoneNumber = profile.phoneNumber.trim()
  if (!name) {
    profileFieldErrors.value.name = t('settings.nameRequired')
    return
  }
  if (name.length > 100) {
    profileFieldErrors.value.name = t('settings.nameTooLong')
    return
  }
  if (phoneNumber.length > 30) {
    profileFieldErrors.value.phoneNumber = t('settings.phoneTooLong')
    return
  }

  profileSubmitting.value = true
  try {
    const updated = await services.profile.update(name, phoneNumber || null)
    profile.name = updated.name
    profile.phoneNumber = updated.phoneNumber ?? ''
    auth.updateDisplayName(updated.name)
    ui.notify(t('message.saved'))
  } catch (reason) {
    if (reason instanceof ApiError) {
      profileSaveError.value = reason.message
      profileFieldErrors.value = reason.fieldErrors
    } else {
      profileSaveError.value = t('settings.saveFailed')
    }
  } finally {
    profileSubmitting.value = false
  }
}

async function savePreference() {
  if (!canUpdatePreference.value || preferenceSubmitting.value) return
  preferenceSaveError.value = ''
  preferenceSubmitting.value = true
  try {
    await services.preferences.update(skip.value)
    ui.notify(t('message.saved'))
  } catch (reason) {
    preferenceSaveError.value =
      reason instanceof ApiError ? reason.message : t('settings.saveFailed')
  } finally {
    preferenceSubmitting.value = false
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
        <h2>{{ t('settings.profile') }}</h2>
      </div>
      <div class="card-body">
        <div v-if="profileSaveError" class="alert profile-error" role="alert">
          {{ profileSaveError }}
        </div>
        <form novalidate @submit.prevent="saveProfile">
          <div class="field">
            <label for="profile-name">{{ t('user.name') }}</label>
            <input id="profile-name" v-model="profile.name" maxlength="100" required />
            <span v-if="profileFieldErrors.name" class="field-error">{{
              profileFieldErrors.name
            }}</span>
          </div>
          <div class="field">
            <label for="profile-phone">{{ t('settings.phoneNumber') }}</label>
            <input
              id="profile-phone"
              v-model="profile.phoneNumber"
              type="tel"
              maxlength="30"
              :placeholder="t('settings.phonePlaceholder')"
            />
            <span v-if="profileFieldErrors.phoneNumber" class="field-error">{{
              profileFieldErrors.phoneNumber
            }}</span>
          </div>
          <div class="form-actions">
            <button class="button primary profile-save" :disabled="profileSubmitting">
              {{ profileSubmitting ? t('common.loading') : t('common.save') }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <h2>{{ t('settings.preferences') }}</h2>
      </div>
      <div class="card-body">
        <div v-if="preferenceSaveError" class="alert preference-error" role="alert">
          {{ preferenceSaveError }}
        </div>
        <div class="field">
          <label for="locale">{{ t('settings.language') }}</label>
          <select id="locale" v-model="locale">
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
          <button
            class="button primary preference-save"
            :disabled="preferenceSubmitting"
            @click="savePreference"
          >
            {{ preferenceSubmitting ? t('common.loading') : t('common.save') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
