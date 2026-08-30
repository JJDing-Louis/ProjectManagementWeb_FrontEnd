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
    <h2>驗證 Email</h2>
    <template v-if="!token">
      <div v-if="!verificationEmailSent" class="alert" role="alert">
        帳號已建立，但驗證信寄送失敗。請確認 SMTP 設定後重新寄送驗證信。
      </div>
      <p v-else>註冊成功，請開啟信箱中的驗證連結。</p>
    </template>
    <p v-else>請確認這次 Email 驗證。</p>
    <div v-if="message" class="alert success-alert">{{ message }}</div>
    <div v-if="error" class="alert">{{ error }}</div>
    <button v-if="accountId && token" class="button primary" @click="verify">Verify email</button>
    <p class="auth-footer">
      <RouterLink v-if="!token && !verificationEmailSent" class="link" to="/resend-verification"
        >重新寄送驗證信</RouterLink
      >
      <span v-if="!token && !verificationEmailSent"> · </span>
      <RouterLink class="link" to="/sign-in">Return to sign in</RouterLink>
    </p></AuthLayout
  >
</template>
