<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/types/models'

const { t } = useI18n()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const account = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await auth.signIn(account.value, password.value)
    await router.push(String(route.query.redirect ?? '/projects'))
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : t('auth.invalid')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <span class="eyebrow">ProjectManagementWeb</span>
    <h2>{{ t('auth.welcome') }}</h2>
    <p>{{ t('auth.subtitle') }}</p>
    <div v-if="error" class="alert" role="alert">{{ error }}</div>
    <form @submit.prevent="submit">
      <div class="field">
        <label for="account">{{ t('auth.account') }}</label
        ><input id="account" v-model.trim="account" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="password">{{ t('auth.password') }}</label
        ><input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>
      <button class="button primary" :disabled="submitting">
        {{ submitting ? t('common.loading') : t('auth.signIn') }}
      </button>
    </form>
    <p class="auth-footer">
      <RouterLink class="link" to="/sign-up">{{ t('auth.signUp') }}</RouterLink> ·
      <RouterLink class="link" to="/resend-verification">{{ t('auth.resend') }}</RouterLink>
    </p>
  </AuthLayout>
</template>
