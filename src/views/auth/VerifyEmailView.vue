<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { services } from '@/services'
import { ApiError } from '@/types/models'

const route = useRoute()
const accountId = String(route.query.accountId ?? '')
const token = String(route.query.token ?? '')
const message = ref('')
const error = ref('')
async function verify() {
  try {
    if (!accountId || !token) return
    await services.auth.verifyEmail(accountId, token)
    message.value = 'Email verified. Your account remains Viewer until an Admin changes the role.'
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Verification failed'
  }
}
</script>
<template>
  <AuthLayout
    ><span class="eyebrow">Email verification</span>
    <h2>Verify your email</h2>
    <p v-if="!token">Registration succeeded. Please open the verification link in your email.</p>
    <p v-else>Confirm this email verification request.</p>
    <div v-if="message" class="alert success-alert">{{ message }}</div>
    <div v-if="error" class="alert">{{ error }}</div>
    <button v-if="accountId && token" class="button primary" @click="verify">Verify email</button>
    <p class="auth-footer">
      <RouterLink class="link" to="/sign-in">Return to sign in</RouterLink>
    </p></AuthLayout
  >
</template>
