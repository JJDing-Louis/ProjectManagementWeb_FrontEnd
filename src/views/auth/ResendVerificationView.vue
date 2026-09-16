<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { services } from '@/services'
import { ApiError } from '@/types/models'
const { t } = useI18n()
const account = ref('')
const message = ref('')
const error = ref('')
async function resend() {
  message.value = ''
  error.value = ''
  try {
    await services.auth.resendVerification(account.value)
    message.value = t('auth.resendAccepted')
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Request failed'
  }
}
</script>
<template>
  <AuthLayout
    ><span class="eyebrow">Email verification</span>
    <h2>Resend verification</h2>
    <p>Enter your account or email to request another verification email.</p>
    <div v-if="message" class="alert success-alert" role="status">{{ message }}</div>
    <div v-if="error" class="alert" role="alert">{{ error }}</div>
    <div class="field">
      <label for="resend-account">Account or email</label
      ><input id="resend-account" v-model.trim="account" required />
    </div>
    <button class="button primary" @click="resend">Resend verification</button>
    <p class="auth-footer">
      <RouterLink class="link" to="/sign-in">Return to sign in</RouterLink>
    </p></AuthLayout
  >
</template>
