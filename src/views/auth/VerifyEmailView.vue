<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { services } from '@/services'
import { ApiError } from '@/types/models'

const route = useRoute()
const accountId = String(route.query.accountId ?? '')
const token = String(route.query.token ?? '')
const verificationEmailSent = route.query.emailSent !== 'false'
const message = ref('')
const error = ref('')
const submitting = ref(false)
function verify() {
  if (submitting.value) return
  void verifyAsync()
}
async function verifyAsync() {
  message.value = ''
  error.value = ''
  submitting.value = true
  try {
    if (!accountId || !token) return
    await services.auth.verifyEmail(accountId, token)
    message.value = 'Email verified. Your account remains Viewer until an Admin changes the role.'
  } catch (reason) {
    error.value = reason instanceof ApiError ? reason.message : 'Verification failed'
  } finally {
    submitting.value = false
  }
}
</script>
<template>
  <AuthLayout
    ><span class="eyebrow">Email verification</span>
    <h2>驗證 Email</h2>
    <template v-if="!token">
      <div v-if="!verificationEmailSent" class="alert" role="alert">
        帳號已建立，但驗證信寄送失敗。請確認 SMTP 設定後重新寄送驗證信。
      </div>
      <p v-else>註冊成功，請開啟信箱中的驗證連結。</p>
    </template>
    <p v-else>請確認這次 Email 驗證。</p>
    <div v-if="message" class="alert success-alert" role="status">{{ message }}</div>
    <div v-if="error" class="alert" role="alert">{{ error }}</div>
    <button v-if="accountId && token" class="button primary" :disabled="submitting" @click="verify">
      {{ submitting ? 'Verifying...' : 'Verify email' }}
    </button>
    <p class="auth-footer">
      <RouterLink
        v-if="(!token && !verificationEmailSent) || error"
        class="link"
        to="/resend-verification"
        >重新寄送驗證信</RouterLink
      >
      <span v-if="(!token && !verificationEmailSent) || error"> · </span>
      <RouterLink class="link" to="/sign-in">Return to sign in</RouterLink>
    </p></AuthLayout
  >
</template>
