<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { services } from '@/services'
import { ApiError } from '@/types/models'

const { t } = useI18n()
const router = useRouter()
const form = reactive({
  account: '',
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const error = ref('')
const fieldErrors = ref<Record<string, string>>({})

async function submit() {
  error.value = ''
  fieldErrors.value = {}
  if (form.password !== form.confirmPassword) {
    fieldErrors.value.confirmPassword = 'Passwords do not match'
    return
  }
  try {
    const accountId = await services.auth.signUp(form)
    await router.push({ name: 'verify-email', query: { accountId } })
  } catch (reason) {
    if (reason instanceof ApiError) {
      error.value = reason.message
      fieldErrors.value = reason.fieldErrors
    }
  }
}
</script>

<template>
  <AuthLayout>
    <span class="eyebrow">ProjectManagementWeb</span>
    <h2>{{ t('auth.signUp') }}</h2>
    <p>Create a Viewer account and verify your email later.</p>
    <div v-if="error" class="alert">{{ error }}</div>
    <form @submit.prevent="submit">
      <div class="field">
        <label for="account">{{ t('auth.account') }}</label
        ><input id="account" v-model.trim="form.account" required /><span
          v-if="fieldErrors.account"
          class="field-error"
          >{{ fieldErrors.account }}</span
        >
      </div>
      <div class="field">
        <label for="displayName">{{ t('auth.displayName') }}</label
        ><input id="displayName" v-model.trim="form.displayName" required />
      </div>
      <div class="field">
        <label for="email">{{ t('auth.email') }}</label
        ><input id="email" v-model.trim="form.email" type="email" required /><span
          v-if="fieldErrors.email"
          class="field-error"
          >{{ fieldErrors.email }}</span
        >
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="password">{{ t('auth.password') }}</label
          ><input id="password" v-model="form.password" type="password" minlength="10" required />
        </div>
        <div class="field">
          <label for="confirmPassword">{{ t('auth.confirmPassword') }}</label
          ><input
            id="confirmPassword"
            v-model="form.confirmPassword"
            type="password"
            required
          /><span v-if="fieldErrors.confirmPassword" class="field-error">{{
            fieldErrors.confirmPassword
          }}</span>
        </div>
      </div>
      <button class="button primary">{{ t('auth.signUp') }}</button>
    </form>
    <p class="auth-footer">
      <RouterLink class="link" to="/sign-in">{{ t('auth.signIn') }}</RouterLink>
    </p>
  </AuthLayout>
</template>
