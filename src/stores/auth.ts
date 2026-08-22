import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { services } from '@/services/mockServices'
import type { User } from '@/types/models'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initialized = ref(false)
  const isAuthenticated = computed(() => Boolean(user.value))
  const isAdmin = computed(() => user.value?.role === 'Admin')
  const isTaskAdministrator = computed(() =>
    ['Admin', 'Administrator'].includes(user.value?.role ?? ''),
  )

  async function restore() {
    user.value = await services.auth.currentUser()
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
    restore,
    signIn,
    signOut,
  }
})
