import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { services } from '@/services'
import type { CurrentUser } from '@/types/models'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  const initialized = ref(false)
  const isAuthenticated = computed(() => Boolean(user.value))
  const hasFunction = (code: string) => user.value?.functions.includes(code) ?? false
  const isAdmin = computed(() => hasFunction('accounts.manage-role'))
  const isTaskAdministrator = computed(() => hasFunction('tasks.update-any'))

  async function restore() {
    user.value = await services.auth.restore()
    initialized.value = true
  }

  async function signIn(account: string, password: string) {
    user.value = await services.auth.signIn(account, password)
  }

  async function signOut() {
    await services.auth.signOut()
    user.value = null
  }

  return {
    user,
    initialized,
    isAuthenticated,
    isAdmin,
    isTaskAdministrator,
    hasFunction,
    restore,
    signIn,
    signOut,
  }
})
