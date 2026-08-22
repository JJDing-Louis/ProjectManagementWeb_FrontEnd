<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { services } from '@/services/mockServices'
import { ApiError } from '@/types/models'

const route = useRoute()
const account = ref(String(route.query.account ?? 'pending'))
const message = ref('')
const error = ref('')
async function verify() {
  try {
    await services.auth.verifyEmail(account.value)
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
    <p>This demo simulates opening a valid verification link.</p>
    <div v-if="message" class="alert success-alert">{{ message }}</div>
    <div v-if="error" class="alert">{{ error }}</div>
    <div class="field">
      <label for="verify-account">Account</label><input id="verify-account" v-model="account" />
    </div>
    <button class="button primary" @click="verify">Verify email</button>
    <p class="auth-footer">
      <RouterLink class="link" to="/sign-in">Return to sign in</RouterLink>
    </p></AuthLayout
  >
</template>
