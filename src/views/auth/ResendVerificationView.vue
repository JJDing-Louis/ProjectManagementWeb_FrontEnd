<script setup lang="ts">
import { ref } from 'vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { services } from '@/services/mockServices'
import { ApiError } from '@/types/models'
const account = ref('pending')
const message = ref('')
const error = ref('')
async function resend() {
  message.value = ''
  error.value = ''
  try {
    await services.auth.resendVerification(account.value)
    message.value = 'A new verification email has been queued for this demo account.'
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Request failed'
  }
}
</script>
<template>
  <AuthLayout
    ><span class="eyebrow">Email verification</span>
    <h2>Resend verification</h2>
    <p>Enter your account to request another verification email.</p>
    <div v-if="message" class="alert success-alert">{{ message }}</div>
    <div v-if="error" class="alert">{{ error }}</div>
    <div class="field">
      <label for="resend-account">Account</label><input id="resend-account" v-model="account" />
    </div>
    <button class="button primary" @click="resend">Resend verification</button>
    <p class="auth-footer">
      <RouterLink class="link" to="/sign-in">Return to sign in</RouterLink>
    </p></AuthLayout
  >
</template>
